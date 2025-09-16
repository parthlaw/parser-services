from typing import Optional
from utils import conversions, date_parser
from v2.base_step import BaseStep
import re


class FormatCleaner(BaseStep):
    def __init__(self, context=None, input=None) -> None:
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
            ],
            "particulars": [
                "particulars",
                "transactiondetails",
                "description",
                "remarks",
                "narration",
            ],
            "credit": ["deposits", "credit", "credits", "deposit"],
            "debit": ["withdrawals", "debit", "debits", "withdrawal"],
            "balance": ["balance"],
        }

        normalized = self._normalize(header)
        for key, variants in HEADERS_MAP.items():
            for variant in variants:
                if normalized in variant or variant in normalized:
                    return key
        return header  # fallback to original

    def format_row(self, row: dict, date_country_format: str):
        HEADER_TYPES = {
            "date": "date-string",
            "particulars": "string",
            "debit": "float",
            "credit": "float",
            "balance": "float",
        }
        for key, value in row.items():
            conv_type = HEADER_TYPES.get(key)
            if conv_type == "float":
                row[key] = conversions.currency_string_to_float(value)
            elif conv_type == "date-string":
                if date_country_format == "US":
                    row[key] = date_parser.parse_date_us_format(value)
                if date_country_format == "EU":
                    row[key] = date_parser.parse_date_eu_format(value)
            elif conv_type == "string":
                row[key] = str(value)
            if (row.get("date") is None or row.get("balance") is None) and (row.get("date") is None or row.get("amount") is None):
                return None
        return row

    def get_date_country_format(self, dates, country: Optional[str] = None):
        date_country_format = None
        for key, val in date_parser.DATE_FORMAT_MAP.items():
            if country in val:
                date_country_format = key
        if date_country_format is None:
            for date in dates:
                _, format = date_parser.smart_date_parser(date)
                if format != "US":
                    date_country_format = format
        if date_country_format is None:
            return "US"
        return date_country_format

    def run(self):
        """Format and clean rows from all pages, yielding formatted results."""
        country = self.context["country"]
        
        self.logger.info("Starting format cleaning and validation")
        
        # First pass: collect sample dates for format detection (streaming)
        sample_dates = []
        date_country_format = None
        
        # Detect date format from first few pages
        pages_processed_for_format = 0
        for rows_data in self.read_input_streaming("merge_rows"):
            page_rows = rows_data["rows"]
            
            # Map headers and collect sample dates
            for row in page_rows[:10]:  # Sample first 10 rows per page
                mapped_row = {}
                for key, value in row.items():
                    mapped_key = self._map_headers(key)
                    mapped_row[mapped_key] = value
                
                date_value = mapped_row.get("date", "")
                if date_value:
                    sample_dates.append(date_value)
            
            pages_processed_for_format += 1
            # Stop after processing 3 pages for date format detection
            if pages_processed_for_format >= 3 and sample_dates:
                break
        
        # Determine date format from samples
        date_country_format = self.get_date_country_format(sample_dates, country)
        self.logger.info("Date format detected", format=date_country_format)
        
        # Second pass: process each page independently
        total_rows_processed = 0
        total_rows_yielded = 0
        
        for rows_data in self.read_input_streaming("merge_rows"):
            page_rows = rows_data["rows"]
            page_number = rows_data.get("page_number", 0)
            
            # Map headers for this page
            mapped_rows = []
            for row in page_rows:
                new_row = {}
                for key, value in row.items():
                    mapped_key = self._map_headers(key)
                    new_row[mapped_key] = value
                mapped_rows.append(new_row)
            
            total_rows_processed += len(mapped_rows)
            
            # Format and yield rows from this page (merging is now done in separate step)
            for row in mapped_rows:
                formatted_row = self.format_row(row, date_country_format)
                if formatted_row:
                    # Add page_number to each row
                    formatted_row["page_number"] = page_number
                    total_rows_yielded += 1
                    yield formatted_row
        
        self.logger.info("Format cleaning completed", 
                        rows_processed=total_rows_processed, 
                        rows_yielded=total_rows_yielded)