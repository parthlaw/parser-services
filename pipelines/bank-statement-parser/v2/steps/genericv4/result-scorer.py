from v2.base_step import BaseStep
from utils.result_scorer import score_jsonl_file
from resources.job_data_factory import JobStatus, create_job_data_instance
from utils import s3_utils
from utils.constants import BUCKET_NAME
from utils.metrics.cloudwatch import MetricUnit, put_metric
import tempfile
import os
from datetime import datetime

class ResultScorer(BaseStep):
    def __init__(self, context=None, input=None) -> None:
        super().__init__(context, input)

    def run(self):
        """
        Async step to calculate and update result score for the job.
        This step runs after the main pipeline completes and updates the job with the result score.
        """
        context = self.context or {}
        pdf_s3_key = context.get("pdf_s3_key")
        job_id = context.get("job_id")
        user_id = context.get("user_id")
        num_pages = context.get("num_pages", 0)
        
        if not pdf_s3_key:
            self.logger.error("pdf_s3_key is required for result scoring")
            return
            
        if not job_id:
            self.logger.error("job_id is required for result scoring")
            return

        try:
            # Get the JSONL S3 path
            jsonl_s3_key = s3_utils.get_pdf_s3_results_key(pdf_s3_key, "jsonl")
            
            self.logger.info("Starting result scoring", job_id=job_id, jsonl_s3_key=jsonl_s3_key)
            
            # Download JSONL file from S3 to temporary location
            with tempfile.NamedTemporaryFile(mode='w+', suffix='.jsonl', delete=False) as temp_file:
                temp_jsonl_path = temp_file.name
            
            try:
                # Download the JSONL file from S3
                s3_utils.download_file_from_s3(BUCKET_NAME, jsonl_s3_key, temp_jsonl_path)
                
                # Score the result
                self.logger.info("Calculating result score", temp_file=temp_jsonl_path)
                score_result = score_jsonl_file(temp_jsonl_path, debug=False)
                
                # Extract the score (convert from 0-10 scale to 0-1 scale for database)
                raw_score = score_result.get("score", 0.0)
                normalized_score = min(1.0, max(0.0, raw_score / 10.0))  # Normalize to 0-1 range
                mode = score_result.get("mode")
                
                self.logger.info("Result score calculated", 
                                job_id=job_id, 
                                raw_score=raw_score, 
                                normalized_score=normalized_score*100, 
                                mode=mode)
                
                # Send comprehensive job result metrics
                score_percentage = normalized_score * 100
                put_metric('ResultScorev2', score_percentage, MetricUnit.PERCENT, {
                    'Pipeline': 'GenericV4',
                }, timestamp=datetime.now())
                
                # Update the job with the result score
                user_id = self.context.get("user_id")
                is_logged_in = bool(user_id)
                job_data = create_job_data_instance(
                    job_id=job_id,
                    user_id=user_id or "anonymous",
                    job_data={},
                    is_logged_in=is_logged_in
                )
                job_data.update_job_status(
                    job_id=job_id,
                    status=JobStatus.SUCCESS,  # Keep status as success
                    result_score=normalized_score
                )
                
                self.logger.info("Job updated with result score", job_id=job_id, result_score=normalized_score)
            finally:
                # Clean up temporary file
                if os.path.exists(temp_jsonl_path):
                    os.unlink(temp_jsonl_path)
                    
        except Exception as e:
            self.logger.error("Error during result scoring", job_id=job_id, error=str(e))
            # Don't fail the job, just log the error since the main processing is already complete
            
        # This step doesn't yield anything as it's purely for updating the job
        # Return an empty generator to satisfy the Iterator[Any] interface
        return iter([])
