import os
from typing import Optional, Union
import yaml
import pdfplumber
import importlib
from io import BytesIO

from resources.job_data_factory import create_job_data_instance, JobStatus, StepStatus
from utils import constants, s3_utils
from utils.jsonl_utils import JSONLManager
from utils.logger import get_logger


class BankStatementParser:
    BANKS = {}

    def __init__(
        self,
        filename: str,
        source_key: str,
        job_id: str,
        bank_name: Optional[str] = None,
        country: Optional[str] = None,
        mode: Optional[str] = None,
        user_id: Optional[str] = None,
        pages: Optional[int] = 10,
    ) -> None:
        self.country = country
        self.filename = filename
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.bank_name = bank_name
        self.mode = mode
        self.job_id = job_id
        self.user_id = user_id
        self.source_key = source_key
        self.pages = pages
        self.jsonl_manager = JSONLManager()
        
        # Initialize logger
        self.logger = get_logger('pipelines.v2.bank_statement_parser')
        self.logger.set_context(job_id=self.job_id, user_id=self.user_id, source_key=self.source_key)
        
        # Initialize job data management - choose backend based on user login status
        is_logged_in = bool(self.user_id)
        self.job_data = create_job_data_instance(
            job_id=self.job_id,
            user_id=self.user_id or "anonymous",
            job_data={},
            is_logged_in=is_logged_in
        )
        
        self.logger.info("BankStatementParser initialized", 
                        filename=filename, 
                        mode=mode, 
                        bank_name=bank_name, 
                        country=country, 
                        pages=pages,
                        backend="Supabase" if is_logged_in else "DynamoDB")

    def _get_result_key(self) -> str:
        # Assumes s3_key is of the form <prefix><uid>/<filename>
        # Example: bank-statements/abc123/statement.pdf
        return s3_utils.get_pdf_s3_results_key(self.source_key)

    def save_result_json_to_s3(self, data: Union[dict, list]) -> bool:
        result_key = self._get_result_key()
        if not result_key:
            return False
        return s3_utils.save_dict_to_s3(data, constants.BUCKET_NAME, result_key)

    def save_step_output_to_s3(self, data, step_key: str):
        key = self.source_key.replace(self.filename,f"{step_key}.json")
        return s3_utils.save_dict_to_s3(
            data,
            constants.BUCKET_NAME,
            key,
        )
    def run_step(self, step_config: dict, context: dict, step_outputs: dict) -> dict:
        """Execute a single pipeline step using JSONL streaming approach."""
        step_name = step_config["step"]  # Updated to match YAML structure
        step_file = step_config["file"]
        step_key = step_config["key"]
        inputs = step_config.get("inputs", [])
        
        module_path = f"v2.steps.genericv4.{step_file}"
        module = importlib.import_module(module_path)
        step_class = getattr(module, step_name)
        
        # Prepare step inputs from previous step outputs
        step_input = {}
        for input_key in inputs:
            if input_key in step_outputs:
                step_input[input_key] = step_outputs[input_key]
            else:
                raise ValueError(f"Required input '{input_key}' not found for step {step_name}")
        
        # Add job_id and user_id to context for BaseStep
        enhanced_context = {**context, 'job_id': self.job_id, 'user_id': self.user_id}
        step_instance = step_class(enhanced_context, step_input)
        
        try:
            self.logger.log_step_start(step_name, self.job_id, self.user_id, 
                                      step_file=step_file, 
                                      inputs=inputs)
            
            # Execute step and get output iterator
            output_iterator = step_instance.run()
            
            # Write output to JSONL and save to S3
            s3_output_key = step_instance.write_output_streaming(output_iterator, step_name)
            
            # Update step outputs
            step_outputs[step_key] = s3_output_key
            
            # Update step status
            if self.user_id:
                self.job_data.update_step_status(self.job_id, step_name, StepStatus.COMPLETED, s3_output_path=s3_output_key)
            
            self.logger.log_step_end(step_name, 
                                    job_id=self.job_id, 
                                    user_id=self.user_id, 
                                    s3_output_key=s3_output_key)
            return step_outputs
            
        except Exception as e:
            self.logger.log_step_error(step_name, e, self.job_id, self.user_id, 
                                      step_file=step_file)
            error_details = {
                "error_message": str(e),
                "error_type": type(e).__name__,
                "step_file": step_file,
            }
            
            if self.user_id:
                # Update step status (no-op for DynamoDB, tracked for Supabase)
                self.job_data.update_step_status(self.job_id, step_name, StepStatus.FAILED, error_details=error_details)
                # Update job status
                self.job_data.update_job_status(self.job_id, JobStatus.FAILED, 
                                additional_fields={"failed_step": step_name, "error_details": error_details})
            raise

    def run(self, file_path: Optional[str] = None):
        """Execute the complete pipeline with proper resource management."""
        pdf_doc = None
        try:
            # Load pipeline configuration
            bank_key = file_path or self._get_bank_key()
            config_path = os.path.join(self.base_dir, "config", f"{bank_key}.yaml")
            
            with open(config_path, "r") as file:
                pipeline_config = yaml.safe_load(file)
            
            result_key = self._get_result_key()
            if len(result_key) == 0:
                # file is not pdf or key is malformed
                return {}
            
            # Load PDF and setup context
            pdf_bytes = s3_utils.get_pdf_from_s3(constants.BUCKET_NAME, self.source_key)
            pdf_stream = BytesIO(pdf_bytes)
            pdf_doc = pdfplumber.open(pdf_stream)
            
            # Create a limited PDF wrapper to only process first 2 pages
            class LimitedPDF:
                def __init__(self, pdf_doc, max_pages=10):
                    self._pdf_doc = pdf_doc
                    self.pages = pdf_doc.pages[:max_pages]
                    
                def __getattr__(self, name):
                    # Delegate all other attributes to the original PDF object
                    return getattr(self._pdf_doc, name)
            
            limited_pdf = LimitedPDF(pdf_doc, max_pages=self.pages)
            self.logger.info("Starting pipeline execution", source_key=self.source_key)
            context = {
                "pdf": limited_pdf,
                "pdf_bytes": pdf_bytes,
                "country": self.country,
                "job_id": self.job_id,
                "user_id": self.user_id,
                "pdf_s3_key": self.source_key,
            }
            
            # Execute pipeline steps
            steps = pipeline_config.get("steps", [])
            step_outputs = {}
            
            for step_config in steps:
                step_outputs = self.run_step(step_config, context, step_outputs)
            
            self.logger.info("Pipeline completed successfully", 
                           final_outputs=list(step_outputs.keys()), 
                           total_steps=len(steps))
            return step_outputs
            
        except Exception as e:
            self.logger.error("Pipeline execution failed", exc_info=True)
            raise
        finally:
            # Clean up PDF resources
            if pdf_doc:
                try:
                    pdf_doc.close()
                    self.logger.debug("PDF document closed successfully")
                except Exception as e:
                    self.logger.warning("Error closing PDF document", error=str(e))
            
            # Clean up any remaining temporary files
            self._cleanup_temp_files()

    def _cleanup_temp_files(self):
        """Clean up any remaining temporary files for this job."""
        try:
            temp_dir = self.jsonl_manager.temp_dir
            job_prefix = f"{self.job_id}_"
            
            for filename in os.listdir(temp_dir):
                if filename.startswith(job_prefix):
                    filepath = os.path.join(temp_dir, filename)
                    self.jsonl_manager.cleanup_local_file(filepath)
        except Exception as e:
            self.logger.warning("Error during temp file cleanup", error=str(e))

    def _get_bank_key(self):
        # Determine the pipeline key based on bank_name or default
        if self.bank_name:
            return self.BANKS.get(
                self.bank_name.upper(), f"generic{constants.CURRENT_GENERIC_VERSION}"
            )
        return f"generic{constants.CURRENT_GENERIC_VERSION}"

    def get_results(self):
        if self.mode == "simple":
            self.run(file_path="simple")
            return True
        else:
            self.run(file_path=f"generic{constants.CURRENT_GENERIC_VERSION}")
            return True
