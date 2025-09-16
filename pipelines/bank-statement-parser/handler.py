import json
import sys
import os
sys.path.append(os.path.dirname(__file__))

from resources import JobStatus, create_job_data_instance
from v2.bank_statement_parser import BankStatementParser
import logging

logging.getLogger("pdfminer").setLevel(logging.ERROR)


def main(event, context):
    try:
        for record in event["Records"]:
            body = record["body"]  # This is a string
            message = json.loads(body)  # Convert to dict

            filename = message.get("filename")
            mode = message.get("mode", "generic")
            job_id = message.get("job_id")  # This will be None for non-logged-in users
            source_key = message.get("source_key")
            user_id = message.get("user_id")
            pages = message.get("pages")
            is_logged_in_user = job_id is not None

            print(
                f"Processing message - , Filename: {filename}, Mode: {mode}, Job ID: {job_id}, Logged in: {is_logged_in_user}"
            )

            # Update job status if job_id provided (logged-in users only)
            if is_logged_in_user:
                try:
                    # Create job data instance and verify job exists
                    job_data = create_job_data_instance(
                        job_id=job_id,
                        user_id=user_id,
                        job_data={},
                        is_logged_in=True
                    )
                    job = job_data.get_job(job_id)
                    if job:
                        job_data.update_job_status(
                            job_id,
                            JobStatus.PROCESSING,
                            additional_fields={
                                "current_mode": mode,
                                "worker_started_at": json.dumps(
                                    {"timestamp": "now"}, default=str
                                ),
                            }
                        )
                    else:
                        print(f"Warning: Job {job_id} not found in database")
                except Exception as job_error:
                    print(f"Error updating job status: {str(job_error)}")
                    # Continue processing even if job update fails
            else:
                print(
                    f"Processing for non-logged-in user (job_id: {job_id}) - skipping database operations"
                )

            try:
                parser_pipeline = BankStatementParser(
                    source_key=source_key,
                    filename=filename,
                    mode=mode,
                    job_id=job_id,
                    user_id=user_id,
                    pages=pages
                )
                result = parser_pipeline.get_results()

                # Update job status on successful completion (logged-in users only)
                # if is_logged_in_user and result:
                #     try:
                #         result_s3_key = parser_pipeline._get_result_key()
                #         update_job_status(
                #             job_id,
                #             JobStatus.SUCCESS,
                #             result_s3_path=result_s3_key,
                #             additional_fields={
                #                 "completed_mode": mode,
                #                 "result_size": (
                #                     len(result) if isinstance(result, list) else 1
                #                 ),
                #             },
                #         )
                #         print(f"Successfully completed job {job_id} in {mode} mode")
                #     except Exception as job_update_error:
                #         print(
                #             f"Failed to update job success status: {str(job_update_error)}"
                #         )
                # elif not is_logged_in_user and result:
                #     print(
                #         f"Successfully processed file for non-logged-in user (job_id: {job_id}) in {mode} mode"
                #     )

            except Exception as parse_error:
                print(f"Parser error for {mode} mode: {str(parse_error)}")

                # Update job status on failure (logged-in users only)
                if is_logged_in_user:
                    try:
                        job_data = create_job_data_instance(
                            job_id=job_id,
                            user_id=user_id,
                            job_data={},
                            is_logged_in=True
                        )
                        job_data.update_job_status(
                            job_id,
                            JobStatus.FAILED,
                            additional_fields={
                                "failed_mode": mode,
                                "error_message": str(parse_error),
                                "error_type": type(parse_error).__name__,
                            }
                        )
                    except Exception as job_update_error:
                        print(
                            f"Failed to update job failure status: {str(job_update_error)}"
                        )
                else:
                    print(
                        f"Processing failed for non-logged-in user (job_id: {job_id}): {str(parse_error)}"
                    )

                # Re-raise to ensure Lambda marks as failed
                raise parse_error

        return {"statusCode": 200, "message": "Processing completed"}

    except Exception as e:
        print(f"Exception in handler: {str(e)}")
        return {"statusCode": 500, "error": str(e)}
