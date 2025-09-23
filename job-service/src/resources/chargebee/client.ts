import getEnvVar from '../../config/environment';
import Chargebee from 'chargebee';
import logger from '../../utils/logger';

let chargebeeClient: Chargebee | null = null;

export const getChargebeeClient = (): Chargebee => {
  if (!chargebeeClient) {
    try {
      console.log(process.env);
      chargebeeClient = new Chargebee({
        site: getEnvVar.CHARGEBEE_SITE,
        apiKey: getEnvVar.CHARGEBEE_API_KEY,
      });

      logger.info('Chargebee client initialized successfully', {
        site: getEnvVar.CHARGEBEE_SITE,
        hasApiKey: !!getEnvVar.CHARGEBEE_API_KEY,
      });
    } catch (error) {
      logger.error('Failed to initialize Chargebee client', { error });
      throw error;
    }
  }
  return chargebeeClient;
};

export const closeChargebeeConnection = async (): Promise<void> => {
  // Chargebee client doesn't require explicit cleanup
  chargebeeClient = null;
  logger.info('Chargebee client connection closed');
};
