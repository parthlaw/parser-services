import request from 'supertest';
import createApp from '../../app';

const app = createApp();

describe('Health Controller', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Service is healthy',
        data: {
          status: 'healthy',
          environment: 'test',
          version: 'v1',
        },
      });

      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('uptime');
      expect(response.body.data).toHaveProperty('memory');
    });
  });

  describe('GET /health/info', () => {
    it('should return API information', async () => {
      const response = await request(app)
        .get('/health/info')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'API information retrieved successfully',
        data: {
          name: 'Payment-Service',
          version: 'v1',
          environment: 'test',
          description: 'Modern serverless Express API with TypeScript',
        },
      });

      expect(response.body.data).toHaveProperty('endpoints');
    });
  });

  describe('GET /ping', () => {
    it('should return pong', async () => {
      const response = await request(app)
        .get('/ping')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'pong',
      });

      expect(response.body).toHaveProperty('timestamp');
    });
  });
});
