from v2.base_step import BaseStep
from utils.constants import PARTICULARS
from utils.stats import calculate_y_merge_tolerance
import gc

class BuildRows(BaseStep):
    def __init__(self, context=None, input=None) -> None:
        super().__init__(context, input)
        self.horizontal_lines = []

    def _crosses_horizontal(self, bottom_y: float, top_y: float) -> bool:
        """
        Return True if there is any horizontal line whose y‐coordinate
        sits strictly between bottom_y and top_y.
        """
        for line in self.horizontal_lines:
            y_line = line["y0"]  # or line["y1"], depending on your coords
            if bottom_y < y_line < top_y:
                return True
        return False

    def group_rows(
        self,
        header_groups,
        y_tolerance: int = 0,
    ):
        for key, words in header_groups.items():
            is_particulars = (
                key == PARTICULARS or True
            )  # making it true for now: sbi bank statement
            # if key!="particulars":
            #     continue
            words = sorted(words, key=lambda w: w["top"])
            curr_sentence = None
            merged_words = []
            y_bottom = None
            for w in words:
                if curr_sentence is None:
                    curr_sentence = w.copy()
                    y_bottom = w["bottom"]
                else:
                    close_vertically = (
                        abs(w["top"] - y_bottom) <= y_tolerance
                        or abs(w["bottom"] - y_bottom) <= y_tolerance
                    )
                    no_horizontal = not self._crosses_horizontal(y_bottom, w["top"])
                    if is_particulars and (close_vertically and no_horizontal):
                        curr_sentence["text"] += " " + w["text"]
                        curr_sentence["bottom"] = max(
                            curr_sentence["bottom"], w["bottom"]
                        )
                        y_bottom = curr_sentence["bottom"]
                    else:
                        merged_words.append(curr_sentence)
                        curr_sentence = w
                        y_bottom = w["bottom"]
            merged_words.append(curr_sentence)
            header_groups[key] = merged_words
        return header_groups

    def is_intersection(self, row_bounds: dict, word: dict, y_tolerance: float) -> bool:
        """
        Check if a word intersects with a row's y-range with tolerance.
        
        Args:
            row_bounds: Dict with 'top' and 'bottom' keys representing row's current bounds
            word: Word dict with 'top' and 'bottom' keys
            y_tolerance: Tolerance for considering intersection
            
        Returns:
            bool: True if word intersects with row range (with tolerance)
        """
        # Expand row bounds by tolerance
        row_top_with_tolerance = row_bounds["top"] - y_tolerance
        row_bottom_with_tolerance = row_bounds["bottom"] + y_tolerance
        
        # Check if word's vertical range intersects with row's expanded range
        # Word intersects if its top is above row's bottom OR its bottom is below row's top
        # (both with tolerance applied)
        word_intersects = not (word["bottom"] < row_top_with_tolerance or 
                               word["top"] > row_bottom_with_tolerance)
        
        return word_intersects
    
    def update_row_bounds(self, row_bounds: dict, word: dict) -> dict:
        """
        Update row bounds to include the new word.
        
        Args:
            row_bounds: Current row bounds with 'top' and 'bottom'
            word: Word to add to row
            
        Returns:
            dict: Updated row bounds
        """
        row_bounds["top"] = min(row_bounds["top"], word["top"])
        row_bounds["bottom"] = max(row_bounds["bottom"], word["bottom"])
        return row_bounds

    def create_rows_json(self, header_groups: dict, y_tolerance: int = 3):
        # Step 1: Flatten and tag items with header
        all_items = []
        for header, items in header_groups.items():
            for item in items:
                if item is None:
                    continue
                item["header"] = header
                all_items.append(item)

        # Step 2: Sort by top position
        all_items.sort(key=lambda x: x["top"])

        # Step 3: Group into rows based on vertical alignment
        rows = []
        row_bounds_list = []  # Keep track of each row's bounds
        
        for item in all_items:
            added = False
            for i, (row, row_bounds) in enumerate(zip(rows, row_bounds_list)):
                # Check if this item intersects with this row
                if self.is_intersection(row_bounds, item, y_tolerance):
                    row.append(item)
                    # Update row bounds to include this new item
                    self.update_row_bounds(row_bounds, item)
                    added = True
                    break
            
            if not added:
                # Create new row with this item
                rows.append([item])
                # Initialize bounds for new row
                row_bounds_list.append({
                    "top": item["top"],
                    "bottom": item["bottom"]
                })

        # Step 4: Build final row dicts
        result = []
        for row in rows:
            row_dict = {}
            y_top = float('inf')
            y_bottom = float('-inf')
            x_left = float('inf')
            x_right = float('-inf')
            
            for item in row:
                y_top = min(y_top, item["top"])
                y_bottom = max(y_bottom, item["bottom"])
                x_left = min(x_left, item["x0"])
                x_right = max(x_right, item["x1"])
                if item["header"] in row_dict:
                    # Merge multiline entries
                    row_dict[item["header"]] += " " + item["text"]
                else:
                    row_dict[item["header"]] = item["text"]
            
            row_dict["y_top"] = y_top
            row_dict["y_bottom"] = y_bottom
            row_dict["x_left"] = x_left
            row_dict["x_right"] = x_right
            result.append(row_dict)

        return result

    def filter_lines_above_threshold(self, lines, y_threshold):
        return [line for line in lines if line["bottom"] > y_threshold]
    
    def calculate_dynamic_y_tolerance(self, words_or_groups):
        """
        Calculate dynamic y-tolerance based on word distribution statistics.
        
        Args:
            words_or_groups: Either a list of words or dict of header groups
            
        Returns:
            float: Calculated y-tolerance value
        """
        # If it's a dict of header groups, flatten to get all words
        # we only consider particulars since that is most likely to be tightly packed
        if isinstance(words_or_groups, dict):
            all_words = []
            for header, words in words_or_groups.items():
                if header != PARTICULARS:
                    continue
                all_words.extend(words)
        else:
            all_words = words_or_groups
        
        if not all_words:
            self.logger.warning("No words provided for tolerance calculation, using default")
            return 2.0
        
        # Calculate tolerance using statistical analysis
        tolerance = calculate_y_merge_tolerance(all_words)
        
        self.logger.info("Calculated dynamic y-tolerance", 
                        tolerance=tolerance)        
        return tolerance

    def run(self):
        """Build rows from header groups, streaming results page by page."""
        self.logger.info("Building rows from header groups")
        
        # Process header groups from input stream
        for header_group_data in self.read_input_streaming("header_groups"):
            page_no = header_group_data["page_number"]
            column_data = header_group_data["header_groups"]
            
            self.logger.debug("Building rows for page", page_number=page_no)
            
            # Calculate dynamic y_tolerance based on word distribution
            y_tolerance = self.calculate_dynamic_y_tolerance(column_data)
            print("YTOLERANCE", y_tolerance)
            
            # Use the dynamically calculated tolerance
            grouped_rows = self.group_rows(column_data, y_tolerance)
            rows = self.create_rows_json(grouped_rows, y_tolerance)
            # Yield rows for this page
            yield {
                "page_number": page_no,
                "rows": rows,
                "row_count": len(rows)
            }
            
            # Clear variables to free memory
            del column_data, grouped_rows, rows
            
            # Trigger garbage collection every 50 pages to prevent memory buildup
            if page_no > 0 and page_no % 50 == 0:
                gc.collect()
                self.logger.debug("Garbage collection triggered", page_number=page_no)
