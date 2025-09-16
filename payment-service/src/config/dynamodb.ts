import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import config from "./environment";

const isLocal = Boolean(config.DYNAMO_ENDPOINT);

const client = new DynamoDBClient({
  region: config.AWS_REGION,
  ...(isLocal
    ? {
        endpoint: config.DYNAMO_ENDPOINT,
        credentials: {
          accessKeyId: "dummy",       // required for local
          secretAccessKey: "dummy",   // required for local
        },
      }
    : {}),
});

const ddbDocClient = DynamoDBDocumentClient.from(client);

export default ddbDocClient;
