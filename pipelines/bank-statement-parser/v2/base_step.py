from typing import Iterator, Any
from utils import constants, s3_utils
from utils.jsonl_utils import JSONLManager
from utils.logger import get_step_logger


class BaseStep:
    def __init__(self, context=None, input=None) -> None:
        self.context = context or {}
        self.input = input or {}
        self.jsonl_manager = JSONLManager()
        self.job_id = context.get('job_id') if context else None
        self.user_id = context.get('user_id') if context else None
        
        # Initialize logger for this step
        step_name = self.__class__.__name__
        self.logger = get_step_logger(step_name, self.job_id, self.user_id)
    
    def get_input_filepath(self, input_key: str) -> str:
        """Get local filepath for input data from previous step."""
        if input_key not in self.input:
            raise ValueError(f"Required input '{input_key}' not found")
        
        s3_key = self.input[input_key]
        local_filepath = self.jsonl_manager.get_temp_filepath(self.job_id, f"input_{input_key}")
        
        self.logger.info("Loading input data from S3", 
                        input_key=input_key, 
                        s3_key=s3_key)
        
        # Validate S3 object exists before downloading
        if not self.jsonl_manager.check_s3_object_exists(s3_key):
            raise RuntimeError(f"Input data not found in S3: {s3_key}")
        
        # Download from S3 to local disk
        if not self.jsonl_manager.download_jsonl_from_s3(s3_key, local_filepath):
            raise RuntimeError(f"Failed to download input data for {input_key}")
        
        return local_filepath
    
    def get_output_filepath(self, step_name: str) -> str:
        """Get local filepath for output data."""
        return self.jsonl_manager.get_temp_filepath(self.job_id, f"output_{step_name}")
    
    def save_output_to_s3(self, local_filepath: str, step_name: str) -> str:
        """Save output file to S3 and return S3 key."""
        s3_key = self.jsonl_manager.get_s3_step_key(self.user_id, self.job_id, step_name)
        
        self.logger.info("Saving step output to S3", 
                        step_name=step_name, 
                        s3_key=s3_key)
        
        if not self.jsonl_manager.save_jsonl_to_s3(local_filepath, s3_key):
            raise RuntimeError(f"Failed to save output to S3 for step {step_name}")
        
        return s3_key
    
    def cleanup_files(self, *filepaths: str) -> None:
        """Clean up local files."""
        for filepath in filepaths:
            self.jsonl_manager.cleanup_local_file(filepath)
    
    def read_input_streaming(self, input_key: str) -> Iterator[Any]:
        """Read input data as streaming iterator."""
        filepath = self.get_input_filepath(input_key)
        try:
            yield from self.jsonl_manager.read_jsonl_streaming(filepath)
        finally:
            self.cleanup_files(filepath)
    
    def write_output_streaming(self, data_iterator: Iterator[Any], step_name: str) -> str:
        """Write output data as streaming and save to S3."""
        output_filepath = self.get_output_filepath(step_name)
        
        try:
            count = self.jsonl_manager.write_jsonl_streaming(output_filepath, data_iterator)
            self.logger.info("Step output written successfully", 
                        step_name=step_name, 
                        items_written=count, 
                        output_filepath=output_filepath)
            
            s3_key = self.save_output_to_s3(output_filepath, step_name)
            return s3_key
        
        finally:
            self.cleanup_files(output_filepath)
    
    def run(self) -> Iterator[Any]:
        """
        Main processing method. Should yield processed items.
        Override this method in subclasses.
        """
        raise NotImplementedError("Subclass must implement run() method")
