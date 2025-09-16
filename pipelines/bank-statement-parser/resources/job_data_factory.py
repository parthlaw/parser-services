from typing import Dict, Any
from .job_data import JobData
from .supabase_data import SupabaseData
from .dynamo_data import DynamoData


def create_job_data_instance(job_id: str, user_id: str, job_data: dict, is_logged_in: bool = True) -> JobData:
    """Factory function to create the appropriate JobData implementation.
    
    Args:
        job_id (str): Job identifier
        user_id (str): User identifier
        job_data (dict): Job data dictionary
        is_logged_in (bool): Whether the user is logged in
        
    Returns:
        JobData: Either SupabaseData for logged-in users or DynamoData for anonymous users
    """
    if is_logged_in and user_id:
        return SupabaseData(job_id, user_id, job_data)
    else:
        return DynamoData(job_id, user_id, job_data)


# Status constants - shared across implementations
class JobStatus:
    """Job status constants matching the database enum."""
    PENDING = "pending"
    PROCESSING = "processing" 
    SUCCESS = "success"
    FAILED = "failed"


class StepStatus:
    """Pipeline step status constants."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    SKIPPED = "skipped"
    FAILED = "failed"
