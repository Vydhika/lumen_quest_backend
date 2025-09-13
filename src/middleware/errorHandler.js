/**
 * Global error handling middleware
 * Handles all application errors and formats responses consistently
 */

const { errorResponse, logger } = require('../utils/helpers');

/**
 * Global error handler middleware
 * This should be the last middleware in the app
 */
const errorHandler = (err, req, res, next) => {
  logger.error('Error caught by global handler:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Default error
  let status = 500;
  let message = 'Internal server error';
  let errors = null;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    // Joi validation errors
    status = 400;
    message = 'Validation failed';
    errors = {};
    
    if (err.details) {
      err.details.forEach(detail => {
        const key = detail.path.join('.');
        errors[key] = detail.message;
      });
    }
  } else if (err.name === 'CastError') {
    // Database casting errors (invalid ObjectId, etc.)
    status = 400;
    message = 'Invalid data format';
    errors = { [err.path]: 'Invalid value' };
  } else if (err.code === 11000) {
    // MongoDB duplicate key error
    status = 409;
    message = 'Resource already exists';
    const field = Object.keys(err.keyValue)[0];
    errors = { [field]: 'Already exists' };
  } else if (err.name === 'JsonWebTokenError') {
    // JWT errors
    status = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    // JWT expiration errors
    status = 401;
    message = 'Token expired';
  } else if (err.name === 'MulterError') {
    // File upload errors
    status = 400;
    message = 'File upload error';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File too large';
    }
  } else if (err.status || err.statusCode) {
    // HTTP errors with status codes
    status = err.status || err.statusCode;
    message = err.message || message;
  } else if (err.message) {
    // Custom application errors
    message = err.message;
    
    // Check for common error patterns
    if (message.toLowerCase().includes('not found')) {
      status = 404;
    } else if (message.toLowerCase().includes('unauthorized')) {
      status = 401;
    } else if (message.toLowerCase().includes('forbidden')) {
      status = 403;
    } else if (message.toLowerCase().includes('validation')) {
      status = 400;
    }
  }

  // Supabase specific errors
  if (err.code && typeof err.code === 'string') {
    if (err.code.startsWith('PGRST')) {
      // PostgREST errors from Supabase
      status = 400;
      message = 'Database operation failed';
      
      if (err.code === 'PGRST116') {
        message = 'Resource not found';
        status = 404;
      } else if (err.code === 'PGRST301') {
        message = 'Resource not found';
        status = 404;
      }
    } else if (err.code === '23505') {
      // PostgreSQL unique violation
      status = 409;
      message = 'Resource already exists';
    } else if (err.code === '23503') {
      // PostgreSQL foreign key violation
      status = 400;
      message = 'Invalid reference';
    } else if (err.code === '23502') {
      // PostgreSQL not null violation
      status = 400;
      message = 'Required field missing';
    }
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && status === 500) {
    message = 'Internal server error';
    errors = null;
  }

  // Send error response
  res.status(status).json(errorResponse(message, errors));
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors automatically
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Custom error classes
 */
class AppError extends Error {
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.status = statusCode;
    this.errors = errors;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = null) {
    super(message, 400, errors);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError
};