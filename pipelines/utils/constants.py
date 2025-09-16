import os


BANK_STATEMENT_S3_PREFIX = "bank-statements"
BANK_STATEMENT_S3_PREFIX_AUTH = "bank-statements-auth"
CURRENT_GENERIC_VERSION = "v4"
BUCKET_NAME = os.environ.get("BUCKET_NAME") or "parser-service-uploads"
QUEUE_URL = "https://sqs.ap-south-1.amazonaws.com/851725386253/"+os.environ.get("QUEUE_NAME","parser-service-dev-queue.fifo")
DATE = "date"
PARTICULARS = "particulars"
AMOUNT = "amount"
CREDIT = "credit"
DEBIT = "debit"
BALANCE = "balance"
