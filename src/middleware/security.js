const Logger = require('../utils/logger');

function createSecurityMiddleware(_config) {
  const logger = Logger.getInstance();

  return (req, res, next) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Allow framing from same origin (needed for OBS browser source)
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    // Path traversal protection
    if (req.url.includes('..') || req.url.includes('%2e%2e')) {
      logger.warn(`Path traversal attempt detected: ${req.url} from ${req.ip}`);
      return res.status(400).json({ error: 'Invalid request' });
    }
    
    next();
  };
}

module.exports = createSecurityMiddleware;