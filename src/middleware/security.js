const Logger = require('../utils/logger');

function createSecurityMiddleware(config) {
  const logger = new Logger(config.logLevel);

  return (req, res, next) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Path traversal protection
    if (req.url.includes('..') || req.url.includes('%2e%2e')) {
      logger.warn(`Path traversal attempt detected: ${req.url} from ${req.ip}`);
      return res.status(400).json({ error: 'Invalid request' });
    }
    
    next();
  };
}

module.exports = createSecurityMiddleware;