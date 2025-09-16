// API Response interface
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  meta?: {
    timestamp: string;
    version: string;
  };
}

// Error response interface
export interface ErrorResponse {
  success: false;
  message: string;
  error: string;
  statusCode: number;
  meta: {
    timestamp: string;
    version: string;
  };
}

// JWT Payload interface
export interface JwtPayload {
  id: string;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}

// Bank statement Decode Queue Message
export interface BankStatementDecodeQueueMessage {
  filename: string;
  mode: string;
  job_id: string;
  user_id?: string;
  source_key: string;
  pages: number;
}