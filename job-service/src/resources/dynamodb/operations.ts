import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBResource } from './client';

export interface DynamoDBGetParams {
  tableName: string;
  key: Record<string, unknown>;
}

export interface DynamoDBPutParams {
  tableName: string;
  item: Record<string, unknown>;
}

export interface DynamoDBUpdateParams {
  tableName: string;
  key: Record<string, unknown>;
  updateExpression: string;
  expressionAttributeNames: Record<string, string>;
  expressionAttributeValues: Record<string, unknown>;
  returnValues?: string;
}

export class DynamoDBOperations {
  private readonly dynamoDB: DynamoDBResource;

  constructor() {
    this.dynamoDB = DynamoDBResource.getInstance();
  }

  async get<T>(params: DynamoDBGetParams): Promise<T | null> {
    const result = await this.dynamoDB.executeOperation(
      'GetItem',
      params.tableName,
      () =>
        this.dynamoDB.getDocumentClient().send(
          new GetCommand({
            TableName: params.tableName,
            Key: params.key,
          })
        ),
      { key: params.key }
    );

    return (result.Item as T) || null;
  }

  async put<T>(params: DynamoDBPutParams): Promise<T> {
    await this.dynamoDB.executeOperation(
      'PutItem',
      params.tableName,
      () =>
        this.dynamoDB.getDocumentClient().send(
          new PutCommand({
            TableName: params.tableName,
            Item: params.item,
          })
        ),
      { item: params.item }
    );

    return params.item as T;
  }

  async update<T>(params: DynamoDBUpdateParams): Promise<T> {
    const result = await this.dynamoDB.executeOperation(
      'UpdateItem',
      params.tableName,
      () =>
        this.dynamoDB.getDocumentClient().send(
          new UpdateCommand({
            TableName: params.tableName,
            Key: params.key,
            UpdateExpression: params.updateExpression,
            ExpressionAttributeNames: params.expressionAttributeNames,
            ExpressionAttributeValues: params.expressionAttributeValues,
            ReturnValues: (params.returnValues || 'ALL_NEW') as
              | 'ALL_NEW'
              | 'UPDATED_OLD'
              | 'UPDATED_NEW'
              | 'ALL_OLD'
              | undefined,
          })
        ),
      { key: params.key }
    );

    return result.Attributes as T;
  }
}
