const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  /**
   * @param {string} [level='INFO'] - Log level: ERROR, WARN, INFO, DEBUG
   */
  constructor(level = 'INFO') {
    this.setLevel(level);
  }

  setLevel(level) {
    const normalizedLevel = typeof level === 'string' ? level.toUpperCase() : 'INFO';
    this.level = LogLevel[normalizedLevel] !== undefined ? LogLevel[normalizedLevel] : LogLevel.INFO;
  }

  error(...args) {
    if (this.level >= LogLevel.ERROR) {
      console.error(`[ERROR] ${new Date().toISOString()}`, ...args);
    }
  }

  warn(...args) {
    if (this.level >= LogLevel.WARN) {
      console.warn(`[WARN]  ${new Date().toISOString()}`, ...args);
    }
  }

  info(...args) {
    if (this.level >= LogLevel.INFO) {
      console.log(`[INFO]  ${new Date().toISOString()}`, ...args);
    }
  }

  debug(...args) {
    if (this.level >= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${new Date().toISOString()}`, ...args);
    }
  }

  /**
   * Get the singleton Logger instance.
   * On first call, creates the instance with the given level.
   * Subsequent calls return the same instance (level param is ignored).
   * @param {string} [level='INFO']
   * @returns {Logger}
   */
  static getInstance(level = 'INFO') {
    if (!Logger._instance) {
      Logger._instance = new Logger(level);
    }
    return Logger._instance;
  }

  /**
   * Reset the singleton (useful for testing).
   */
  static resetInstance() {
    Logger._instance = null;
  }
}

Logger._instance = null;

module.exports = Logger;