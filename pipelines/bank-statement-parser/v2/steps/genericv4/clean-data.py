from typing import Dict, List
import gc

from v2.base_step import BaseStep
import re


class CleanData(BaseStep):
    def __init__(self, context=None, input=None) -> None:
        super().__init__(context, input)

    def smart_split_with_dots(self,text: str):
        """
        Splits a string on long dot sequences (3+) and preserves the dot segments.
        Returns a list like ['10.00', '.....', '928,010.00']
        """
        parts = re.split(r'(\.{3,})', text)  # keeps the delimiter
        return [part for part in parts if part.strip()]

    def estimate_bounding_boxes(
        self, original_box: Dict, parts: List[str]
    ) -> List[Dict]:
        """
        Given an original bounding box and split parts, estimate new x0/x1 per part.
        """
        x0, x1 = original_box["x0"], original_box["x1"]
        width = x1 - x0

        total_chars = sum(len(p) for p in parts)
        if total_chars == 0:
            return []

        char_width = width / total_chars
        current_x = x0

        new_boxes = []
        for part in parts:
            part_width = len(part) * char_width
            new_boxes.append(
                {
                    "text": part,
                    "x0": current_x,
                    "x1": current_x + part_width,
                    "top": original_box["top"],
                    "bottom": original_box["bottom"],
                    "doctop": original_box.get("doctop", 0),
                    # Optionally keep other fields like fontname, size, etc.
                }
            )
            current_x += part_width

        return new_boxes

    def is_fake_i_filler(self, text: str) -> bool:
        return re.fullmatch(r"i{1,}", text, flags=re.IGNORECASE) is not None
    
    def is_fake_hyphen_filler(self, text: str) -> bool:
        return re.fullmatch(r"-+\s*", text.strip(), flags=re.IGNORECASE) is not None
        

    def clean_dot_padded_words(self, words: List[Dict]) -> List[Dict]:
        """
        Given a list of word dicts (from pdfplumber), split those containing long dots into new boxes.
        """
        cleaned_words = []
        for word in words:
            if self.is_fake_hyphen_filler(word["text"]):
                continue
            if re.search(r"\.{3,}", word["text"]) or self.is_fake_i_filler(
                word["text"]
            ):
                parts = self.smart_split_with_dots(word["text"])
                text = word["text"]
                if re.fullmatch(r"\.+", text) or self.is_fake_i_filler(text):
                    continue
                if len(parts) > 1:
                    if "4,713.22" in text:
                        self.logger.debug("Debugging text splitting", word=word, parts=parts)
                    new_boxes = self.estimate_bounding_boxes(word, parts)
                    cleaned_words.extend(new_boxes)
                else:
                    cleaned_words.append(word)  # fallback
            else:
                cleaned_words.append(word)
        return cleaned_words

    def remove_data_above_table(self, words, header_y):
        new_words = []
        for word in words:
            if word["top"] <= header_y:
                continue
            new_words.append(word)
        return new_words

    def is_footer_content(self, text):
        footer_patterns = [
            r"page\s*\d+\s*of\s*\d+" r"\d+/\d+",
            r"continued on next page",
            r"member fdic",
            r"customer service",
            r"^\d{4}-\d{2}-\d{2}$",  # dates
            r"statement period",
        ]

        text_lower = text.lower().strip()
        return any(re.search(pattern, text_lower) for pattern in footer_patterns)
    def is_header_list_copy(self,headers):
        for header in headers:
            if header.get("is_copy",False):
                return True
        return False

    def run(self):
        """Clean and process words from all PDF pages, yielding page-by-page results."""
        pdf_doc = self.context["pdf"]
        
        # Get headers from input stream
        headers_data = None
        for item in self.read_input_streaming("headers"):
            headers_data = item
            break  # Headers step produces single result
        
        if not headers_data:
            raise ValueError("No headers data found")
        
        headers = headers_data["headers"]
        source_page = headers_data["source_page"]
        
        self.logger.info("Starting data cleaning", total_pages=len(pdf_doc.pages))
        for i, page in enumerate(pdf_doc.pages):
            self.logger.debug("Cleaning data on page", page_number=i)
            words = page.extract_words()
            words = self.clean_dot_padded_words(words)
            # For first page (or source page), remove data above table
            if i == source_page and headers and len(headers) > 0:
                words = sorted(words, key=lambda w: w["top"])
                words = self.remove_data_above_table(words, headers[0]["top"])
            
            # Yield cleaned words for this page
            yield {
                "page_number": i,
                "words": words,
                "word_count": len(words)
            }
            
            # Clear page variables to free memory
            del words
            page.flush_cache()
            
            # Trigger garbage collection every 50 pages to prevent memory buildup
            if i > 0 and i % 50 == 0:
                gc.collect()
                self.logger.debug("Garbage collection triggered", page_number=i)