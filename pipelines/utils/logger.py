import logging
import json
import os
import sys
import traceback
from typing import Any, Dict
from datetime import datetime


class StructuredFormatter(logging.Formatter):
    """
    Custom formatter that outputs structured JSON logs for better parsing in AWS CloudWatch
    """
    
    def __init__(self):
        super().__init__()
    
    def format(self, record: logging.LogRecord) -> str:
        # Base log structure
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add AWS Lambda context if available
        if hasattr(record, 'aws_request_id'):
            log_entry["aws_request_id"] = record.aws_request_id
        
        # Add custom context if available
        if hasattr(record, 'job_id'):
            log_entry["job_id"] = record.job_id
        if hasattr(record, 'user_id'):
            log_entry["user_id"] = record.user_id
        if hasattr(record, 'step_name'):
            log_entry["step_name"] = record.step_name
        if hasattr(record, 'pipeline_name'):
            log_entry["pipeline_name"] = record.pipeline_name
        
        # Add extra fields if present
        if hasattr(record, 'extra_fields') and record.extra_fields:
            log_entry.update(record.extra_fields)
        
        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": traceback.format_exception(*record.exc_info)
            }
        
        return json.dumps(log_entry, ensure_ascii=False, default=str)


class SimpleFormatter(logging.Formatter):
    """
    Simple formatter for local development
    """
    
    def __init__(self):
        super().__init__(
            fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )


class BankStatementLogger:
    """
    Enhanced logger for bank statement processing with context management
    """
    
    def __init__(self, name: str, level: str = None):
        self.logger = logging.getLogger(name)
        self.context = {}
        
        # Set log level based on stage and environment
        if level:
            log_level = level.upper()
        else:
            stage = os.environ.get('STAGE', 'dev').lower()
            if stage == 'prod':
                # In production, default to INFO to avoid debug logs
                log_level = os.environ.get('LOG_LEVEL', 'INFO').upper()
            else:
                # In development/staging, allow DEBUG by default
                log_level = os.environ.get('LOG_LEVEL', 'DEBUG').upper()
        
        self.logger.setLevel(getattr(logging, log_level, logging.INFO))
        
        # Avoid adding handlers multiple times
        if not self.logger.handlers:
            self._setup_handlers()
    
    def _setup_handlers(self):
        """Setup appropriate handlers based on environment"""
        # Check if we're in AWS Lambda
        is_lambda = os.environ.get('AWS_LAMBDA_FUNCTION_NAME') is not None
        
        handler = logging.StreamHandler(sys.stdout)
        
        if is_lambda or os.environ.get('STRUCTURED_LOGGING', 'false').lower() == 'true':
            # Use structured JSON logging for AWS Lambda or when explicitly enabled
            formatter = StructuredFormatter()
        else:
            # Use simple formatting for local development
            formatter = SimpleFormatter()
        
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)
        
        # Prevent propagation to root logger to avoid duplicate logs
        self.logger.propagate = False
    
    def set_context(self, **kwargs):
        """Set context that will be included in all subsequent logs"""
        self.context.update(kwargs)
    
    def clear_context(self):
        """Clear all context"""
        self.context.clear()
    
    def _log_with_context(self, level: int, message: str, extra_fields: Dict[str, Any] = None, **kwargs):
        """Internal method to log with context"""
        # Merge context with extra fields
        merged_extra = {**self.context}
        if extra_fields:
            merged_extra.update(extra_fields)
        
        # Create a custom LogRecord to include our context
        record = self.logger.makeRecord(
            self.logger.name, level, "", 0, message, (), None
        )
        
        # Add context fields to the record
        for key, value in merged_extra.items():
            setattr(record, key, value)
        
        # Add any additional kwargs as extra_fields
        if kwargs:
            setattr(record, 'extra_fields', kwargs)
        
        self.logger.handle(record)
    
    def debug(self, message: str, extra_fields: Dict[str, Any] = None, **kwargs):
        """Log debug message"""
        self._log_with_context(logging.DEBUG, message, extra_fields, **kwargs)
    
    def info(self, message: str, extra_fields: Dict[str, Any] = None, **kwargs):
        """Log info message"""
        self._log_with_context(logging.INFO, message, extra_fields, **kwargs)
    
    def warning(self, message: str, extra_fields: Dict[str, Any] = None, **kwargs):
        """Log warning message"""
        self._log_with_context(logging.WARNING, message, extra_fields, **kwargs)
    
    def error(self, message: str, extra_fields: Dict[str, Any] = None, exc_info: bool = True, **kwargs):
        """Log error message with optional exception info"""
        record = self.logger.makeRecord(
            self.logger.name, logging.ERROR, "", 0, message, (), 
            sys.exc_info() if exc_info else None
        )
        
        # Add context
        merged_extra = {**self.context}
        if extra_fields:
            merged_extra.update(extra_fields)
        
        for key, value in merged_extra.items():
            setattr(record, key, value)
        
        if kwargs:
            setattr(record, 'extra_fields', kwargs)
        
        self.logger.handle(record)
    
    def critical(self, message: str, extra_fields: Dict[str, Any] = None, exc_info: bool = True, **kwargs):
        """Log critical message with optional exception info"""
        record = self.logger.makeRecord(
            self.logger.name, logging.CRITICAL, "", 0, message, (), 
            sys.exc_info() if exc_info else None
        )
        
        # Add context
        merged_extra = {**self.context}
        if extra_fields:
            merged_extra.update(extra_fields)
        
        for key, value in merged_extra.items():
            setattr(record, key, value)
        
        if kwargs:
            setattr(record, 'extra_fields', kwargs)
        
        self.logger.handle(record)
    
    def log_step_start(self, step_name: str, job_id: str = None, user_id: str = None, **kwargs):
        """Log the start of a pipeline step"""
        extra = {"step_name": step_name, "step_status": "started"}
        if job_id:
            extra["job_id"] = job_id
        if user_id:
            extra["user_id"] = user_id
        extra.update(kwargs)
        
        self.info(f"Starting step: {step_name}", extra_fields=extra)
    
    def log_step_end(self, step_name: str, duration_ms: int = None, items_processed: int = None, 
                     job_id: str = None, user_id: str = None, **kwargs):
        """Log the end of a pipeline step"""
        extra = {"step_name": step_name, "step_status": "completed"}
        if duration_ms is not None:
            extra["duration_ms"] = duration_ms
        if items_processed is not None:
            extra["items_processed"] = items_processed
        if job_id:
            extra["job_id"] = job_id
        if user_id:
            extra["user_id"] = user_id
        extra.update(kwargs)
        
        self.info(f"Completed step: {step_name}", extra_fields=extra)
    
    def log_step_error(self, step_name: str, error: Exception, job_id: str = None, 
                       user_id: str = None, **kwargs):
        """Log a step error"""
        extra = {"step_name": step_name, "step_status": "failed"}
        if job_id:
            extra["job_id"] = job_id
        if user_id:
            extra["user_id"] = user_id
        extra.update(kwargs)
        
        self.error(f"Step failed: {step_name} - {str(error)}", extra_fields=extra)
    
    def log_job_progress(self, job_id: str, user_id: str, current_step: str, 
                        total_steps: int, completed_steps: int, **kwargs):
        """Log job progress"""
        progress_pct = (completed_steps / total_steps * 100) if total_steps > 0 else 0
        extra = {
            "job_id": job_id,
            "user_id": user_id,
            "current_step": current_step,
            "total_steps": total_steps,
            "completed_steps": completed_steps,
            "progress_percentage": round(progress_pct, 2)
        }
        extra.update(kwargs)
        
        self.info(f"Job progress: {completed_steps}/{total_steps} steps completed", extra_fields=extra)


# Utility functions for easy logger creation
def get_logger(name: str = None, level: str = None) -> BankStatementLogger:
    """
    Get a logger instance with the given name.
    If name is not provided, uses the calling module's name.
    """
    if name is None:
        # Get the calling module's name
        frame = sys._getframe(1)
        name = frame.f_globals.get('__name__', 'unknown')
    
    return BankStatementLogger(name, level)


def get_step_logger(step_name: str, job_id: str = None, user_id: str = None) -> BankStatementLogger:
    """
    Get a logger specifically configured for a pipeline step
    """
    logger = get_logger(f"step.{step_name}")
    
    # Set context
    context = {"step_name": step_name}
    if job_id:
        context["job_id"] = job_id
    if user_id:
        context["user_id"] = user_id
    
    logger.set_context(**context)
    return logger


def configure_third_party_loggers():
    """
    Configure third-party library loggers to reduce noise
    """
    # Suppress noisy loggers
    logging.getLogger("pdfminer").setLevel(logging.ERROR)
    logging.getLogger("boto3").setLevel(logging.WARNING)
    logging.getLogger("botocore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("requests").setLevel(logging.WARNING)


# Configure third-party loggers on import
configure_third_party_loggers()


# Example usage patterns:
if __name__ == "__main__":
    # Basic usage
    logger = get_logger(__name__)
    logger.info("This is a test message")
    
    # With context
    logger.set_context(job_id="job_123", user_id="user_456")
    logger.info("Processing started")
    
    # Step logging
    step_logger = get_step_logger("header_extraction", "job_123", "user_456")
    step_logger.log_step_start("header_extraction")
    step_logger.info("Extracting headers from document")
    step_logger.log_step_end("header_extraction", duration_ms=1500, items_processed=10)
    
    # Error logging
    try:
        raise ValueError("Test error")
    except Exception:
        logger.error("An error occurred during processing")
