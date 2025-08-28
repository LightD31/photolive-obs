const Logger = require('../utils/logger');

function createErrorHandler(config) {
  const logger = new Logger(config.logLevel);

  return (err, req, res, next) => {
    logger.error('Unhandled error:', err);

    // Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected file field' });
    }

    // Default error response
    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || 'Internal server error';

    res.status(statusCode).json({
      error: message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  };
}

module.exports = createErrorHandler;