from v2.base_step import BaseStep
import json
import csv
from utils.constants import BUCKET_NAME
from resources.job_data_factory import JobStatus, create_job_data_instance
import xlsxwriter
from utils import s3_utils
from utils.jsonwriter import JsonWriter

class SaveFormat(BaseStep):
    def __init__(self, context=None, input=None) -> None:
        super().__init__(context, input)
        self.formats = ["csv", "json", "xlsx", "jsonl"]
        self.csv_file = open("/tmp/output.csv", "w")
        self.csv_writer = csv.writer(self.csv_file)    
        self.json_writer = JsonWriter("/tmp/output.json")
        self.xlsx_writer = xlsxwriter.Workbook("/tmp/output.xlsx")
        self.xlsx_worksheet = self.xlsx_writer.add_worksheet()
        self.xlsx_row = 0
        self.jsonl_file = open("/tmp/output.jsonl", "w")
        self.all_columns = set()
        self.column_order = []
        self.headers_written = False
    
    def collect_columns(self, row: dict):
        """Collect all column names to establish consistent ordering"""
        for key in row.keys():
            self.all_columns.add(key)
    
    def finalize_column_order(self):
        """Establish final column order and write headers"""
        if self.headers_written:
            return
            
        # Define preferred column order
        preferred_order = ['date', 'particulars', 'check_no', 'debit', 'credit', 'balance']
        
        # Start with preferred columns that exist
        self.column_order = [col for col in preferred_order if col in self.all_columns]
        
        # Add any remaining columns not in preferred order
        remaining_cols = sorted(self.all_columns - set(self.column_order))
        self.column_order.extend(remaining_cols)
        
        # Write headers
        self.csv_writer.writerow(self.column_order)
        for col_idx, header in enumerate(self.column_order):
            self.xlsx_worksheet.write(0, col_idx, header)
        self.xlsx_row = 1  # Start data from row 1 (after header)
        self.headers_written = True
    
    def save_row_csv(self, row: dict):
        if not row:
            return
        # Ensure headers are written first
        self.finalize_column_order()
        
        # Write values in consistent column order
        row_values = [row.get(col, '') for col in self.column_order]
        self.csv_writer.writerow(row_values)
    
    def save_row_json(self, row: dict):
        if not row:
            return
        self.json_writer.writerow(row)
    
    def save_row_xlsx(self, row: dict):
        if not row:
            return
        # Ensure headers are written first
        self.finalize_column_order()
        
        # Write values in consistent column order
        for col_idx, col_name in enumerate(self.column_order):
            value = row.get(col_name, '')
            self.xlsx_worksheet.write(self.xlsx_row, col_idx, value)
        self.xlsx_row += 1
    
    def save_row_jsonl(self, row: dict):
        if not row:
            return
        json.dump(row, self.jsonl_file)
        self.jsonl_file.write('\n')
    
    def update_result_in_job(self, result_s3_path: str, download_s3_paths:dict, num_pages: int):
        # update the result in the job
        # get the job id from the context
        job_id = self.context.get("job_id")
        user_id = self.context.get("user_id")
        if not job_id:
            raise ValueError("job_id is required")
        
        # Create job data instance and update the result
        is_logged_in = bool(user_id)
        job_data = create_job_data_instance(
            job_id=job_id,
            user_id=user_id or "anonymous",
            job_data={},
            is_logged_in=is_logged_in
        )
        job_data.update_job_status(job_id, JobStatus.SUCCESS, result_s3_path=result_s3_path, download_data={**download_s3_paths}, num_pages=num_pages)

    def run(self):
        context = self.context or {}
        pdf_s3_key = context.get("pdf_s3_key")
        if not pdf_s3_key:
            raise ValueError("pdf_s3_key is required")
        summary = {
            "total_debits":0,
            "total_credits":0,
            "total_transactions":0
        }
        
        # First pass: collect all column names and track pages
        rows_data = []
        pages_seen = set()
        for row in self.read_input_streaming("format_cleaner"):
            # Track page numbers for counting total pages
            if "page_number" in row:
                pages_seen.add(row["page_number"])
            
            # Remove position fields
            if "y_top" in row:
                del row["y_top"]
            if "y_bottom" in row:
                del row["y_bottom"]
            if "x_left" in row:
                del row["x_left"]
            if "x_right" in row:
                del row["x_right"]
            if "page_number" in row:
                del row["page_number"]
            
            self.collect_columns(row)
            rows_data.append(row)
        
        # Calculate total pages processed
        num_pages = len(pages_seen) if pages_seen else 0
        
        # Second pass: write all rows with consistent column ordering
        for row in rows_data:
            summary["total_transactions"] += 1
            for key,value in row.items():
                if "debit" in key.lower():
                    if value == "0" or value == 0 or value is None:
                        continue
                    summary["total_debits"] += float(value)
                if "credit" in key.lower():
                    if value == "0" or value == 0 or value is None:
                        continue
                    summary["total_credits"] += float(value)
                    
            self.save_row_csv(row)
            self.save_row_json(row)
            self.save_row_xlsx(row)
            self.save_row_jsonl(row)
        self.csv_file.close()
        self.json_writer.close()
        self.xlsx_writer.close()
        self.jsonl_file.close()
        # save to s3
        self.logger.info("Uploading results to S3", s3_key=pdf_s3_key)
        s3_utils.upload_file_to_s3("/tmp/output.csv", BUCKET_NAME, s3_utils.get_pdf_s3_results_key(pdf_s3_key, "csv"))
        s3_utils.upload_file_to_s3("/tmp/output.json", BUCKET_NAME, s3_utils.get_pdf_s3_results_key(pdf_s3_key, "json"))
        s3_utils.upload_file_to_s3("/tmp/output.xlsx", BUCKET_NAME, s3_utils.get_pdf_s3_results_key(pdf_s3_key, "xlsx"))
        s3_utils.upload_file_to_s3("/tmp/output.jsonl", BUCKET_NAME, s3_utils.get_pdf_s3_results_key(pdf_s3_key, "jsonl"))
        self.update_result_in_job(s3_utils.get_pdf_s3_results_key(pdf_s3_key, "jsonl"), {
            "csv": s3_utils.get_pdf_s3_results_key(pdf_s3_key, "csv"),
            "json": s3_utils.get_pdf_s3_results_key(pdf_s3_key, "json"),
            "xlsx": s3_utils.get_pdf_s3_results_key(pdf_s3_key, "xlsx"),
            "jsonl": s3_utils.get_pdf_s3_results_key(pdf_s3_key, "jsonl"),
            "summary":summary
        }, num_pages)
        yield None