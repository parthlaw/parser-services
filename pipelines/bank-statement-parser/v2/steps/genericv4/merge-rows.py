from typing import Optional, Any
from v2.base_step import BaseStep


class MergeRows(BaseStep):
    """
    Step to handle all row merging logic including:
    1. Merging incomplete rows with anchor rows (existing logic)
    2. Merging two incomplete rows to form a complete row (new logic)
    """
    
    def __init__(self, context=None, input=None) -> None:
        super().__init__(context, input)

    def is_row_valid(self, row: dict) -> bool:
        """A row is valid if it has both date and balance fields with actual values"""
        date = row.get("date")
        balance = row.get("balance")
        
        # Check if both fields exist and have non-empty values
        if date is None or balance is None:
            return False
        
        # Check if they're not just empty strings
        if isinstance(date, str) and not date.strip():
            return False
        if isinstance(balance, str) and not balance.strip():
            return False
            
        return True
    
    def calculate_row_completeness(self, row: dict) -> float:
        """Calculate how complete a row is (0.0 to 1.0)"""
        important_fields = ["date", "balance", "particulars", "debit", "credit"]
        field_weights = {"date": 0.3, "balance": 0.3, "particulars": 0.2, "debit": 0.1, "credit": 0.1}
        
        score = 0.0
        for field in important_fields:
            value = row.get(field)
            if value and str(value).strip():
                score += field_weights.get(field, 0.1)
        
        return score

    def merge_rows_with_anchors(self, rows: list) -> list:
        """
        Original row merging algorithm that uses anchor-based detection.
        Merges incomplete rows with complete anchor rows.
        """
        self.logger.debug("Row count for anchor detection", total_rows=len(rows))
        if not rows:
            return [],rows
            
        # Sort rows by y_top position to maintain order
        rows.sort(key=lambda x: x.get("y_top", 0))
        
        # First, identify anchor rows (complete transactions)
        anchor_indices = []
        for i, row in enumerate(rows):
            if self.is_row_valid(row):
                anchor_indices.append(i)
        
        if not anchor_indices:
            # No valid anchors found, return as-is
            return [],rows
        
        # Process incomplete rows and merge them with appropriate anchors
        merged_rows = []
        processed_indices = set()
        
        for anchor_idx in anchor_indices:
            anchor_row = rows[anchor_idx].copy()
            processed_indices.add(anchor_idx)
            
            # Find all incomplete rows between this anchor and the next
            next_anchor_idx = None
            for idx in anchor_indices:
                if idx > anchor_idx:
                    next_anchor_idx = idx
                    break
            
            if next_anchor_idx is None:
                next_anchor_idx = len(rows)
            
            # Collect incomplete rows in this segment
            segment_incomplete = []
            for i in range(anchor_idx + 1, next_anchor_idx):
                if i not in processed_indices and not self.is_row_valid(rows[i]):
                    segment_incomplete.append(i)
            
            # Also check incomplete rows before this anchor (if it's the first anchor)
            if anchor_idx == anchor_indices[0]:
                for i in range(0, anchor_idx):
                    if i not in processed_indices and not self.is_row_valid(rows[i]):
                        segment_incomplete.append(i)
            
            # Merge incomplete rows with this anchor based on proximity and content
            for incomplete_idx in segment_incomplete:
                incomplete_row = rows[incomplete_idx]
                
                # Calculate merge confidence
                merge_score = self._calculate_merge_confidence(
                    anchor_row, incomplete_row, anchor_idx, incomplete_idx, rows
                )
                
                # Debugging: Append merge score and both rows to a jsonl file
                # with open("merge_scores.jsonl", "a") as f:
                #     f.write(json.dumps({"merge_score": merge_score, "anchor_row": anchor_row, "incomplete_row": incomplete_row}) + "\n")
                
                # If confidence is high enough, merge
                if merge_score > 0.3:  # Threshold for merging
                    self._smart_merge_row(anchor_row, incomplete_row)
                    processed_indices.add(incomplete_idx)
            
            merged_rows.append(anchor_row)
        
        # Add any remaining unprocessed incomplete rows for potential incomplete-to-incomplete merging
        unprocessed_rows = []
        for i, row in enumerate(rows):
            if i not in processed_indices:
                unprocessed_rows.append(row)
        
        # Return merged rows plus unprocessed rows (will be handled by merge_incomplete_rows)
        return merged_rows, unprocessed_rows

    def merge_incomplete_rows(self, rows: list) -> list:
        """
        New function to merge two incomplete rows that together can form a complete valid row.
        This handles cases where neither row is a valid anchor but together they have all required fields.
        """
        if not rows:
            return rows
        
        # Sort rows by y_top position to maintain order
        rows.sort(key=lambda x: x.get("y_top", 0))
        
        merged_rows = []
        processed_indices = set()
        
        for i, row1 in enumerate(rows):
            if i in processed_indices:
                continue
            
            # Skip if this row is already valid (shouldn't happen but safety check)
            if self.is_row_valid(row1):
                merged_rows.append(row1.copy())
                processed_indices.add(i)
                continue
            
            # Try to find a complementary incomplete row to merge with
            best_match_idx = None
            best_match_score = 0.0
            
            for j, row2 in enumerate(rows):
                if j <= i or j in processed_indices:
                    continue
                
                # Skip if row2 is already valid
                if self.is_row_valid(row2):
                    continue
                
                # Check if merging these two rows would create a valid row
                potential_merged = self._try_merge_incomplete_rows(row1, row2)
                if potential_merged and self.is_row_valid(potential_merged):
                    # Calculate confidence score for this merge
                    merge_score = self._calculate_incomplete_merge_confidence(
                        row1, row2, i, j, rows
                    )
                    
                    if merge_score > best_match_score:
                        best_match_score = merge_score
                        best_match_idx = j
            
            # If we found a good match, merge the rows
            if best_match_idx is not None and best_match_score > 0.4:  # Threshold for incomplete merging
                merged_row = self._try_merge_incomplete_rows(row1, rows[best_match_idx])
                merged_rows.append(merged_row)
                processed_indices.add(i)
                processed_indices.add(best_match_idx)
                
                self.logger.debug(
                    "Merged two incomplete rows",
                    row1_idx=i,
                    row2_idx=best_match_idx,
                    score=best_match_score
                )
            else:
                # No good match found, keep the row as-is
                merged_rows.append(row1.copy())
                processed_indices.add(i)
        
        return merged_rows

    def _try_merge_incomplete_rows(self, row1: dict, row2: dict) -> Optional[dict]:
        """
        Try to merge two incomplete rows into a complete row.
        Returns the merged row if successful, None otherwise.
        """
        merged_row = row1.copy()
        
        # Merge fields from row2 into merged_row
        for key, value in row2.items():
            if key in ["y_top", "y_bottom", "x_left", "x_right"]:
                # Update bounding box to encompass both rows
                if key == "y_top" and value is not None:
                    current = merged_row.get(key)
                    merged_row[key] = min(current, value) if current is not None else value
                elif key == "y_bottom" and value is not None:
                    current = merged_row.get(key)
                    merged_row[key] = max(current, value) if current is not None else value
                elif key == "x_left" and value is not None:
                    current = merged_row.get(key)
                    merged_row[key] = min(current, value) if current is not None else value
                elif key == "x_right" and value is not None:
                    current = merged_row.get(key)
                    merged_row[key] = max(current, value) if current is not None else value
            elif value and str(value).strip():  # Only merge non-empty values
                if key in merged_row and merged_row[key] and str(merged_row[key]).strip():
                    # Both have values - need to decide how to merge
                    if key == "particulars":
                        # For particulars, concatenate
                        merged_row[key] = f"{merged_row[key]} {value}".strip()
                    elif key == "date":
                        # For dates, try to complete partial dates
                        merged = self._try_merge_date(merged_row[key], value)
                        if merged:
                            merged_row[key] = merged
                    # For amounts, prefer non-empty values
                    elif key in ["debit", "credit", "balance"]:
                        # Keep the valid amount if one exists
                        if not self._is_valid_amount(merged_row[key]) and self._is_valid_amount(value):
                            merged_row[key] = value
                else:
                    # merged_row doesn't have this field, use row2's value
                    merged_row[key] = value
        
        return merged_row

    def _calculate_incomplete_merge_confidence(self, row1: dict, row2: dict, 
                                              idx1: int, idx2: int, all_rows: list) -> float:
        """
        Calculate confidence score for merging two incomplete rows.
        """
        score = 0.0
        
        # 1. Check field complementarity (do they have different missing fields?)
        row1_fields = set(k for k, v in row1.items() if v and str(v).strip() and k not in ["y_top", "y_bottom", "x_left", "x_right"])
        row2_fields = set(k for k, v in row2.items() if v and str(v).strip() and k not in ["y_top", "y_bottom", "x_left", "x_right"])
        
        # High score if they have complementary fields
        overlap = row1_fields.intersection(row2_fields)
        union = row1_fields.union(row2_fields)
        
        if union:
            complementarity = 1.0 - (len(overlap) / len(union))
            score += complementarity * 0.3  # 30% weight
        
        # 2. Check if together they form a complete row
        required_fields = {"date", "balance"}
        if required_fields.issubset(union):
            score += 0.3  # 30% weight for having required fields
        
        # 3. Proximity score
        if row1.get("y_top") is not None and row2.get("y_top") is not None:
            y_distance = abs(row1["y_top"] - row2["y_top"])
            avg_height = self._calculate_avg_row_height(all_rows)
            if avg_height > 0:
                normalized_distance = y_distance / avg_height
                proximity_score = max(0, 1.0 - (normalized_distance / 3))
                score += proximity_score * 0.2  # 20% weight
        
        # 4. Sequential position bonus
        if idx2 == idx1 + 1:
            score += 0.15  # 15% bonus for consecutive rows
        elif idx2 == idx1 + 2:
            score += 0.05  # 5% bonus for nearly consecutive
        
        # 5. Penalty for conflicting data
        for field in ["date", "debit", "credit", "balance"]:
            val1 = row1.get(field)
            val2 = row2.get(field)
            
            if val1 and val2 and str(val1).strip() and str(val2).strip():
                # Both have values for the same field
                if field == "date":
                    # Check if they're the same date or can be merged
                    if not self._can_merge_dates(val1, val2):
                        score -= 0.5  # Heavy penalty for conflicting dates
                elif field in ["debit", "credit", "balance"]:
                    # Check if they're different amounts
                    if self._is_valid_amount(val1) and self._is_valid_amount(val2):
                        amount1 = self._parse_amount(val1)
                        amount2 = self._parse_amount(val2)
                        if amount1 != amount2:
                            score -= 0.5  # Heavy penalty for different amounts
        
        return max(0, score)  # Don't go negative

    def _can_merge_dates(self, date1: str, date2: str) -> bool:
        """Check if two date strings can be merged or are compatible"""
        if not date1 or not date2:
            return True
        
        # Check if they're the same
        if date1 == date2:
            return True
        
        # Check if one is a subset of the other
        date1_clean = str(date1).replace(" ", "").replace("-", "").replace("/", "")
        date2_clean = str(date2).replace(" ", "").replace("-", "").replace("/", "")
        
        if date1_clean in date2_clean or date2_clean in date1_clean:
            return True
        
        return False

    def _parse_amount(self, value: Any) -> float:
        """Parse an amount string to float"""
        try:
            return float(str(value).replace(",", "").replace("$", "").strip())
        except (ValueError, AttributeError):
            return 0.0

    def _calculate_merge_confidence(self, anchor_row: dict, incomplete_row: dict, 
                                   anchor_idx: int, incomplete_idx: int, all_rows: list) -> float:
        """
        Calculate confidence score for merging an incomplete row with an anchor row.
        Higher score means higher confidence in merging.
        """
        score = 0.0
        
        # 1. Proximity score (closer is better)
        if anchor_row.get("y_top") is not None and incomplete_row.get("y_top") is not None:
            y_distance = abs(anchor_row["y_top"] - incomplete_row["y_top"])
            
            # Calculate average row height for normalization
            avg_height = self._calculate_avg_row_height(all_rows)
            if avg_height > 0:
                # Normalize distance by average row height
                normalized_distance = y_distance / avg_height
                # Convert to score (1.0 for same row, 0.0 for very far)
                proximity_score = max(0, 1.0 - (normalized_distance / 3))
                score += proximity_score * 0.4  # 40% weight
        
        # 2. Field compatibility score
        compatibility_score = 0.0
        field_count = 0
        
        for field in ["date", "particulars", "debit", "credit", "balance"]:
            anchor_val = anchor_row.get(field)
            incomplete_val = incomplete_row.get(field)
            
            if incomplete_val and str(incomplete_val).strip():
                field_count += 1
                # Check if anchor doesn't have this field (good for merging)
                if not anchor_val or not str(anchor_val).strip():
                    compatibility_score += 1.0
                # Check if it's a continuation (for particulars)
                elif field == "particulars":
                    compatibility_score += 0.5  # Particulars can be multi-line
                else:
                    compatibility_score += 0.25  # 25% weight for other fields
        
        for field in ["date", "credits", "debits", "balance"]:
            anchor_val = anchor_row.get(field)
            incomplete_val = incomplete_row.get(field)
            if incomplete_val and str(incomplete_val).strip() == "" or anchor_val and str(anchor_val).strip() == "":
                continue
            if field == "date":
                if self._is_valid_date(incomplete_val) and self._is_valid_date(anchor_val):
                    compatibility_score -= 3
            elif field == "credits" or field == "debits" or field == "balance":
                if self._is_valid_amount(incomplete_val) and self._is_valid_amount(anchor_val):
                    compatibility_score -= 3
        
        if field_count > 0:
            score += (compatibility_score / field_count) * 0.3  # 30% weight
        
        # 3. Sequential position score (incomplete rows often follow their anchor)
        if incomplete_idx == anchor_idx + 1:
            score += 0.2  # 20% weight for being next row
        elif incomplete_idx == anchor_idx - 1:
            score += 0.1  # 10% weight for being previous row
        
        # More bonus points if only field in the incomplete row is particulars
        if len(incomplete_row.keys() - {"y_top", "y_bottom", "x_left", "x_right"}) == 1 and "particulars" in incomplete_row.keys():
            score += 0.1
        
        # 4. Content analysis score
        # Check if merging would create valid data
        merged_date = self._try_merge_text(
            anchor_row.get("date", ""), 
            incomplete_row.get("date", "")
        )
        if merged_date and self._is_valid_date(merged_date):
            score += 0.1  # 10% bonus for valid date creation
        
        return score
    
    def _calculate_avg_row_height(self, rows: list) -> float:
        """Calculate average height of rows for normalization"""
        heights = []
        for row in rows:
            if row.get("y_top") is not None and row.get("y_bottom") is not None:
                height = row["y_bottom"] - row["y_top"]
                if height > 0:
                    heights.append(height)
        
        if heights:
            return sum(heights) / len(heights)
        return 10.0  # Default fallback
    
    def _smart_merge_row(self, target_row: dict, source_row: dict):
        """
        Intelligently merge source_row into target_row.
        Handles field conflicts and multi-line text properly.
        """
        for key, value in source_row.items():
            if key in ["y_top", "y_bottom", "x_left", "x_right"]:
                # Update bounding box to encompass both rows
                if key == "y_top" and value is not None:
                    current = target_row.get(key)
                    target_row[key] = min(current, value) if current is not None else value
                elif key == "y_bottom" and value is not None:
                    current = target_row.get(key)
                    target_row[key] = max(current, value) if current is not None else value
                elif key == "x_left" and value is not None:
                    current = target_row.get(key)
                    target_row[key] = min(current, value) if current is not None else value
                elif key == "x_right" and value is not None:
                    current = target_row.get(key)
                    target_row[key] = max(current, value) if current is not None else value
            elif value and str(value).strip():  # Only merge non-empty values
                if key in target_row and target_row[key] and str(target_row[key]).strip():
                    # Both have values - merge them intelligently
                    if key == "particulars":
                        # For particulars, always append (multi-line descriptions)
                        target_row[key] = f"{target_row[key]} {value}".strip()
                    elif key == "date":
                        # For dates, try to complete partial dates
                        merged = self._try_merge_date(target_row[key], value)
                        if merged:
                            target_row[key] = merged
                    # For amounts (debit/credit/balance), keep original if valid
                    elif key in ["debit", "credit", "balance"]:
                        # Only replace if target is invalid
                        if not self._is_valid_amount(target_row[key]):
                            target_row[key] = value
                else:
                    # Target is empty or None, use source value
                    target_row[key] = value
    
    def _try_merge_date(self, date1: str, date2: str) -> Optional[str]:
        """Try to merge two date strings intelligently"""
        if not date1:
            return date2
        if not date2:
            return date1
        
        # Check if one is a subset of the other (partial dates)
        date1_clean = str(date1).replace(" ", "").replace("-", "").replace("/", "")
        date2_clean = str(date2).replace(" ", "").replace("-", "").replace("/", "")
        
        if date1_clean in date2_clean:
            return date2
        elif date2_clean in date1_clean:
            return date1
        
        # Try concatenation for split dates
        combined = f"{date1}{date2}"
        if self._is_valid_date(combined):
            return combined
        
        # Default to keeping the more complete one
        if len(date1) >= len(date2):
            return date1
        return date2
    
    def _is_valid_amount(self, value: Any) -> bool:
        """Check if a value is a valid amount"""
        if value is None:
            return False
        try:
            float_val = float(str(value).replace(",", "").replace("$", "").strip())
            return float_val != 0
        except (ValueError, AttributeError):
            return False

    def _try_merge_text(self, text1: str, text2: str) -> str:
        """Try to merge two text fields intelligently."""
        if not text1:
            return text2
        if not text2:
            return text1
        return f"{text1} {text2}".strip()
    
    def _is_valid_date(self, date_str: str) -> bool:
        """Check if a date string can be parsed as a valid date."""
        if not date_str:
            return False
        try:
            from utils.date_parser import smart_date_parser
            result, _ = smart_date_parser(date_str)
            return result != date_str  # If parsing succeeded, result should be different
        except Exception:
            return False

    def run(self):
        """
        Main execution method that applies both merging strategies:
        1. First merge incomplete rows with anchor rows
        2. Then merge remaining incomplete rows with each other
        """
        self.logger.info("Starting row merging process")
        
        total_rows_processed = 0
        total_rows_yielded = 0
        
        for rows_data in self.read_input_streaming("group_rows"):
            page_rows = rows_data["rows"]
            page_number = rows_data.get("page_number", 0)
            
            total_rows_processed += len(page_rows)
            
            # Step 1: Apply anchor-based merging
            merged_with_anchors, unprocessed_rows = self.merge_rows_with_anchors(page_rows)
            
            self.logger.debug(
                "Anchor merging completed",
                original_count=len(page_rows),
                merged_count=len(merged_with_anchors),
                unprocessed_count=len(unprocessed_rows)
            )
            
            # Step 2: Try to merge remaining incomplete rows with each other
            if unprocessed_rows:
                merged_incomplete = self.merge_incomplete_rows(unprocessed_rows)
                self.logger.debug(
                    "Incomplete row merging completed",
                    input_count=len(unprocessed_rows),
                    output_count=len(merged_incomplete)
                )
                
                # Combine all merged rows
                all_merged = merged_with_anchors + merged_incomplete
            else:
                all_merged = merged_with_anchors
            
            # Sort by y_top to maintain order
            all_merged.sort(key=lambda x: x.get("y_top", 0))
            yield {
                "rows": all_merged,
                "page_number": page_number
            }
            # Yield merged rows for this page
            # for row in all_merged:
            #     # Add page_number to each row
            #     row["page_number"] = page_number
            #     total_rows_yielded += 1
            #     yield {
            #         "rows": [row]
            #         "pag"
            #     }
        
        self.logger.info(
            "Row merging completed",
            rows_processed=total_rows_processed,
            rows_yielded=total_rows_yielded
        )
