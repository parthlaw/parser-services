// Test setup file for Jest
// This file runs before each test

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Mock console methods to reduce test output noise
const originalConsole = global.console;

beforeAll(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

afterAll(() => {
  global.console = originalConsole;
});
