from copy import deepcopy
import math
from typing import Tuple
import gc
from v2.base_step import BaseStep

class ExtractColumnRange(BaseStep):
    def __init__(self, context=None, input=None) -> None:
        super().__init__(context, input)

    def filter_lines_above_threshold(self, lines, y_threshold):
        return [line for line in lines if line["bottom"] > y_threshold]

    def is_intersection(self, word1: dict, word2: dict, x_tolarance: int = 0):
        x0_1, x1_1 = word1["x0"] - x_tolarance, word1["x1"] + x_tolarance
        x0_2, x1_2 = word2["x0"] - x_tolarance, word2["x1"] + x_tolarance

        # Check if the bounding boxes overlap on the x-axis with tolerance
        return not (x1_1 <= x0_2 or x1_2 <= x0_1)

    def get_column_range_based_on_lines(self, headers: list, vertical_lines: list):
        if vertical_lines is None or len(vertical_lines) < len(headers) - 1:
            return None

        # Sort vertical lines by x-position
        sorted_lines = sorted(vertical_lines, key=lambda line: line["x0"])

        header_ranges = {}

        for idx, header in enumerate(headers):
            header_center = (header["x0"] + header["x1"]) / 2

            # Find vertical line to the left and right of header center
            left_line = None
            right_line = None

            for i in range(len(sorted_lines) - 1):
                left = sorted_lines[i]["x0"]
                right = sorted_lines[i + 1]["x0"]
                if left <= header_center <= right:
                    left_line = left
                    right_line = right
                    break

            # Fallback if no enclosing lines found
            if left_line is None:
                left_line = header["x0"]
            if right_line is None:
                right_line = header["x1"]

            header_ranges[header.get("text")] = [left_line, right_line]

        return header_ranges

    def get_header_alignment(self, header_range, headers):
        """
        Determine the alignment of headers based on their position within their column ranges.

        Args:
            header_range: dict mapping header text to [x0, x1] ranges
            headers: list of header dictionaries with 'text', 'x0', 'x1' keys

        Returns:
            str: 'left', 'right', or 'center'
        """
        if not header_range or not headers:
            return "center"  # default fallback

        left_alignment_score = 0
        right_alignment_score = 0
        center_alignment_score = 0
        total_headers = 0

        for header in headers:  # headers should be iterable, not .items()
            header_text = header["text"]
            if header_text not in header_range:
                continue

            total_headers += 1
            hx0 = header["x0"]  # header left boundary
            hx1 = header["x1"]  # header right boundary
            rx0 = header_range[header_text][0]  # column range left
            rx1 = header_range[header_text][1]  # column range right

            # Calculate distances from header boundaries to column boundaries
            left_distance = abs(hx0 - rx0)  # distance from header left to column left
            right_distance = abs(
                hx1 - rx1
            )  # distance from header right to column right

            # Calculate header center and column center
            header_center = (hx0 + hx1) / 2
            column_center = (rx0 + rx1) / 2
            center_distance = abs(header_center - column_center)

            # Determine alignment based on minimum distance
            tolerance = 3  # pixels

            if (
                left_distance <= tolerance
                and left_distance <= right_distance
                and left_distance <= center_distance
            ):
                left_alignment_score += 1
            elif (
                right_distance <= tolerance
                and right_distance <= left_distance
                and right_distance <= center_distance
            ):
                right_alignment_score += 1
            elif (
                center_distance <= tolerance
                and center_distance <= left_distance
                and center_distance <= right_distance
            ):
                center_alignment_score += 1
            else:
                # If no clear alignment, determine by smallest distance
                min_distance = min(left_distance, right_distance, center_distance)
                if min_distance == left_distance:
                    left_alignment_score += 1
                elif min_distance == right_distance:
                    right_alignment_score += 1
                else:
                    center_alignment_score += 1

        if total_headers == 0:
            return "center"

        # Return the alignment with the highest score
        if (
            left_alignment_score > right_alignment_score
            and left_alignment_score > center_alignment_score
        ):
            return "left"
        elif (
            right_alignment_score > left_alignment_score
            and right_alignment_score > center_alignment_score
        ):
            return "right"
        else:
            return "center"

    def _is_valid_word(self, word, page_height):
        footer_y_threshold = page_height * (1 - 0.06)
        if word["top"] >= footer_y_threshold:
            return False
        return True

    def check_range_validity(self, column_ranges, header_text, range):
        for key, value in column_ranges.items():
            if key != header_text:
                # Convert list [x0, x1] to dict format expected by is_intersection
                value_dict = {"x0": value[0], "x1": value[1]}
                if self.is_intersection(range, value_dict):
                    return False
        return True
    def get_column_range(self, words, headers, height, line_threshold=10):
        header_range = {}
        curr_y_bottom = max(h["bottom"] for h in headers) if headers else 0
        num_of_lines_iterated = 0
        for word in words:
            y_bottom = max(word["bottom"], curr_y_bottom)
            if y_bottom > curr_y_bottom:
                num_of_lines_iterated += 1
                curr_y_bottom = y_bottom
            if not self._is_valid_word(word, height):
                continue
            for header in headers:
                if self.is_intersection(word, header):
                    x = header_range.get(header["text"], [1000000, -1000000])
                    x0_r = min(word["x0"], header["x0"], x[0])
                    x1_r = max(word["x1"], header["x1"], x[1])
                    if not self.check_range_validity(header_range, header["text"], {"x0": x0_r, "x1": x1_r}) and num_of_lines_iterated > line_threshold:
                        # table might have been ended, stop iterating
                        break
                    header_range[header["text"]] = [x0_r, x1_r]
        return header_range

    def adjust_missing_ranges(
        self, headers: list, col_ranges: dict
    ) -> Tuple[dict, str]:
        """Adjust column ranges for all headers based on shared alignment."""
        adjusted = {}
        dominant_align = self.get_header_alignment(col_ranges, headers)
        for i, header in enumerate(headers):
            name = header["text"]
            x0, x1 = header["x0"], header["x1"]
            current_range = col_ranges.get(name)

            if current_range:
                adjusted[name] = current_range
                continue

            # Adjust based on dominant alignment
            if dominant_align == "left" and i + 1 < len(headers):
                next_header = headers[i + 1]
                next_header_x0 = next_header["x0"]
                if next_header["text"] in col_ranges:
                    range_next_header = col_ranges[next_header["text"]]
                    next_header_x0 = range_next_header[0]
                adjusted[name] = (x0, max(next_header_x0, x1))
            elif dominant_align == "right" and i > 0:
                prev_header = headers[i - 1]
                prev_header_x1 = prev_header["x1"]
                if prev_header["text"] in col_ranges:
                    range_prev_header = col_ranges[prev_header["text"]]
                    prev_header_x1 = range_prev_header[1]
                adjusted[name] = (min(prev_header_x1, x0), x1)
            else:
                # center or full alignment fallback
                adjusted[name] = (x0, x1)

        return adjusted, dominant_align

    def adjust_start_and_end_header_range(self, headers: list, col_ranges: dict):
        headers_sorted = sorted(headers, key=lambda h: h["x0"])
        if len(headers_sorted) <= 0:
            return

        first_key = headers_sorted[0]["text"]
        last_key = headers_sorted[-1]["text"]

        # Replace the tuple with a new one
        if first_key in col_ranges:
            _, end = col_ranges[first_key]
            col_ranges[first_key] = (-100000, end)

        if last_key in col_ranges:
            start, _ = col_ranges[last_key]
            col_ranges[last_key] = (start, 100000)
    def correct_overlapped_headers(self, headers, column_range):
        # make sure that column range x1 of a header does not exceed the x0 of next header
        for i in range(len(headers) - 1):
            if column_range[headers[i]["text"]][1] > headers[i + 1]["x0"]:
                column_range[headers[i]["text"]] = (column_range[headers[i]["text"]][0], math.floor(headers[i + 1]["x0"]))
                header_text = headers[i]["text"]
        return column_range


    def update_page_headers_x(self, headers, column_range):
        if column_range is not None:
            for header in headers:
                header["x0"] = column_range[header["text"]][0]
                header["x1"] = column_range[header["text"]][1]
    def is_header_list_copy(self,headers):
        for header in headers:
            if header.get("is_copy",False):
                return True
        return False


    def run(self):
        """Extract column ranges for each page, streaming results page by page."""
        pdf_doc = self.context["pdf"]
        
        self.logger.info("Starting column range extraction")
        
        # Get headers from input stream
        headers_data = None
        for item in self.read_input_streaming("headers"):
            headers_data = item
            break  # Headers step produces single result
        
        if not headers_data:
            raise ValueError("No headers data found")
        
        headers = headers_data["headers"]
        previous_column_range = None
        
        # Iterate through clean_data stream instead of PDF pages
        for clean_data_item in self.read_input_streaming("clean_data"):
            page_number = clean_data_item["page_number"]
            words = clean_data_item["words"]
            
            self.logger.debug("Extracting column range for page", page_number=page_number)
            
            # Get page dimensions from PDF for this specific page
            page = pdf_doc.pages[page_number]
            vertical_lines = page.vertical_edges
            height = page.height
            
            # Handle header copy detection
            if self.is_header_list_copy(headers) and page_number > 0 and previous_column_range:
                column_range = deepcopy(previous_column_range)
                # Headers remain the same for copied pages
            else:
                upper_cut_y = headers[0]["top"] if headers and page_number==0 else 0
                filtered_vertical_lines = self.filter_lines_above_threshold(
                    vertical_lines, upper_cut_y
                )
                # Try line-based column range first
                column_range = self.get_column_range_based_on_lines(
                    headers, filtered_vertical_lines
                )
                
                # Fallback to word-based detection if needed
                if column_range is None or len(column_range.keys()) == 0:
                    column_range = self.get_column_range(words, headers, height)
                    column_range, dominant_alignment = self.adjust_missing_ranges(
                        headers, column_range
                    )
                
                self.adjust_start_and_end_header_range(headers, column_range or {})
                column_range = self.correct_overlapped_headers(headers, column_range or {})
            previous_column_range = column_range
            
            # Yield column range for this page
            yield {
                "page_number": page_number,
                "column_range": column_range,
                "headers": headers,
                "vertical_lines_count": len(vertical_lines)
            }
            page.flush_cache()
            # Clear local variables to free memory
            del words, vertical_lines, height, column_range
            
            # Trigger garbage collection every 50 pages to prevent memory buildup
            if page_number > 0 and page_number % 50 == 0:
                gc.collect()
                self.logger.debug("Garbage collection triggered", page_number=page_number)
