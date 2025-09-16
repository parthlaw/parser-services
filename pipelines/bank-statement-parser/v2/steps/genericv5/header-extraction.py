from typing import List
from collections import defaultdict

from botocore.credentials import json
from pipelines.v2.base_step import BaseStep
import copy


class HeaderExtraction(BaseStep):
    def __init__(self, context=None, input=None) -> None:
        super().__init__(context, input)

    def _get_header_keywords(self):
        HEADER_KEYWORDS = {
            "date",
            "description",
            "amount",
            "balance",
            "debit",
            "credit",
            "reference",
            "transaction",
            "details",
            "particulars",
            "deposit",
            "withdrawal",
            "memo",
            "check",
            "cheque",
            "cr",
            "dr",
        }
        return HEADER_KEYWORDS

    def merge_header_text_on_x_tolerance(self, headers, x_tolerance=6):
        """Merge horizontally adjacent header texts"""
        if not headers:
            return headers

        x_sorted_headers = sorted(headers, key=lambda h: h["x0"])
        merged_headers = []
        current_header = dict(x_sorted_headers[0])

        for i in range(1, len(x_sorted_headers)):
            header = x_sorted_headers[i]
            # Check if headers are horizontally adjacent
            if header["x0"] - current_header["x1"] <= x_tolerance:
                # Merge headers
                current_header["text"] += " " + header["text"]
                current_header["x1"] = header["x1"]
            else:
                merged_headers.append(current_header)
                current_header = dict(header)

        merged_headers.append(current_header)
        return merged_headers

    def merge_multiline_headers(self, headers, y_tolerance=3):
        """Merge vertically stacked header texts"""
        if not headers:
            return headers

        # Group headers by approximate x position (column)
        columns = defaultdict(list)
        for header in headers:
            x_center = (header["x0"] + header["x1"]) / 2
            # Find matching column or create new one
            matched_column = None
            for col_x in columns.keys():
                if abs(x_center - col_x) <= 20:  # Column tolerance
                    matched_column = col_x
                    break

            if matched_column is None:
                columns[x_center] = [header]
            else:
                columns[matched_column].append(header)

        # Merge headers within each column that are vertically close
        merged_headers = []
        for col_headers in columns.values():
            if not col_headers:
                continue

            # Sort by vertical position
            col_headers.sort(key=lambda h: h["top"])

            current_header = dict(col_headers[0])
            for i in range(1, len(col_headers)):
                header = col_headers[i]
                # Check if headers are vertically adjacent
                if header["top"] - current_header["bottom"] <= y_tolerance:
                    # Merge vertically
                    current_header["text"] += " " + header["text"]
                    current_header["bottom"] = header["bottom"]
                else:
                    merged_headers.append(current_header)
                    current_header = dict(header)

            merged_headers.append(current_header)

        return merged_headers

    def find_header_candidates(
        self, words: List[dict], row_tolerance: float = 5.0
    ) -> List[List[dict]]:
        """Find all potential header rows based on keyword presence and positioning"""
        header_keywords = self._get_header_keywords()
        potential_header_rows = []

        # Group words by their vertical position with tolerance
        def group_words_by_rows_with_tolerance(words, tolerance):
            if not words:
                return {}

            # Sort words by their top coordinate
            sorted_words = sorted(words, key=lambda w: w["top"])

            rows = {}
            for word in sorted_words:
                # Find if this word belongs to an existing row (within tolerance)
                assigned = False
                for existing_top in rows.keys():
                    if abs(word["top"] - existing_top) <= tolerance:
                        rows[existing_top].append(word)
                        assigned = True
                        break

                # If not assigned to existing row, create new row
                if not assigned:
                    rows[word["top"]] = [word]

            return rows

        # Group words into rows with tolerance
        rows = group_words_by_rows_with_tolerance(words, row_tolerance)

        # Find rows that contain header keywords
        for top, row_words in rows.items():
            row_words.sort(key=lambda w: w["x0"])  # Sort horizontally

            # Check if this row contains any header keywords
            has_header_keyword = any(
                word["text"].lower() in header_keywords for word in row_words
            )

            if has_header_keyword:
                potential_header_rows.append((top, row_words))

        # Sort by vertical position
        potential_header_rows.sort(key=lambda x: x[0])
        return [row for _, row in potential_header_rows]

    def score_header_row(self, row_words: List[dict]) -> float:
        """Score a potential header row based on various criteria"""
        header_keywords = self._get_header_keywords()
        score = 0

        # Count header keywords
        keyword_count = sum(
            1 for word in row_words if word["text"].lower() in header_keywords
        )
        score += keyword_count * 10

        # Bonus for multiple columns (spread across page width)
        if len(row_words) >= 3:
            x_positions = [word["x0"] for word in row_words]
            width_coverage = (max(x_positions) - min(x_positions)) / 500  # Normalize
            score += width_coverage * 5

        # Bonus for common header patterns
        row_text = " ".join([word["text"].lower() for word in row_words])
        common_patterns = ["date", "amount", "balance", "description"]
        pattern_bonus = sum(2 for pattern in common_patterns if pattern in row_text)
        score += pattern_bonus

        # Penalty for very long text (likely not headers)
        avg_word_length = sum(len(word["text"]) for word in row_words) / len(row_words)
        if avg_word_length > 15:
            score -= 5

        return score

    def extract_headers_from_candidates(
        self, candidates: List[List[dict]], y_tolerance=10
    ) -> List[dict]:
        """Extract the best header row from candidates"""
        if not candidates:
            return []

        # Score each candidate row
        scored_candidates = []
        for row_words in candidates:
            score = self.score_header_row(row_words)
            scored_candidates.append((score, row_words))

        # Sort by score (highest first)
        scored_candidates.sort(key=lambda x: x[0], reverse=True)

        # Take the best candidate
        best_row = scored_candidates[0][1]

        # Check for multiline headers by looking at nearby rows
        best_row_top = best_row[0]["top"] if best_row else 0
        word_height = best_row[0]["height"]
        multiline_candidates = []

        for score, row_words in scored_candidates:
            if not row_words:
                continue
            row_top = row_words[0]["top"]
            if abs(row_top - best_row_top) <= y_tolerance + word_height and score > 5:
                multiline_candidates.extend(row_words)

        if multiline_candidates:
            # Merge horizontally adjacent words first
            merged_horizontal = self.merge_header_text_on_x_tolerance(
                multiline_candidates
            )
            # Then merge multiline headers
            final_headers = self.merge_multiline_headers(merged_horizontal)
        else:
            final_headers = self.merge_header_text_on_x_tolerance(best_row)

        return final_headers

    def _extract_headers(self, words: List[dict],i) -> List[dict]:
        """Main header extraction logic"""
        if not words:
            return []

        # Find all potential header rows
        header_candidates = self.find_header_candidates(words)
        if not header_candidates:
            return []

        # Extract the best headers from candidates
        headers = self.extract_headers_from_candidates(header_candidates)

        return headers

    def run(self):
        """Extract headers from the first page with text and yield as single result."""
        pdf_doc = self.context["pdf"]
        total_words = 0
        
        self.logger.info("Starting header extraction", total_pages=len(pdf_doc.pages))
        
        for i, page in enumerate(pdf_doc.pages):
            self.logger.debug("Processing page for header extraction", page_number=i)
            words = page.extract_words()
            total_words += len(words)
            
            if not words:
                self.logger.debug("Page has no words, skipping", page_number=i)
                continue
                
            # Only extract headers from the first page with words
            self.logger.info("Extracting headers from page", page_number=i)
            words = sorted(words, key=lambda w: (w["top"], w["x0"]))
            headers = self._extract_headers(words, i)
            
            # Yield the headers as a single result
            yield {
                "headers": headers,
                "source_page": i,
                "total_words": total_words
            }
            return
        
        if total_words == 0:
            raise Exception("PDF is likely image-based - no extractable text found")
                    