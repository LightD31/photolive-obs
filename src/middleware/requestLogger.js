const logger = require('../utils/logger');

/**
 * Request logging middleware
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  
  // Log request
  logger.debug(`${req.method} ${req.url} - ${req.ip}`);
  
  // Override res.end to log response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
    originalEnd.apply(this, args);
  };
  
  next();
}

module.exports = requestLogger;
