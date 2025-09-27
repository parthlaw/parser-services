from typing import Dict, List, Any, Optional
from datetime import datetime
from decimal import Decimal
import logging
import uuid
import boto3
from botocore.exceptions import ClientError
from .job_data import JobData

logger = logging.getLogger(__name__)


class DynamoData(JobData):
    """DynamoDB implementation of JobData for anonymous users.
    
    This implementation only supports job tracking (no job steps table)
    using DynamoDB as the backend storage. Job step information is stored
    within the job record's metadata field.
    """

    def __init__(self, job_id: str, user_id: str, job_data: dict, table_name: str = "jobs"):
        super().__init__(job_id, user_id, job_data)
        self.table_name = table_name
        self.dynamodb = boto3.resource('dynamodb')
        self.table = self.dynamodb.Table(table_name)

    def _convert_floats_to_decimal(self, obj):
        """Convert float values to Decimal for DynamoDB compatibility."""
        if isinstance(obj, dict):
            return {k: self._convert_floats_to_decimal(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_floats_to_decimal(item) for item in obj]
        elif isinstance(obj, float):
            return Decimal(str(obj))
        else:
            return obj

    def add_job(
        self,
        user_id: str,
        source_key: str,
        status: str = "pending",
        result_s3_path: Optional[str] = None,
        additional_fields: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Add a new job to the DynamoDB jobs table."""
        try:
            job_id = str(uuid.uuid4())
            timestamp = datetime.utcnow().isoformat() + 'Z'
            
            # Convert any float values in additional_fields to Decimal for DynamoDB compatibility
            converted_additional_fields = self._convert_floats_to_decimal(additional_fields or {})
            
            job_data = {
                "id": job_id,
                "user_id": user_id,
                "source_key": source_key,
                "status": status,
                "created_at": timestamp,
                "updated_at": timestamp,
                "metadata": converted_additional_fields
            }
            
            # Convert any float values in the entire job_data to Decimal
            job_data = self._convert_floats_to_decimal(job_data)
            
            if result_s3_path is not None:
                job_data["result_s3_path"] = result_s3_path
            
            self.table.put_item(Item=job_data)
            
            logger.info(f"Job created successfully with ID: {job_id}")
            return job_data
                
        except ClientError as e:
            logger.error(f"Error creating job in DynamoDB: {str(e)}")
            raise

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a job by its ID from DynamoDB."""
        try:
            response = self.table.get_item(Key={"id": job_id})
            
            if 'Item' in response:
                return response['Item']
            else:
                logger.warning(f"Job {job_id} not found")
                return None
                
        except ClientError as e:
            logger.error(f"Error retrieving job {job_id} from DynamoDB: {str(e)}")
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
        """Update the status of an existing job in DynamoDB."""
        try:
            timestamp = datetime.utcnow().isoformat() + 'Z'
            
            # Build update expression dynamically
            update_expression = "SET #status = :status, updated_at = :updated_at"
            expression_attribute_names = {"#status": "status"}
            expression_attribute_values = {
                ":status": status,
                ":updated_at": timestamp
            }
            
            if result_s3_path is not None:
                update_expression += ", result_s3_path = :result_s3_path"
                expression_attribute_values[":result_s3_path"] = result_s3_path
                
            if num_pages is not None:
                update_expression += ", num_pages = :num_pages"
                expression_attribute_values[":num_pages"] = num_pages
                
            if result_score is not None:
                update_expression += ", result_score = :result_score"
                # Convert float to Decimal for DynamoDB compatibility
                if isinstance(result_score, float):
                    result_score = Decimal(str(result_score))
                expression_attribute_values[":result_score"] = result_score
                
            if download_data is not None:
                update_expression += ", download_data = :download_data"
                # Convert any float values in download_data to Decimal
                converted_download_data = self._convert_floats_to_decimal(download_data)
                expression_attribute_values[":download_data"] = converted_download_data

            if failure_reason is not None:
                update_expression += ", failure_reason = :failure_reason"
                expression_attribute_values[":failure_reason"] = failure_reason
                
            # Handle metadata updates
            if additional_fields:
                # Get current job to merge with existing metadata
                current_job = self.get_job(job_id)
                current_metadata = current_job.get('metadata', {}) if current_job else {}
                
                # Convert any float values in additional_fields to Decimal for DynamoDB compatibility
                converted_additional_fields = self._convert_floats_to_decimal(additional_fields)
                
                # Merge additional_fields with existing metadata
                merged_metadata = {**current_metadata, **converted_additional_fields}
                update_expression += ", metadata = :metadata"
                expression_attribute_values[":metadata"] = merged_metadata
            
            response = self.table.update_item(
                Key={"id": job_id},
                UpdateExpression=update_expression,
                ExpressionAttributeNames=expression_attribute_names,
                ExpressionAttributeValues=expression_attribute_values,
                ReturnValues="ALL_NEW"
            )
            
            if 'Attributes' in response:
                job = response['Attributes']
                logger.info(f"Job {job_id} status updated to: {status}")
                return job
            else:
                raise Exception(f"Failed to update job {job_id} - no data returned")
                
        except ClientError as e:
            logger.error(f"Error updating job {job_id} in DynamoDB: {str(e)}")
            raise

    def get_job_progress(self, job_id: str) -> Dict[str, Any]:
        """Get job progress from DynamoDB."""
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
        """Retrieve jobs for a specific user from DynamoDB.
        
        Note: This implementation assumes there's a GSI on user_id.
        For anonymous users, this might not be as useful.
        """
        try:
            # Use scan for simplicity - in production, you'd want a GSI on user_id
            scan_kwargs = {
                'FilterExpression': boto3.dynamodb.conditions.Attr('user_id').eq(user_id),
                'Limit': limit + offset  # We'll slice later to handle offset
            }
            
            if status:
                scan_kwargs['FilterExpression'] &= boto3.dynamodb.conditions.Attr('status').eq(status)
            
            response = self.table.scan(**scan_kwargs)
            items = response.get('Items', [])
            
            # Convert any float values to Decimal before returning
            converted_items = [self._convert_floats_to_decimal(item) for item in items]
            
            # Sort by created_at descending and apply offset/limit
            sorted_items = sorted(converted_items, key=lambda x: x.get('created_at', ''), reverse=True)
            return sorted_items[offset:offset + limit]
            
        except ClientError as e:
            logger.error(f"Error retrieving jobs for user {user_id} from DynamoDB: {str(e)}")
            raise

