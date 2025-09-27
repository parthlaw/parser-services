export enum InternalErrorCodes {
  OVERUSE_LIMIT_EXCEEDED = 'OVERUSE_LIMIT_EXCEEDED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  BAD_REQUEST_ERROR = 'BAD_REQUEST_ERROR',
  UNAUTHORIZED_ERROR = 'UNAUTHORIZED_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}
// 404 error
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}
export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ValidationError extends Error {
  public errorCode: InternalErrorCodes;
  constructor(message: string, errorCode: InternalErrorCodes = InternalErrorCodes.VALIDATION_ERROR) {
    super(message);
    this.name = 'ValidationError';
    this.errorCode = errorCode;
  }
}
