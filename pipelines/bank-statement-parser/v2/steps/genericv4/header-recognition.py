from v2.base_step import BaseStep
import re
from fuzzywuzzy import fuzz
from fuzzywuzzy import process
from v2.exceptions import UserFacingError, ErrorMessages


class HeaderRecognition(BaseStep):
    def __init__(self, context=None, input=None) -> None:
        self.mapping = {}
        super().__init__(context, input)

    def _normalize(self, text: str) -> str:
        return re.sub(r"[^a-z]", "", text.lower())  # remove non-alphabetic chars

    def _map_headers(self, header: str):
        HEADERS_MAP = {
            "date": [
                "date",
                "txndate",
                "trandate",
                "transactiondate",
                "value date"
            ],
            "particulars": [
                "particulars",
                "transactiondetails",
                "description",
                "remarks",
                "narration",
                "details",
                "reference",
            ],
            "credit": ["deposits", "credit", "credits", "deposit", "money in", "credit amount","in"],
            "debit": ["withdrawals", "debit", "debits", "withdrawal", "money out", "debit amount","out"],
            "balance": ["balance", "running balance", "closing balance"],
            "amount": ["amount"],
        }

        normalized = self._normalize(header)

        best_score = 0
        best_key = header  # fallback to original

        for key, variants in HEADERS_MAP.items():
            normalized_variants = [self._normalize(v) for v in variants]
            match, score = process.extractOne(
                normalized, normalized_variants, scorer=fuzz.token_sort_ratio
            )
            if score > best_score:
                best_score = score
                best_key = key
        self.logger.debug("Header mapping evaluation", 
                         header=header, 
                         best_match=best_key, 
                         score=best_score)
        if best_score >= 50:
            return best_key, best_score
        else:
            return header, -1

    def run(self):
        """Process headers from input stream and yield recognized headers."""
        self.logger.info("Starting header recognition and mapping")
        
        # Get headers from input stream
        headers_data = None
        for item in self.read_input_streaming("headers"):
            headers_data = item
            break  # Headers step produces single result
        
        if not headers_data:
            raise UserFacingError(ErrorMessages.HEADERS_NOT_FOUND.value)
        
        headers = headers_data["headers"]
        
        # Track the best header and score for each canonical header
        canonical_to_best = {}  # {canonical: (header_text, score)}
        header_to_canonical = {}  # {header_text: (canonical, score)}

        self.logger.info("Processing headers for recognition", total_headers=len(headers))

        # First pass: find the best mapping for each canonical header
        for header in headers:
            header_text = header["text"]
            if self.mapping.get(header_text, None):
                mapped_text = self.mapping[header_text]
                score = 100  # Assume perfect match if already mapped
            else:
                mapped_text, score = self._map_headers(header_text)
                self.mapping[header_text] = mapped_text
            
            header_to_canonical[header_text] = (mapped_text, score)
            if mapped_text not in canonical_to_best or score > canonical_to_best[mapped_text][1]:
                canonical_to_best[mapped_text] = (header_text, score)

        # Second pass: assign the best canonical names
        recognized_headers = []
        for header in headers:
            header_text = header["text"]
            mapped_text, score = header_to_canonical[header_text]
            
            # Only assign if this header is the best for this canonical
            if canonical_to_best.get(mapped_text, (None, -1))[0] == header_text and score >= 70:
                header["text"] = mapped_text
                self.logger.info("Header mapped successfully", 
                                original=header_text, 
                                mapped=mapped_text, 
                                score=score)
            else:
                header["text"] = header_text  # Keep original if not the best
                self.logger.debug("Keeping original header", 
                                 header=header_text, 
                                 score=score)
            
            header["original_text"] = header_text
            recognized_headers.append(header)

        # Yield the complete result with recognized headers
        yield {
            "headers": recognized_headers,
            "source_page": headers_data.get("source_page", 0),
            "total_words": headers_data.get("total_words", 0),
            "mapping_stats": {
                "total_headers": len(headers),
                "recognized_headers": len([h for h in recognized_headers if h["text"] != h["original_text"]]),
                "canonical_mappings": list(canonical_to_best.keys())
            }
        }
