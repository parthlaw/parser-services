import logger from "@/utils/logger";

type CommandInput = Record<string, unknown>;

export async function sendWithHandling<TResponse>(
  opName: string,
  tableName: string,
  send: () => Promise<TResponse>,
  context?: CommandInput,
): Promise<TResponse> {
  try {
    const result = await send();
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


