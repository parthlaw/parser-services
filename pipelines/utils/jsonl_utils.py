import json
import os
from typing import Iterator, Any, List
from utils import s3_utils, constants
from utils.logger import get_logger

logger = get_logger(__name__)


class JSONLManager:
    """Utility class for managing JSONL files with S3 persistence."""
    
    def __init__(self, temp_dir: str = "/tmp"):
        self.temp_dir = temp_dir
        os.makedirs(temp_dir, exist_ok=True)
    
    def get_temp_filepath(self, job_id: str, step_name: str) -> str:
        """Generate a temporary file path for a step's output."""
        filename = f"{job_id}_{step_name}.jsonl"
        return os.path.join(self.temp_dir, filename)
    
    def write_jsonl_streaming(self, filepath: str, data_iterator: Iterator[Any]) -> int:
        """Write data to JSONL file line by line. Returns number of items written."""
        count = 0
        with open(filepath, 'w', encoding='utf-8') as f:
            for item in data_iterator:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')
                count += 1
        return count
    
    def read_jsonl_streaming(self, filepath: str) -> Iterator[Any]:
        """Read JSONL file line by line."""
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"JSONL file not found: {filepath}")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except json.JSONDecodeError as e:
                    logger.warning("Invalid JSON line in file", 
                                  line_number=line_num, 
                                  filepath=filepath, 
                                  error=str(e))
                    continue
    
    def append_to_jsonl(self, filepath: str, item: Any) -> None:
        """Append a single item to JSONL file."""
        with open(filepath, 'a', encoding='utf-8') as f:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
    
    def save_jsonl_to_s3(self, local_filepath: str, s3_key: str) -> bool:
        """Upload JSONL file to S3 using s3_utils."""
        return s3_utils.upload_file_to_s3(local_filepath, constants.BUCKET_NAME, s3_key)
    
    def download_jsonl_from_s3(self, s3_key: str, local_filepath: str) -> bool:
        """Download JSONL file from S3 to local disk using s3_utils."""
        return s3_utils.download_file_from_s3(constants.BUCKET_NAME, s3_key, local_filepath)
    
    def check_s3_object_exists(self, s3_key: str) -> bool:
        """Check if a JSONL file exists in S3 using s3_utils."""
        return s3_utils.check_object_exists(constants.BUCKET_NAME, s3_key)
    
    def cleanup_local_file(self, filepath: str) -> None:
        """Remove local file safely."""
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
                logger.debug("Cleaned up local file", filepath=filepath)
        except Exception as e:
            logger.warning("Failed to cleanup local file", 
                          filepath=filepath, 
                          error=str(e))
    
    def get_s3_step_key(self, user_id: str, job_id: str, step_name: str) -> str:
        """Generate S3 key for step output."""
        prefix = constants.BANK_STATEMENT_S3_PREFIX_AUTH if user_id else constants.BANK_STATEMENT_S3_PREFIX
        return s3_utils.get_s3_key(
            prefix,
            user_id if user_id else None,
            job_id,
            f"{step_name}.jsonl"
        )


def create_jsonl_manager() -> JSONLManager:
    """Factory function to create JSONLManager instance."""
    return JSONLManager()


def write_items_to_jsonl(items: List[Any], filepath: str) -> int:
    """Convenience function to write a list of items to JSONL."""
    manager = create_jsonl_manager()
    return manager.write_jsonl_streaming(filepath, iter(items))


def read_jsonl_as_list(filepath: str) -> List[Any]:
    """Convenience function to read entire JSONL file into memory (use carefully)."""
    manager = create_jsonl_manager()
    return list(manager.read_jsonl_streaming(filepath))
