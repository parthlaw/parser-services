import { SQSClient } from '@aws-sdk/client-sqs';

let sqsClient: SQSClient | null = null;

export const getSQSClient = (): SQSClient => {
  if (!sqsClient) {
    sqsClient = new SQSClient();
  }
  return sqsClient;
};

export const closeSQSConnection = async (): Promise<void> => {
  if (sqsClient) {
    sqsClient.destroy();
    sqsClient = null;
  }
};
