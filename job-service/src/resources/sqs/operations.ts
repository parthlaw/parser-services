import {
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  SendMessageBatchCommand,
  SendMessageBatchRequestEntry,
  Message,
} from '@aws-sdk/client-sqs';
import { getSQSClient } from './client';
import getEnvVar from '../../config/environment';
import logger from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export const getQueueUrl = (queueName: string): string => {
  const QUEUE_URL = 'https://sqs.ap-south-1.amazonaws.com/851725386253/' + queueName;
  return QUEUE_URL;
};
const defaultQueueUrl = getQueueUrl(getEnvVar.QUEUE_NAME);
export const sendMessage = async (
  messageBody: string,
  queueUrl: string = defaultQueueUrl,
  messageAttributes?: Record<string, any>,
  delaySeconds?: number,
  messageGroupId?: string
): Promise<string> => {
  const client = getSQSClient();
  try {
    if (!messageGroupId) {
      messageGroupId = uuidv4();
    }
    const result = await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: messageBody,
        MessageAttributes: messageAttributes,
        DelaySeconds: delaySeconds,
        MessageGroupId: messageGroupId,
      })
    );
    return result.MessageId!;
  } catch (error) {
    logger.error('Failed to send message to SQS', { error, queueUrl, messageBody });
    throw error;
  }
};

export const receiveMessages = async (
  queueUrl: string = defaultQueueUrl,
  maxNumberOfMessages: number = 1,
  visibilityTimeout?: number,
  waitTimeSeconds?: number
): Promise<Message[]> => {
  const client = getSQSClient();
  try {
    const result = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: maxNumberOfMessages,
        VisibilityTimeout: visibilityTimeout,
        WaitTimeSeconds: waitTimeSeconds,
      })
    );
    return result.Messages || [];
  } catch (error) {
    logger.error('Failed to receive messages from SQS', { error, queueUrl });
    throw error;
  }
};

export const deleteMessage = async (
  receiptHandle: string,
  queueUrl: string = defaultQueueUrl
): Promise<void> => {
  const client = getSQSClient();
  try {
    await client.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
      })
    );
  } catch (error) {
    logger.error('Failed to delete message from SQS', { error, queueUrl, receiptHandle });
    throw error;
  }
};

export const sendMessageBatch = async (
  entries: Array<{
    id: string;
    messageBody: string;
    messageAttributes?: Record<string, any>;
    delaySeconds?: number;
  }>,
  queueUrl: string = defaultQueueUrl
) => {
  const client = getSQSClient();
  try {
    const batchEntries: SendMessageBatchRequestEntry[] = entries.map((entry) => ({
      Id: entry.id,
      MessageBody: entry.messageBody,
      MessageAttributes: entry.messageAttributes,
      DelaySeconds: entry.delaySeconds,
    }));

    const result = await client.send(
      new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: batchEntries,
      })
    );

    return {
      successful: result.Successful || [],
      failed: result.Failed || [],
    };
  } catch (error) {
    logger.error('Failed to send message batch to SQS', {
      error,
      queueUrl,
      entriesCount: entries.length,
    });
    throw error;
  }
};
