#!/usr/bin/env node

const Logger = require('./src/utils/logger');

console.log('Testing logging levels...\n');

// Test each log level
const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

levels.forEach(level => {
  console.log(`\n=== Testing with LOG_LEVEL=${level} ===`);
  const logger = new Logger(level);
  
  logger.error('This is an ERROR message');
  logger.warn('This is a WARN message');
  logger.info('This is an INFO message');
  logger.debug('This is a DEBUG message');
});

console.log('\n=== Testing with invalid log level ===');
const invalidLogger = new Logger('INVALID');
invalidLogger.error('Error with invalid level (should default to INFO)');
invalidLogger.warn('Warn with invalid level');
invalidLogger.info('Info with invalid level');
invalidLogger.debug('Debug with invalid level (should not show)');

console.log('\nLogging test complete!');