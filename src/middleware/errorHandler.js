const logger = require('../utils/logger');

/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
  // Log the error
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Default error response
  let statusCode = 500;
  let message = 'Internal Server Error';
  let details = null;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    details = isDevelopment ? err.message : null;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (err.code === 'ENOENT') {
    statusCode = 404;
    message = 'File not found';
  } else if (err.code === 'EACCES') {
    statusCode = 403;
    message = 'Access denied';
  } else if (err.code === 'EMFILE' || err.code === 'ENFILE') {
    statusCode = 503;
    message = 'Server temporarily unavailable';
  }

  // Send error response
  const response = {
    success: false,
    error: message
  };

  if (isDevelopment && details) {
    response.details = details;
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

/**
 * 404 handler for unknown routes
 */
function notFoundHandler(req, res) {
  logger.warn(`404 - Route not found: ${req.method} ${req.url}`);
  
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
}

/**
 * Async error wrapper
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};
