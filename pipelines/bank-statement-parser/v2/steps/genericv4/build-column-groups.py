from v2.base_step import BaseStep
from v2.exceptions import UserFacingError, ErrorMessages


class BuildColumnGroups(BaseStep):
    def __init__(self, context=None, input=None) -> None:
        super().__init__(context, input)

    def is_intersection(
        self, word1: dict, word2: dict, x_tolerance: int = 2
    ) -> tuple[bool, float]:
        # Apply tolerance to expand left boundaries
        x0_1_with_tol, x1_1 = word1["x0"] - x_tolerance, word1["x1"]
        x0_2_with_tol, x1_2 = word2["x0"] - x_tolerance, word2["x1"]

        # Calculate overlap with tolerance applied
        overlap_start = max(x0_1_with_tol, x0_2_with_tol)
        overlap_end = min(x1_1, x1_2)
        overlap_width = max(0, overlap_end - overlap_start)

        # Calculate percentage as overlap divided by smaller width
        # This gives 100% when one word fully contains/is contained by another
        word1_width = x1_1 - x0_1_with_tol
        word2_width = x1_2 - x0_2_with_tol
        smaller_width = min(word1_width, word2_width)
        
        # Avoid division by zero and cap at 100%
        if smaller_width > 0:
            percentage = min(1.0, overlap_width / smaller_width)
        else:
            percentage = 0.0

        # Check if there's an overlap
        is_overlapping = overlap_width > 0

        return is_overlapping, percentage

    def create_header_groups(self, headers, words, column_ranges):
        header_groups = {}
        unidentified_words = []
        for header in headers:
            header_groups[header["text"]] = []
        for word in words:
            max_overlap_header = None
            max_overlap_percentage = 0
            for header in headers:
                if header["text"] not in column_ranges:
                    continue
                x0 = column_ranges[header["text"]][0]
                x1 = column_ranges[header["text"]][1]
                header["x0"] = x0
                header["x1"] = x1
                is_overlapping, percentage_overlap = self.is_intersection(word, header)
                if is_overlapping and percentage_overlap > max_overlap_percentage:
                    max_overlap_header = header
                    max_overlap_percentage = percentage_overlap
            if max_overlap_header is not None:
                header_groups[max_overlap_header["text"]].append(word)
            else:
                unidentified_words.append(word)
        return header_groups

    def run(self):
        """Build column groups from cleaned data, headers, and column ranges."""
        self.logger.info("Building column groups from cleaned data")
        
        # Get headers data (single result from header extraction)
        headers_data = None
        for item in self.read_input_streaming("headers"):
            headers_data = item
            break
        
        if not headers_data:
            raise UserFacingError(ErrorMessages.HEADERS_NOT_FOUND.value)
        
        headers = headers_data["headers"]
        
        # Create iterators for both input streams
        clean_data_stream = self.read_input_streaming("clean_data")
        column_range_stream = self.read_input_streaming("column_range")
        
        # Process page-by-page, matching clean_data with column_range by page_number
        column_range_buffer = {}  # Small buffer for out-of-order pages
        
        for clean_data_item in clean_data_stream:
            page_no = clean_data_item["page_number"]
            words = clean_data_item["words"]
            
            # Find matching column range for this page
            page_column_range = None
            
            # Check buffer first
            if page_no in column_range_buffer:
                page_column_range = column_range_buffer.pop(page_no)
            else:
                # Read from column_range stream until we find matching page
                for column_data in column_range_stream:
                    col_page_no = column_data["page_number"]
                    if col_page_no == page_no:
                        page_column_range = column_data["column_range"]
                        break
                    else:
                        # Store in buffer for later use
                        column_range_buffer[col_page_no] = column_data["column_range"]
                        # Keep buffer small to prevent memory issues
                        if len(column_range_buffer) > 10:
                            # Remove oldest entries
                            min_page = min(column_range_buffer.keys())
                            del column_range_buffer[min_page]
            
            if page_column_range is None:
                self.logger.warning("No column range found for page, using empty dict", page_number=page_no)
                page_column_range = {}
            
            # Get headers for this page (use same headers for all pages)
            page_headers = headers
            
            # Build header groups for this page
            header_groups = self.create_header_groups(
                page_headers, words, page_column_range
            )
            
            # Yield results for this page
            yield {
                "page_number": page_no,
                "header_groups": header_groups,
                "word_count": len(words)
            }
            
            # Clear variables to free memory
            del words, page_column_range, header_groups