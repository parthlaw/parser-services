from typing import List, Optional, Union
import boto3
import json

from botocore.exceptions import BotoCoreError, ClientError
import io
from utils.logger import get_logger

logger = get_logger(__name__)


s3 = boto3.Session().client("s3", region_name="ap-south-1")


def get_s3_key(prefix: str, user_id: Optional[str],job_id: str, file_name: str):
    if user_id is not None:
        return prefix + "/" + user_id + "/" + job_id + "/" + file_name
    return prefix + "/" + job_id + "/" + file_name


def save_dict_to_s3(
    data: Union[dict, list],
    bucket_name: str,
    object_key: str,
) -> bool:
    try:
        json_data = json.dumps(data)
        s3.put_object(Bucket=bucket_name, Key=object_key, Body=json_data)
        logger.info("Successfully uploaded to S3", 
                   bucket=bucket_name, 
                   object_key=object_key)
        return True
    except (BotoCoreError, ClientError) as e:
        logger.error("Failed to upload to S3", 
                    bucket=bucket_name, 
                    object_key=object_key, 
                    exc_info=True)
        return False


def get_object_from_s3(bucket_name: str, object_key: str) -> Union[dict, list, None]:
    try:
        response = s3.get_object(Bucket=bucket_name, Key=object_key)
        data = response["Body"].read().decode("utf-8")
        return json.loads(data)
    except Exception as e:
        logger.error("Failed to retrieve from S3", 
                    bucket=bucket_name, 
                    object_key=object_key, 
                    exc_info=True)
        return None


def generate_presigned_url(
    bucket_name: str, object_key: str, expiration: int = 3600
) -> str:
    """
    Generate a presigned URL for uploading to S3

    Args:
        bucket_name: Name of the S3 bucket
        object_key: Key (path) where the object will be stored
        expiration: Time in seconds for the presigned URL to remain valid

    Returns:
        str: Presigned URL for uploading
    """
    try:
        response = s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": bucket_name,
                "Key": object_key,
                "ContentType": "application/pdf",  # Adjust content type as needed
            },
            ExpiresIn=expiration,
        )
        return response
    except ClientError as e:
        raise Exception(f"Error generating presigned URL: {str(e)}")


def get_pdf_from_s3(bucket: str, key: str) -> io.BytesIO:
    try:
        """
        Download a PDF file from S3 and return it as a BytesIO stream.
        """
        response = s3.get_object(Bucket=bucket, Key=key)
        return response["Body"].read()
        return io.BytesIO(response["Body"].read())
    except Exception as e:
        logger.error("Error getting PDF from S3", 
                    bucket=bucket, 
                    key=key, 
                    exc_info=True)
        raise e


def get_pdf_s3_results_key(
        source_key:str,
        format:str="json"
) -> str:
    if not source_key.lower().endswith(".pdf"):
        return ""
    return f"{source_key[:-4]}.{format}"


def upload_file_to_s3(local_filepath: str, bucket_name: str, object_key: str) -> bool:
    """
    Upload a local file to S3.
    
    Args:
        local_filepath: Path to the local file
        bucket_name: Name of the S3 bucket
        object_key: S3 key where the file will be stored
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        with open(local_filepath, 'rb') as f:
            s3.upload_fileobj(f, bucket_name, object_key)
        logger.info("Successfully uploaded file to S3", 
                   local_filepath=local_filepath, 
                   bucket=bucket_name, 
                   object_key=object_key)
        return True
    except Exception as e:
        logger.error("Failed to upload file to S3", 
                    local_filepath=local_filepath, 
                    bucket=bucket_name, 
                    object_key=object_key, 
                    exc_info=True)
        return False


def download_file_from_s3(bucket_name: str, object_key: str, local_filepath: str) -> bool:
    """
    Download a file from S3 to local disk.
    
    Args:
        bucket_name: Name of the S3 bucket
        object_key: S3 key of the file to download
        local_filepath: Local path where the file will be saved
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        s3.download_file(bucket_name, object_key, local_filepath)
        logger.info("Successfully downloaded file from S3", 
                   bucket=bucket_name, 
                   object_key=object_key, 
                   local_filepath=local_filepath)
        return True
    except Exception as e:
        logger.error("Failed to download file from S3", 
                    bucket=bucket_name, 
                    object_key=object_key, 
                    local_filepath=local_filepath, 
                    exc_info=True)
        return False


def check_object_exists(bucket_name: str, object_key: str) -> bool:
    """
    Check if an object exists in S3.
    
    Args:
        bucket_name: Name of the S3 bucket
        object_key: S3 key to check
        
    Returns:
        bool: True if object exists, False otherwise
    """
    try:
        s3.head_object(Bucket=bucket_name, Key=object_key)
        return True
    except ClientError as e:
        if e.response['Error']['Code'] == '404':
            return False
        else:
            logger.error("Error checking if S3 object exists", 
                        bucket=bucket_name, 
                        object_key=object_key, 
                        exc_info=True)
            return False


def list_object_keys_by_prefix(prefix: str, bucket: str) -> List[str]:
    keys = []
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            keys.append(obj["Key"])
    return keys
