const { RESPONSE_MESSAGES } = require('../config/constants');

/**
 * 404 Not Found Handler
 */
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

/**
 * Global Error Handler
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    user: req.user ? req.user._id : 'anonymous',
    timestamp: new Date().toISOString(),
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = 'Validation Error';
    const errors = Object.values(err.errors).map(val => ({
      field: val.path,
      message: val.message,
    }));

    return res.status(400).json({
      success: false,
      error: message,
      details: errors,
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} already exists`;
    return res.status(409).json({
      success: false,
      error: message,
    });
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    return res.status(404).json({
      success: false,
      error: message,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    return res.status(401).json({
      success: false,
      error: message,
    });
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    return res.status(401).json({
      success: false,
      error: message,
    });
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File size too large';
    return res.status(400).json({
      success: false,
      error: message,
    });
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    const message = 'Too many files';
    return res.status(400).json({
      success: false,
      error: message,
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field';
    return res.status(400).json({
      success: false,
      error: message,
    });
  }

  // MongoDB connection errors
  if (err.name === 'MongoNetworkError' || err.name === 'MongoTimeoutError') {
    const message = 'Database connection error';
    return res.status(503).json({
      success: false,
      error: message,
    });
  }

  // Rate limiting errors
  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      error: err.message || RESPONSE_MESSAGES.RATE_LIMIT_EXCEEDED,
      retryAfter: err.resetTime ? Math.ceil((err.resetTime - Date.now()) / 1000) : undefined,
    });
  }

  // Custom application errors with status codes
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(err.errors && { details: err.errors }),
    });
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? RESPONSE_MESSAGES.SERVER_ERROR
    : err.message || RESPONSE_MESSAGES.SERVER_ERROR;

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

/**
 * Async error wrapper
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Create custom error
 */
const createError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * Validation error creator
 */
const createValidationError = (errors) => {
  const error = new Error('Validation failed');
  error.statusCode = 400;
  error.errors = Array.isArray(errors) ? errors : [errors];
  return error;
};

/**
 * Authorization error creator
 */
const createAuthError = (message = RESPONSE_MESSAGES.UNAUTHORIZED) => {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
};

/**
 * Forbidden error creator
 */
const createForbiddenError = (message = RESPONSE_MESSAGES.FORBIDDEN) => {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
};

/**
 * Not found error creator
 */
const createNotFoundError = (message = RESPONSE_MESSAGES.NOT_FOUND) => {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
};

/**
 * Conflict error creator
 */
const createConflictError = (message = 'Resource already exists') => {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
};

/**
 * Unprocessable entity error creator
 */
const createUnprocessableError = (message = 'Unprocessable entity') => {
  const error = new Error(message);
  error.statusCode = 422;
  return error;
};

/**
 * Service unavailable error creator
 */
const createServiceUnavailableError = (message = 'Service temporarily unavailable') => {
  const error = new Error(message);
  error.statusCode = 503;
  return error;
};

/**
 * Rate limit error creator
 */
const createRateLimitError = (message = RESPONSE_MESSAGES.RATE_LIMIT_EXCEEDED, resetTime = null) => {
  const error = new Error(message);
  error.statusCode = 429;
  error.resetTime = resetTime;
  return error;
};

module.exports = {
  notFound,
  errorHandler,
  asyncHandler,
  createError,
  createValidationError,
  createAuthError,
  createForbiddenError,
  createNotFoundError,
  createConflictError,
  createUnprocessableError,
  createServiceUnavailableError,
  createRateLimitError,
};