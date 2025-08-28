const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor(level = 'INFO') {
    this.setLevel(level);
  }

  setLevel(level) {
    this.level = typeof level === 'string' ? LogLevel[level.toUpperCase()] : level;
  }

  error(...args) {
    if (this.level >= LogLevel.ERROR) {
      console.error('[ERROR]', new Date().toISOString(), ...args);
    }
  }

  warn(...args) {
    if (this.level >= LogLevel.WARN) {
      console.warn('[WARN]', new Date().toISOString(), ...args);
    }
  }

  info(...args) {
    if (this.level >= LogLevel.INFO) {
      console.log('[INFO]', new Date().toISOString(), ...args);
    }
  }

  debug(...args) {
    if (this.level >= LogLevel.DEBUG) {
      console.log('[DEBUG]', new Date().toISOString(), ...args);
    }
  }
}

module.exports = Logger;