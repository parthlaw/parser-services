from typing import Dict, List, Any, Optional
from datetime import datetime
import logging
from .job_data import JobData
from utils.supabase_client import init_supabase

logger = logging.getLogger(__name__)


class SupabaseData(JobData):
    """Supabase implementation of JobData for logged-in users.
    
    This implementation supports full job and job step tracking using
    Supabase as the backend storage.
    """

    def __init__(self, job_id: str, user_id: str, job_data: dict):
        super().__init__(job_id, user_id, job_data)
        self.supabase = init_supabase()

    def add_job(
        self,
        user_id: str,
        source_key: str,
        status: str = "pending",
        result_s3_path: Optional[str] = None,
        additional_fields: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Add a new job to the Supabase jobs table."""
        try:
            job_data = {
                "user_id": user_id,
                "source_key": source_key,
                "status": status,
                "metadata": additional_fields or {}
            }
            
            if result_s3_path is not None:
                job_data["result_s3_path"] = result_s3_path
            
            result = self.supabase.insert("jobs", job_data)
            
            if result:
                job = result[0]
                logger.info(f"Job created successfully with ID: {job['id']}")
                return job
            else:
                raise Exception("Failed to create job - no data returned")
                
        except Exception as e:
            logger.error(f"Error creating job: {str(e)}")
            raise

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a job by its ID from Supabase."""
        try:
            filters = {"id": f"eq.{job_id}"}
            result = self.supabase.select("jobs", filters)
            
            if result:
                return result[0]
            else:
                logger.warning(f"Job {job_id} not found")
                return None
                
        except Exception as e:
            logger.error(f"Error retrieving job {job_id}: {str(e)}")
            raise

    def update_job_status(
        self,
        job_id: str,
        status: str,
        result_s3_path: Optional[str] = None,
        additional_fields: Optional[Dict[str, Any]] = None,
        num_pages: Optional[int] = None,
        result_score: Optional[float] = None
    ) -> Dict[str, Any]:
        """Update the status of an existing job in Supabase."""
        try:
            update_data = {
                "status": status,
                "updated_at": datetime.utcnow().isoformat() + 'Z'
            }
            
            if result_s3_path is not None:
                update_data["result_s3_path"] = result_s3_path
                
            if num_pages is not None:
                update_data["num_pages"] = num_pages
                
            if result_score is not None:
                update_data["result_score"] = result_score
                
            # Handle metadata updates
            if additional_fields:
                # Get current job to merge with existing metadata
                current_job = self.get_job(job_id)
                current_metadata = current_job.get('metadata', {}) if current_job else {}
                
                # Merge additional_fields with existing metadata
                merged_metadata = {**current_metadata, **additional_fields}
                update_data["metadata"] = merged_metadata
            
            filters = {"id": f"eq.{job_id}"}
            result = self.supabase.update("jobs", update_data, filters)
            
            if result:
                job = result[0]
                logger.info(f"Job {job_id} status updated to: {status}")
                return job
            else:
                raise Exception(f"Failed to update job {job_id} - no data returned")
                
        except Exception as e:
            logger.error(f"Error updating job {job_id}: {str(e)}")
            raise

    def create_job_steps(self, job_id: str, pipeline_steps: List[Dict[str, Any]]) -> bool:
        """Create step tracking records for a job's pipeline in Supabase."""
        try:
            step_records = []
            for i, step in enumerate(pipeline_steps):
                step_record = {
                    "job_id": job_id,
                    "step_name": step.get('id', step.get('key', f"step_{i}")),
                    "step_order": i + 1,
                    "status": "pending",
                    "step_config": step  # Store the full step configuration
                }
                step_records.append(step_record)
            
            # Insert all step records
            result = self.supabase.insert("job_steps", step_records)
            
            if result:
                logger.info(f"Created {len(step_records)} step records for job {job_id}")
                return True
            else:
                logger.error(f"Failed to create step records for job {job_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error creating job steps for {job_id}: {str(e)}")
            return False

    def update_step_status(
        self,
        job_id: str,
        step_name: str,
        status: str,
        s3_output_path: Optional[str] = None,
        execution_time_ms: Optional[int] = None,
        error_details: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Update the status of a specific pipeline step in Supabase."""
        try:
            update_data = {
                "status": status,
                "updated_at": datetime.utcnow().isoformat() + 'Z'
            }
            
            if s3_output_path:
                update_data["s3_output_path"] = s3_output_path
            if execution_time_ms is not None:
                update_data["execution_time_ms"] = execution_time_ms
            if error_details:
                update_data["error_details"] = error_details
            
            filters = {
                "job_id": f"eq.{job_id}",
                "step_name": f"eq.{step_name}"
            }
            
            result = self.supabase.update("job_steps", update_data, filters)
            
            if result:
                logger.info(f"Updated step {step_name} status to {status} for job {job_id}")
                return True
            else:
                logger.warning(f"No step found to update: {step_name} for job {job_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error updating step status: {str(e)}")
            return False

    def get_job_progress(self, job_id: str) -> Dict[str, Any]:
        """Get the current progress of a job's pipeline steps from Supabase."""
        try:
            filters = {"job_id": f"eq.{job_id}"}
            steps = self.supabase.select(
                "job_steps", 
                filters=filters,
                order="step_order.asc"
            )
            
            if not steps:
                return {"total_steps": 0, "completed_steps": 0, "current_step": None, "progress_percent": 0}
            
            total_steps = len(steps)
            completed_steps = len([s for s in steps if s['status'] in ["completed", "skipped"]])
            current_step = None
            
            # Find current step (first non-completed step)
            for step in steps:
                if step['status'] == "processing":
                    current_step = step['step_name']
                    break
                elif step['status'] == "pending":
                    current_step = step['step_name']
                    break
            
            progress_percent = int((completed_steps / total_steps) * 100) if total_steps > 0 else 0
            
            return {
                "total_steps": total_steps,
                "completed_steps": completed_steps,
                "current_step": current_step,
                "progress_percent": progress_percent,
                "steps": steps
            }
            
        except Exception as e:
            logger.error(f"Error getting job progress for {job_id}: {str(e)}")
            return {"error": str(e)}

    def get_user_jobs(
        self,
        user_id: str,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Retrieve jobs for a specific user from Supabase."""
        try:
            filters = {"user_id": f"eq.{user_id}"}
            
            if status:
                filters["status"] = f"eq.{status}"
            
            result = self.supabase.select(
                "jobs", 
                filters=filters,
                order="created_at.desc",
                limit=limit,
                offset=offset
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Error retrieving jobs for user {user_id}: {str(e)}")
            raise
