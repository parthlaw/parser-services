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
        result_score: Optional[float] = None,
        download_data: Optional[Dict[str, Any]] = None,
        failure_reason: Optional[str] = None
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
                
            if download_data is not None:
                update_data["download_data"] = download_data

            if failure_reason is not None:
                update_data["failure_reason"] = failure_reason
                
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

    def get_job_progress(self, job_id: str) -> Dict[str, Any]:
        """Get job progress from Supabase."""
        try:
            current_job = self.get_job(job_id)
            if not current_job:
                return {"progress_percent": 0, "status": "not_found"}
            
            job_status = current_job.get('status', 'pending')
            
            if job_status == 'success':
                progress_percent = 100
            elif job_status == 'processing':
                progress_percent = 50  # Rough estimate
            else:
                progress_percent = 0
            
            return {
                "progress_percent": progress_percent,
                "status": job_status
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
