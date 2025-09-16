from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional


class JobData(ABC):
    """Abstract base class for job data management.
    
    This class defines the interface for managing job and job step data
    across different storage backends (Supabase for logged-in users,
    DynamoDB for anonymous users).
    """
    
    def __init__(self, job_id: str, user_id: str, job_data: dict):
        self.job_id = job_id
        self.user_id = user_id
        self.job_data = job_data

    def get_job_id(self):
        return self.job_id
    
    def get_user_id(self):
        return self.user_id

    # Job Management Methods
    @abstractmethod
    def add_job(
        self,
        user_id: str,
        source_key: str,
        status: str = "pending",
        result_s3_path: Optional[str] = None,
        additional_fields: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Add a new job to the storage backend."""
        pass

    @abstractmethod
    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a job by its ID."""
        pass

    @abstractmethod
    def update_job_status(
        self,
        job_id: str,
        status: str,
        result_s3_path: Optional[str] = None,
        additional_fields: Optional[Dict[str, Any]] = None,
        num_pages: Optional[int] = None,
        result_score: Optional[float] = None
    ) -> Dict[str, Any]:
        """Update the status of an existing job."""
        pass

    # Job Step Management Methods (may be no-op for backends without step support)
    @abstractmethod
    def create_job_steps(self, job_id: str, pipeline_steps: List[Dict[str, Any]]) -> bool:
        """Create step tracking records for a job's pipeline."""
        pass

    @abstractmethod
    def update_step_status(
        self,
        job_id: str,
        step_name: str,
        status: str,
        s3_output_path: Optional[str] = None,
        execution_time_ms: Optional[int] = None,
        error_details: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Update the status of a specific pipeline step."""
        pass

    @abstractmethod
    def get_job_progress(self, job_id: str) -> Dict[str, Any]:
        """Get the current progress of a job's pipeline steps."""
        pass

    # User Job Queries
    @abstractmethod
    def get_user_jobs(
        self,
        user_id: str,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Retrieve jobs for a specific user."""
        pass
