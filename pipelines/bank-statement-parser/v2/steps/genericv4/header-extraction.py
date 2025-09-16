from typing import List, Dict, Tuple
from collections import defaultdict
import re

from v2.base_step import BaseStep

class HeaderExtraction(BaseStep):
    def __init__(self, context=None, input=None) -> None:
        super().__init__(context, input)

    def _get_header_keywords(self):
        """Extended header keywords for better detection"""
        HEADER_KEYWORDS = {
            # Common headers
            "date", "description", "amount", "balance",
            "debit", "credit", "reference", "transaction",
            "details", "particulars", "deposit", "withdrawal",
            "memo", "check", "cheque", "cr", "dr",
            # Additional keywords
            "narration", "remarks", "type", "mode",
            "value", "running", "opening", "closing",
            "txn", "ref", "no", "number", "serial",
            "posted", "effective", "available"
        }
        return HEADER_KEYWORDS

    def calculate_column_boundaries(self, words: List[dict]) -> List[Tuple[float, float]]:
        """Detect natural column boundaries based on word clustering"""
        if not words:
            return []
        
        # Collect all x-positions
        x_positions = []
        for word in words:
            x_positions.append(word["x0"])
            x_positions.append(word["x1"])
        
        x_positions.sort()
        
        # Find gaps between words to identify columns
        gaps = []
        for i in range(1, len(x_positions)):
            gap = x_positions[i] - x_positions[i-1]
            if gap > 10:  # Minimum gap to consider as column separator
                gaps.append((x_positions[i-1], x_positions[i], gap))
        
        # Identify significant gaps (larger than median)
        if gaps:
            gap_sizes = [g[2] for g in gaps]
            median_gap = sorted(gap_sizes)[len(gap_sizes)//2]
            
            column_boundaries = []
            last_end = 0
            
            for start, end, gap_size in gaps:
                if gap_size > median_gap * 1.5:  # Significant gap
                    column_boundaries.append((last_end, start))
                    last_end = end
            
            # Add final column
            if x_positions:
                column_boundaries.append((last_end, max(x_positions)))
            
            return column_boundaries
        
        return [(min(x_positions), max(x_positions))] if x_positions else []

    def merge_header_text_horizontally(self, headers: List[dict], adaptive_tolerance: bool = True) -> List[dict]:
        """Merge horizontally adjacent header texts with adaptive tolerance"""
        if not headers:
            return headers

        x_sorted_headers = sorted(headers, key=lambda h: h["x0"])
        
        # Calculate adaptive tolerance based on average character width
        if adaptive_tolerance and len(headers) > 1:
            avg_char_width = sum(
                (h["x1"] - h["x0"]) / max(len(h["text"]), 1) 
                for h in headers
            ) / len(headers)
            x_tolerance = avg_char_width * 2  # Two character widths
        else:
            x_tolerance = 6
        
        merged_headers = []
        current_header = dict(x_sorted_headers[0])

        for i in range(1, len(x_sorted_headers)):
            header = x_sorted_headers[i]
            gap = header["x0"] - current_header["x1"]
            
            # Merge if gap is small AND they're likely part of same column
            if gap <= x_tolerance and gap >= -2:  # Allow slight overlap
                current_header["text"] += " " + header["text"]
                current_header["x1"] = header["x1"]
            else:
                merged_headers.append(current_header)
                current_header = dict(header)

        merged_headers.append(current_header)
        return merged_headers

    def detect_multiline_header_region(self, words: List[dict], seed_row: List[dict]) -> List[dict]:
        """Detect if headers span multiple lines based on content analysis"""
        if not seed_row:
            return seed_row
        
        seed_top = min(w["top"] for w in seed_row)
        seed_bottom = max(w["bottom"] for w in seed_row)
        avg_height = sum(w["height"] for w in seed_row) / len(seed_row)
        
        # Look for words immediately above and below the seed row
        adjacent_words = []
        
        for word in words:
            word_top = word["top"]
            word_text = word["text"].strip()
            
            # Check if word is directly above (within half a line height for tight grouping)
            # Headers above are more likely to be legitimate multi-line headers
            if seed_top - avg_height * 0.8 <= word_top < seed_top - 2:
                # Check if it's likely a header continuation
                if self._is_likely_header_word(word):
                    adjacent_words.append(word)
            
            # Check if word is directly below - BE VERY STRICT HERE
            # Only include words that are VERY close (within 0.3 line height)
            # This prevents data rows from being included
            elif seed_bottom + 2 < word_top <= seed_bottom + avg_height * 0.3:
                # Be EXTREMELY strict for words below - they're almost always data
                # Don't include if it's a number, date, currency, or transaction code
                is_number = re.match(r'^-?[\d,]+\.?\d*$', word_text)
                is_date = re.match(r'^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$', word_text)
                is_currency = re.match(r'^[₹$£€]\s*[\d,]+\.?\d*$', word_text)
                is_transaction_code = re.match(r'^(DR|CR)$', word_text, re.IGNORECASE)
                
                # Additional check: if the word appears in a context phrase (like "Opening Balance"),
                # it's likely data, not a header continuation
                is_contextual_phrase = any(prefix in word_text.lower() for prefix in ['opening', 'closing', 'available', 'current'])
                
                # Only include if it's clearly a header word and NOT data
                if not (is_number or is_date or is_currency or is_transaction_code or is_contextual_phrase):
                    # For words below, require them to be in the same column as a header above
                    # This helps ensure we're getting legitimate multi-line headers
                    word_x_center = (word.get("x0", 0) + word.get("x1", 0)) / 2
                    is_aligned = any(
                        abs(word_x_center - (w.get("x0", 0) + w.get("x1", 0)) / 2) < avg_height * 2
                        for w in seed_row
                    )
                    
                    if is_aligned and self._is_likely_header_word(word):
                        # Extra check: ensure it has alphabetic content and is short
                        if re.search(r'[A-Za-z]', word_text) and len(word_text) < 20:
                            adjacent_words.append(word)
        
        return seed_row + adjacent_words

    def _is_likely_header_word(self, word: dict) -> bool:
        """Check if a word is likely to be part of a header"""
        text = word["text"].lower()
        text_original = word["text"]
        
        # First, reject if it looks like data
        data_patterns = [
            r'^\d{2,4}[-/]\d{2}[-/]\d{2,4}$',  # Dates
            r'^[₹$£€]\s*[\d,]+\.?\d*$',  # Currency amounts
            r'^-?[\d,]+\.?\d*$',  # Plain numbers (likely amounts)
            r'^\d+$',  # Any pure number
        ]
        
        # Special case: DR/CR alone (without slash) is likely data, not header
        # But "Dr/Cr" or "Dr / Cr" with slash is a header
        if re.match(r'^(DR|CR)$', text_original, re.IGNORECASE) and '/' not in text_original:
            return False
        
        for pattern in data_patterns:
            if re.match(pattern, text_original):
                return False
        
        # Reject common data row prefixes that might contain header keywords
        # e.g., "Opening Balance", "Closing Balance", "Available Balance"
        # Also reject these words standalone as they're typically data context
        data_prefixes = ['opening', 'closing', 'available', 'current', 'total', 'sub']
        if text in data_prefixes:
            return False
        for prefix in data_prefixes:
            if text.startswith(prefix + ' ') and any(kw in text for kw in ['balance', 'amount']):
                return False
        
        # Check for header keywords - must be a strong match
        header_keywords = self._get_header_keywords()
        
        # For single-word exact match with keyword - this is likely a header
        if text in header_keywords and ' ' not in text:
            return True
        
        # For multi-word phrases, be more careful
        # "Opening Balance" contains "balance" but is likely data
        # "Balance" alone is likely a header
        if ' ' in text:
            # Multi-word phrases need stronger evidence
            # Check if it's a header-like phrase
            header_phrases = [
                'transaction date', 'value date', 'posting date',
                'transaction details', 'transaction description',
                'debit amount', 'credit amount', 'running balance',
                'reference number', 'cheque number', 'transaction id'
            ]
            if text in header_phrases:
                return True
            
            # Otherwise, multi-word phrases with header keywords are suspicious
            # They're more likely to be data (like "Opening Balance")
            return False
        
        # Check if the text contains a keyword as a whole word (not just substring)
        for keyword in header_keywords:
            # Use word boundaries to ensure we're matching whole words
            # But be careful with multi-word contexts
            if re.search(r'\b' + re.escape(keyword) + r'\b', text):
                # Additional check: make sure it's not part of a larger phrase
                if len(text.split()) == 1:  # Single word containing keyword
                    return True
        
        # Check for common header patterns (but be more restrictive)
        header_patterns = [
            r'^(no\.?|#)$',  # Number indicators
            r'^[(\[].*[)\]]$',  # Parenthetical text (but must have content)
        ]
        
        for pattern in header_patterns:
            if re.match(pattern, text, re.IGNORECASE):
                # Additional check: ensure it's not just a number in parentheses
                if not re.match(r'^[(\[]?\d+[)\]]?$', text_original):
                    return True
        
        return False

    def merge_multiline_headers_by_column(self, headers: List[dict]) -> List[dict]:
        """Merge headers vertically by detecting column alignment"""
        if not headers:
            return headers
        
        # Detect column boundaries
        column_boundaries = self.calculate_column_boundaries(headers)
        
        # Group headers by column
        columns = defaultdict(list)
        for header in headers:
            x_center = (header["x0"] + header["x1"]) / 2
            
            # Find which column this header belongs to
            for i, (col_start, col_end) in enumerate(column_boundaries):
                if col_start <= x_center <= col_end:
                    columns[i].append(header)
                    break
        
        # Merge headers within each column
        merged_headers = []
        for col_headers in columns.values():
            if not col_headers:
                continue
            
            # Sort by vertical position
            col_headers.sort(key=lambda h: h["top"])
            
            # Merge consecutive headers in the column
            current_header = dict(col_headers[0])
            for i in range(1, len(col_headers)):
                header = col_headers[i]
                
                # Check vertical gap
                gap = header["top"] - current_header["bottom"]
                
                # Check if the text to be merged is likely data, not a header
                header_text = header["text"].strip()
                is_number = re.match(r'^-?[\d,]+\.?\d*$', header_text)  # Pure number
                is_date = re.match(r'^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$', header_text)  # Date pattern
                is_currency = re.match(r'^[₹$£€]\s*[\d,]+\.?\d*$', header_text)  # Currency
                is_single_digit = re.match(r'^\d$', header_text)  # Single digit (like row numbers)
                is_transaction_code = re.match(r'^(DR|CR)$', header_text, re.IGNORECASE)  # DR/CR as standalone data
                
                # Don't merge if it looks like data
                if is_number or is_date or is_currency or is_single_digit or is_transaction_code:
                    merged_headers.append(current_header)
                    current_header = dict(header)
                    continue
                
                # Merge if gap is reasonable (less than one line height) AND it's not data
                avg_height = (current_header["height"] + header["height"]) / 2
                if 0 <= gap <= avg_height * 0.5:
                    # Only merge if the new text adds value (not just punctuation or very short)
                    if len(header_text) > 1 and not header_text in ['/', '-', '|', '(', ')']:
                        current_header["text"] += " " + header["text"]
                        # Don't update bottom to preserve original header boundary
                        # This helps keep data rows separate
                        # current_header["bottom"] = header["bottom"]  # Commented out
                else:
                    merged_headers.append(current_header)
                    current_header = dict(header)
            
            merged_headers.append(current_header)
        
        return merged_headers
    def not_a_number(self, text: str) -> bool:
        return not re.match(r'^[\d,]+\.?\d*$', text)

    def filter_and_clean_headers(self, headers: List[dict]) -> List[dict]:
        """Filter out non-header content and clean up text"""
        filtered = []
        
        for header in headers:
            text = header["text"].strip()
            
            # Must have alphabetic content
            if not re.search(r'[A-Za-z]', text):
                continue
            
            # Skip if it looks like data row content
            if re.match(r'^[\d,]+\.?\d*$', text):  # Pure numbers
                continue
            
            # Skip very long text (likely descriptions from data rows)
            if len(text) > 50:
                continue
            
            # Clean up the text
            header["text"] = text
            filtered.append(header)
        
        return filtered

    def score_header_row(self, row_words: List[dict], page_width: float = 600) -> float:
        """Enhanced scoring for header row detection"""
        header_keywords = self._get_header_keywords()
        score = 0
        
        # Strong bonus for multiple header keywords
        keyword_matches = 0
        for word in row_words:
            text_lower = word["text"].lower()
            # Check for exact matches and partial matches
            if text_lower in header_keywords:
                keyword_matches += 2
            elif any(keyword in text_lower for keyword in header_keywords):
                keyword_matches += 1
        
        score += keyword_matches * 10
        
        # Bonus for appropriate number of columns (3-8 is typical)
        num_words = len(row_words)
        if 3 <= num_words <= 8:
            score += 15
        elif num_words > 8:
            score -= 5  # Penalty for too many words (might be data row)
        
        # Bonus for good horizontal distribution
        if num_words >= 2:
            x_positions = [word["x0"] for word in row_words]
            coverage = (max(x_positions) - min(x_positions)) / page_width
            if coverage > 0.6:  # Covers more than 60% of page width
                score += 10
        
        # Check for header patterns
        row_text = " ".join([word["text"].lower() for word in row_words])
        
        # Strong indicators
        if "date" in row_text and ("amount" in row_text or "debit" in row_text or "credit" in row_text):
            score += 20
        
        if "balance" in row_text:
            score += 10
        
        # Penalty for data-like content
        numbers_count = sum(1 for word in row_words if re.match(r'^[\d,]+\.?\d*$', word["text"]))
        if numbers_count > len(row_words) * 0.5:  # More than 50% numbers
            score -= 15
        
        # Penalty for date-like content in multiple words
        date_count = sum(1 for word in row_words if re.match(r'^\d{2}[-/]\d{2}[-/]\d{2,4}$', word["text"]))
        if date_count > 1:
            score -= 20
        
        return score

    def _extract_headers(self, words: List[dict], page_num: int) -> List[dict]:
        """Main header extraction with improved logic"""
        if not words:
            return []
        
        # Group words into rows
        rows = self._group_words_into_rows(words, tolerance=5.0)
        
        # Find and score potential header rows
        header_candidates = []
        for row_top, row_words in rows.items():
            row_words.sort(key=lambda w: w["x0"])
            
            # Quick check if row has any header indicators
            has_keyword = any(
                word["text"].lower() in self._get_header_keywords() 
                for word in row_words
            )
            
            if has_keyword or len(row_words) >= 3:  # Consider rows with multiple columns
                score = self.score_header_row(row_words)
                if score > 0:
                    header_candidates.append((score, row_top, row_words))
        
        if not header_candidates:
            return []
        
        # Sort by score
        header_candidates.sort(key=lambda x: x[0], reverse=True)
        
        # Take the best candidate
        best_score, best_top, best_row = header_candidates[0]
        
        # Only consider multiline if score is high enough
        if best_score > 30:  # Strong header candidate
            # Check for multiline headers
            extended_words = self.detect_multiline_header_region(words, best_row)
            
            # First merge horizontally
            merged_horizontal = self.merge_header_text_horizontally(extended_words, adaptive_tolerance=True)
            
            # Then merge vertically by column if needed
            if len(extended_words) > len(best_row):
                final_headers = self.merge_multiline_headers_by_column(merged_horizontal)
            else:
                final_headers = merged_horizontal
        else:
            # Just merge horizontally for weak candidates
            final_headers = self.merge_header_text_horizontally(best_row, adaptive_tolerance=True)
        
        # Filter and clean
        return self.filter_and_clean_headers(final_headers)

    def _group_words_into_rows(self, words: List[dict], tolerance: float) -> Dict[float, List[dict]]:
        """Group words into rows with given tolerance"""
        if not words:
            return {}
        
        sorted_words = sorted(words, key=lambda w: w["top"])
        rows = {}
        
        for word in sorted_words:
            assigned = False
            for existing_top in list(rows.keys()):
                if abs(word["top"] - existing_top) <= tolerance:
                    rows[existing_top].append(word)
                    assigned = True
                    break
            
            if not assigned:
                rows[word["top"]] = [word]
        
        return rows

    def run(self):
        """Extract headers from the first page with text"""
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
            
            # Extract headers from first page with content
            self.logger.info("Extracting headers from first page with content", page_number=i)
            words = sorted(words, key=lambda w: (w["top"], w["x0"]))
            headers = self._extract_headers(words, i)
            
            yield {
                "headers": headers,
                "source_page": i,
                "total_words": total_words
            }
            return
        
        if total_words == 0:
            raise Exception("PDF is likely image-based - no extractable text found")