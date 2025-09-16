# Job Service

A modern, serverless Node.js Express API built with TypeScript, designed for deployment on AWS Lambda using the Serverless Framework.

## Features

- 🚀 **Modern Architecture**: Built with TypeScript and Express.js
- 🔒 **Authentication**: JWT-based authentication with role-based authorization
- 📝 **Logging**: Comprehensive logging with Winston
- 🛡️ **Security**: Helmet, CORS, and input validation
- 🌐 **Serverless**: Ready for AWS Lambda deployment
- 🔧 **Development**: Hot reload with nodemon
- 📊 **Health Checks**: Built-in health monitoring endpoints
- 🎯 **Error Handling**: Centralized error handling with proper HTTP status codes

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- AWS CLI (for deployment)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd job-service
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Create a .env file with the following content:
NODE_ENV=development
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE_IN=7d
AWS_REGION=us-east-1
API_VERSION=v1
CORS_ORIGIN=*
LOG_LEVEL=info
DYNAMO_ENDPOINT=http://localhost:8000
```

4. Start development server:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## Local Development

### Running the Server Locally

The server can run in two modes:

1. **Local Development Mode** (default when `NODE_ENV=development`):
   - Server runs on `localhost:PORT` (default: 3000)
   - Full Express.js server with hot reload via nodemon
   - Perfect for development and testing

2. **Serverless Mode**:
   - Exports handler for AWS Lambda deployment
   - Used when deployed to AWS

### Development Commands

```bash
# Start development server with hot reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Start production server (after building)
npm start

# Run tests
npm test

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Local Development Features

- **Hot Reload**: Automatically restarts server on file changes
- **TypeScript Support**: Full TypeScript compilation and type checking
- **Environment Variables**: Loaded from `.env` file
- **Logging**: Detailed console logging for debugging
- **Health Checks**: Available at `/health` endpoint
- **CORS**: Enabled for local development

## Environment Variables

Create a `.env` file in the root directory:

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE_IN=7d
AWS_REGION=us-east-1
API_VERSION=v1
CORS_ORIGIN=*
LOG_LEVEL=info
```

## API Endpoints

### Health Check
- `GET /ping` - Simple ping endpoint
- `GET /health` - Detailed health check
- `GET /health/info` - API information

### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/auth/profile` - Get user profile (requires authentication)

### Example Requests

#### Register User
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "role": "user"
  }'
```

#### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

#### Get Profile (with JWT token)
```bash
curl -X GET http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors automatically
- `npm test` - Run tests
- `npm run clean` - Remove build directory

### Project Structure

```
src/
├── config/           # Configuration files
│   └── environment.ts
├── controllers/      # Route controllers
│   ├── authController.ts
│   └── healthController.ts
├── middleware/       # Express middleware
│   ├── auth.ts
│   └── errorHandler.ts
├── routes/          # Route definitions
│   ├── auth.ts
│   ├── health.ts
│   └── index.ts
├── types/           # TypeScript type definitions
│   └── index.ts
├── utils/           # Utility functions
│   └── logger.ts
├── app.ts           # Express app configuration
└── index.ts         # Main entry point
```

## Deployment

### Local Development
```bash
npm run dev
```

### AWS Lambda Deployment

1. Configure AWS credentials:
```bash
aws configure
```

2. Deploy to development:
```bash
npm run deploy:dev
```

3. Deploy to production:
```bash
npm run deploy:prod
```

### Environment-Specific Deployment

The serverless configuration supports multiple stages:

- **Development**: `sls deploy --stage dev`
- **Production**: `sls deploy --stage prod`

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. After successful login, include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Mock Users

For development, the following mock users are available:

- **Admin**: `admin@example.com` / `password123`
- **User**: `user@example.com` / `password123`

## Error Handling

The API uses standardized error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE",
  "statusCode": 400,
  "meta": {
    "timestamp": "2023-12-01T12:00:00.000Z",
    "version": "v1"
  }
}
```

## Logging

The application uses Winston for logging with different levels:
- `error`: Error messages
- `warn`: Warning messages  
- `info`: General information
- `debug`: Debug information

Logs are output to console in development and to files in production.

## Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **JWT**: Secure authentication
- **Input Validation**: Request validation with Joi
- **Rate Limiting**: (Ready to implement)
- **Password Hashing**: Bcrypt for password security

## Troubleshooting

### Common Local Development Issues

#### Port Already in Use
If you get "EADDRINUSE" error:
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 npm run dev
```

#### TypeScript Compilation Errors
```bash
# Clean and rebuild
npm run clean
npm run build

# Check TypeScript configuration
npx tsc --noEmit
```

#### Environment Variables Not Loading
- Ensure `.env` file is in the root directory
- Check that `NODE_ENV=development` is set
- Restart the development server after changing `.env`

#### DynamoDB Connection Issues
- For local development, you can use DynamoDB Local
- Set `DYNAMO_ENDPOINT=http://localhost:8000` in your `.env`
- Or use AWS DynamoDB with proper credentials

### Getting Help

- Check the logs for detailed error messages
- Ensure all dependencies are installed: `npm install`
- Verify Node.js version: `node --version` (should be 18+)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run linting and tests
6. Submit a pull request

## License

MIT License - see LICENSE file for details.
