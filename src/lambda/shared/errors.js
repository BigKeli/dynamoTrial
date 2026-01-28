/**
 * Custom error classes for domain and HTTP layer
 */

export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.statusCode = 400;
  }
}

export class NotFoundError extends Error {
  constructor(message, resourceType = null) {
    super(message);
    this.name = 'NotFoundError';
    this.resourceType = resourceType;
    this.statusCode = 404;
  }
}

export class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
    this.statusCode = 409;
  }
}

export class InternalError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'InternalError';
    this.originalError = originalError;
    this.statusCode = 500;
  }
}
