// Custom error classes for payment repository operations

export class PaymentRepositoryError extends Error {
  constructor(
    message: string,
    public operation: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'PaymentRepositoryError';
  }
}

export class PaymentNotFoundError extends PaymentRepositoryError {
  constructor(identifier: string | number, type: 'id' | 'gateway_id' = 'id') {
    super(
      `Payment not found with ${type}: ${identifier}`,
      'fetch',
    );
    this.name = 'PaymentNotFoundError';
  }
}

export class OrderNotFoundError extends PaymentRepositoryError {
  constructor(identifier: string | number, type: 'id' | 'gateway_id' = 'id') {
    super(
      `Order not found with ${type}: ${identifier}`,
      'fetch',
    );
    this.name = 'OrderNotFoundError';
  }
}

export class SubscriptionNotFoundError extends PaymentRepositoryError {
  constructor(identifier: string | number, type: 'id' | 'gateway_id' = 'id') {
    super(
      `Subscription not found with ${type}: ${identifier}`,
      'fetch',
    );
    this.name = 'SubscriptionNotFoundError';
  }
}

export class RefundNotFoundError extends PaymentRepositoryError {
  constructor(identifier: string | number, type: 'id' | 'gateway_id' = 'id') {
    super(
      `Refund not found with ${type}: ${identifier}`,
      'fetch',
    );
    this.name = 'RefundNotFoundError';
  }
}

export class DuplicateRecordError extends PaymentRepositoryError {
  constructor(field: string, value: string, entity: string) {
    super(
      `${entity} with ${field} '${value}' already exists`,
      'create',
    );
    this.name = 'DuplicateRecordError';
  }
}

export class ValidationError extends PaymentRepositoryError {
  constructor(field: string, message: string) {
    super(
      `Validation failed for ${field}: ${message}`,
      'validation',
    );
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends PaymentRepositoryError {
  constructor(operation: string) {
    super(
      `Unauthorized to perform ${operation}`,
      operation,
    );
    this.name = 'UnauthorizedError';
  }
}

// Error handler utility
export class PaymentRepositoryErrorHandler {
  static handleSupabaseError(error: any, operation: string): never {
    // Handle specific Supabase error codes
    switch (error.code) {
      case 'PGRST116': // No rows returned
        throw new PaymentRepositoryError(
          `No records found for ${operation}`,
          operation,
          error
        );
      
      case '23505': // Unique constraint violation
        const match = error.message.match(/Key \(([^)]+)\)=\(([^)]+)\)/);
        if (match) {
          throw new DuplicateRecordError(match[1], match[2], operation);
        }
        throw new DuplicateRecordError('unknown', 'unknown', operation);
      
      case '23503': // Foreign key constraint violation
        throw new ValidationError(
          'foreign_key',
          'Referenced record does not exist'
        );
      
      case '23514': // Check constraint violation
        throw new ValidationError(
          'constraint',
          'Data violates database constraints'
        );
      
      case '42501': // Insufficient privilege
        throw new UnauthorizedError(operation);
      
      default:
        throw new PaymentRepositoryError(
          `Database ${operation} failed: ${error.message || error}`,
          operation,
          error
        );
    }
  }

  static isNotFoundError(error: any): boolean {
    return error instanceof PaymentNotFoundError ||
           error instanceof OrderNotFoundError ||
           error instanceof SubscriptionNotFoundError ||
           error instanceof RefundNotFoundError;
  }

  static isDuplicateError(error: any): boolean {
    return error instanceof DuplicateRecordError;
  }

  static isValidationError(error: any): boolean {
    return error instanceof ValidationError;
  }

  static isUnauthorizedError(error: any): boolean {
    return error instanceof UnauthorizedError;
  }
}
