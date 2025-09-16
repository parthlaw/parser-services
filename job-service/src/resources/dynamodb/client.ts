import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import logger from '@/utils/logger';

export class DynamoDBResource {
  private static instance: DynamoDBResource;
  private readonly client: DynamoDBClient;
  private readonly docClient: DynamoDBDocumentClient;

  private constructor() {

    // Log the configuration being used
    logger.info('DynamoDB client configuration', {
      region: process.env.AWS_REGION,
      endpoint: process.env.DYNAMO_ENDPOINT,
      nodeEnv: process.env.NODE_ENV,
      stage: process.env.STAGE,
    });

    this.client = new DynamoDBClient();
    this.docClient = DynamoDBDocumentClient.from(this.client);
  }

  public static getInstance(): DynamoDBResource {
    if (!DynamoDBResource.instance) {
      DynamoDBResource.instance = new DynamoDBResource();
    }
    return DynamoDBResource.instance;
  }

  public getDocumentClient(): DynamoDBDocumentClient {
    return this.docClient;
  }

  public async executeOperation<TResponse>(
    opName: string,
    tableName: string,
    operation: () => Promise<TResponse>,
    context?: Record<string, unknown>
  ): Promise<TResponse> {
    try {
      const result = await operation();
      return result;
    } catch (error) {
      logger.error(`DynamoDB ${opName} failed`, {
        error,
        table: tableName,
        ...(context && { context }),
      });
      throw error;
    }
  }
}
