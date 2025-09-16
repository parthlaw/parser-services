"""
CloudWatch metrics utility for publishing custom metrics to AWS CloudWatch.

This module provides a simple interface for sending custom metrics to CloudWatch,
with support for different metric types (Counter, Gauge, etc.) and dimensions.
"""

import boto3
import os
from typing import Dict, List, Optional, Union, Any
from datetime import datetime
from botocore.exceptions import BotoCoreError, ClientError
from utils.logger import get_logger

logger = get_logger(__name__)

# Initialize CloudWatch client
cloudwatch = boto3.client('cloudwatch', region_name=os.getenv('AWS_REGION', 'ap-south-1'))

class MetricUnit:
    """Constants for CloudWatch metric units"""
    COUNT = 'Count'
    PERCENT = 'Percent'
    SECONDS = 'Seconds'
    MILLISECONDS = 'Milliseconds'
    BYTES = 'Bytes'
    KILOBYTES = 'Kilobytes'
    MEGABYTES = 'Megabytes'
    GIGABYTES = 'Gigabytes'
    COUNT_PER_SECOND = 'Count/Second'


def put_metric(
    metric_name: str,
    value: Union[int, float],
    unit: str = MetricUnit.COUNT,
    dimensions: Optional[Dict[str, str]] = None,
    namespace: str = 'BankStatementParser',
    timestamp: Optional[datetime] = None
) -> bool:
    """
    Publish a single metric to CloudWatch.
    
    Args:
        metric_name: Name of the metric
        value: Numeric value of the metric
        unit: Unit of measurement (use MetricUnit constants)
        dimensions: Dictionary of dimension name-value pairs
        namespace: CloudWatch namespace (default: 'BankStatementParser')
        timestamp: Timestamp for the metric (default: current time)
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Prepare dimensions
        cloudwatch_dimensions = []
        if dimensions:
            cloudwatch_dimensions = [
                {'Name': key, 'Value': str(value)} 
                for key, value in dimensions.items()
            ]
        
        # Use current time if timestamp not provided
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        # Prepare metric data
        metric_data = {
            'MetricName': metric_name,
            'Value': float(value),
            'Unit': unit,
            'Timestamp': timestamp
        }
        
        if cloudwatch_dimensions:
            metric_data['Dimensions'] = cloudwatch_dimensions
        
        # Send metric to CloudWatch
        cloudwatch.put_metric_data(
            Namespace=namespace,
            MetricData=[metric_data]
        )
        
        logger.info(f"Successfully published metric: {metric_name}", extra_fields={
            'metric_name': metric_name,
            'value': value,
            'unit': unit,
            'dimensions': dimensions,
            'namespace': namespace
        })
        
        return True
        
    except (BotoCoreError, ClientError) as e:
        logger.error(f"Failed to publish metric {metric_name}: {str(e)}", extra_fields={
            'metric_name': metric_name,
            'value': value,
            'unit': unit,
            'dimensions': dimensions,
            'error': str(e)
        })
        return False
    except Exception as e:
        logger.error(f"Unexpected error publishing metric {metric_name}: {str(e)}", extra_fields={
            'metric_name': metric_name,
            'value': value,
            'error': str(e)
        })
        return False


def put_metrics(
    metrics: List[Dict[str, Any]],
    namespace: str = 'BankStatementParser'
) -> bool:
    """
    Publish multiple metrics to CloudWatch in a single API call.
    
    Args:
        metrics: List of metric dictionaries. Each dict should contain:
                - metric_name (str): Name of the metric
                - value (Union[int, float]): Metric value
                - unit (str, optional): Unit of measurement
                - dimensions (Dict[str, str], optional): Dimensions
                - timestamp (datetime, optional): Timestamp
        namespace: CloudWatch namespace (default: 'BankStatementParser')
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        if not metrics:
            logger.warning("No metrics provided to put_metrics")
            return True
        
        # Prepare metric data
        metric_data = []
        current_time = datetime.utcnow()
        
        for metric in metrics:
            # Validate required fields
            if 'metric_name' not in metric or 'value' not in metric:
                logger.error(f"Invalid metric data: {metric}")
                continue
            
            # Prepare dimensions
            cloudwatch_dimensions = []
            if 'dimensions' in metric and metric['dimensions']:
                cloudwatch_dimensions = [
                    {'Name': key, 'Value': str(value)} 
                    for key, value in metric['dimensions'].items()
                ]
            
            # Prepare metric data
            metric_item = {
                'MetricName': metric['metric_name'],
                'Value': float(metric['value']),
                'Unit': metric.get('unit', MetricUnit.COUNT),
                'Timestamp': metric.get('timestamp', current_time)
            }
            
            if cloudwatch_dimensions:
                metric_item['Dimensions'] = cloudwatch_dimensions
            
            metric_data.append(metric_item)
        
        if not metric_data:
            logger.warning("No valid metrics to send after validation")
            return False
        
        # Send metrics to CloudWatch (max 20 metrics per call)
        success = True
        for i in range(0, len(metric_data), 20):
            batch = metric_data[i:i+20]
            try:
                cloudwatch.put_metric_data(
                    Namespace=namespace,
                    MetricData=batch
                )
                logger.info(f"Successfully published {len(batch)} metrics to namespace {namespace}")
            except Exception as e:
                logger.error(f"Failed to publish metrics batch: {str(e)}")
                success = False
        
        return success
        
    except Exception as e:
        logger.error(f"Unexpected error publishing metrics: {str(e)}")
        return False


def increment_counter(
    metric_name: str,
    dimensions: Optional[Dict[str, str]] = None,
    namespace: str = 'BankStatementParser'
) -> bool:
    """
    Convenience function to increment a counter metric by 1.
    
    Args:
        metric_name: Name of the counter metric
        dimensions: Dictionary of dimension name-value pairs
        namespace: CloudWatch namespace (default: 'BankStatementParser')
    
    Returns:
        bool: True if successful, False otherwise
    """
    return put_metric(
        metric_name=metric_name,
        value=1,
        unit=MetricUnit.COUNT,
        dimensions=dimensions,
        namespace=namespace
    )


def record_processing_time(
    operation: str,
    duration_ms: float,
    dimensions: Optional[Dict[str, str]] = None,
    namespace: str = 'BankStatementParser'
) -> bool:
    """
    Convenience function to record processing time metrics.
    
    Args:
        operation: Name of the operation being measured
        duration_ms: Duration in milliseconds
        dimensions: Dictionary of dimension name-value pairs
        namespace: CloudWatch namespace (default: 'BankStatementParser')
    
    Returns:
        bool: True if successful, False otherwise
    """
    return put_metric(
        metric_name=f"{operation}.Duration",
        value=duration_ms,
        unit=MetricUnit.MILLISECONDS,
        dimensions=dimensions,
        namespace=namespace
    )


def record_job_result(
    job_id: str,
    user_id: str,
    result_score: float,
    num_pages: int,
    pipeline_name: str,
    success: bool = True,
    namespace: str = 'BankStatementParser'
) -> bool:
    """
    Convenience function to record job processing results.
    
    Args:
        job_id: Job identifier
        user_id: User identifier
        result_score: Quality score of the parsing result
        num_pages: Number of pages processed
        pipeline_name: Name of the processing pipeline used
        success: Whether the job was successful
        namespace: CloudWatch namespace (default: 'BankStatementParser')
    
    Returns:
        bool: True if successful, False otherwise
    """
    dimensions = {
        'Pipeline': pipeline_name,
        'Status': 'Success' if success else 'Error'
    }
    
    metrics = [
        {
            'metric_name': 'JobCompleted',
            'value': 1,
            'unit': MetricUnit.COUNT,
            'dimensions': dimensions
        },
        {
            'metric_name': 'ResultScore',
            'value': result_score,
            'unit': MetricUnit.PERCENT,
            'dimensions': dimensions
        },
        {
            'metric_name': 'PagesProcessed',
            'value': num_pages,
            'unit': MetricUnit.COUNT,
            'dimensions': dimensions
        }
    ]
    
    return put_metrics(metrics, namespace)


# Example usage and commonly used metrics
def record_api_call(
    endpoint: str,
    method: str,
    status_code: int,
    response_time_ms: float,
    user_id: Optional[str] = None,
    namespace: str = 'BankStatementParser'
) -> bool:
    """
    Record API call metrics.
    
    Args:
        endpoint: API endpoint called
        method: HTTP method
        status_code: HTTP status code
        response_time_ms: Response time in milliseconds
        user_id: User identifier (optional)
        namespace: CloudWatch namespace (default: 'BankStatementParser')
    
    Returns:
        bool: True if successful, False otherwise
    """
    dimensions = {
        'Endpoint': endpoint,
        'Method': method,
        'StatusCode': str(status_code)
    }
    
    metrics = [
        {
            'metric_name': 'APICall',
            'value': 1,
            'unit': MetricUnit.COUNT,
            'dimensions': dimensions
        },
        {
            'metric_name': 'APIResponseTime',
            'value': response_time_ms,
            'unit': MetricUnit.MILLISECONDS,
            'dimensions': dimensions
        }
    ]
    
    return put_metrics(metrics, namespace)
