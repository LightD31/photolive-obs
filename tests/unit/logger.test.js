const Logger = require('../../src/utils/logger');

describe('Logger', () => {
  beforeEach(() => {
    Logger.resetInstance();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Logger.resetInstance();
  });

  describe('constructor', () => {
    test('defaults to INFO level', () => {
      const logger = new Logger();
      logger.info('test');
      logger.debug('should not appear');
      expect(console.log).toHaveBeenCalledTimes(1);
    });

    test('respects DEBUG level', () => {
      const logger = new Logger('DEBUG');
      logger.debug('debug msg');
      expect(console.log).toHaveBeenCalledTimes(1);
    });

    test('respects ERROR level — suppresses info and warn', () => {
      const logger = new Logger('ERROR');
      logger.info('no');
      logger.warn('no');
      logger.error('yes');
      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    test('handles invalid level gracefully', () => {
      const logger = new Logger('INVALID');
      logger.info('should work');
      expect(console.log).toHaveBeenCalledTimes(1);
    });
  });

  describe('singleton', () => {
    test('getInstance returns same instance', () => {
      const a = Logger.getInstance('DEBUG');
      const b = Logger.getInstance('ERROR'); // level ignored
      expect(a).toBe(b);
    });

    test('resetInstance allows new creation', () => {
      const a = Logger.getInstance('DEBUG');
      Logger.resetInstance();
      const b = Logger.getInstance('ERROR');
      expect(a).not.toBe(b);
    });
  });

  describe('setLevel', () => {
    test('can change level after construction', () => {
      const logger = new Logger('ERROR');
      logger.info('hidden');
      expect(console.log).not.toHaveBeenCalled();

      logger.setLevel('INFO');
      logger.info('visible');
      expect(console.log).toHaveBeenCalledTimes(1);
    });
  });

  describe('output format', () => {
    test('includes timestamp and level prefix', () => {
      const logger = new Logger('DEBUG');
      logger.info('hello');
      const call = console.log.mock.calls[0];
      expect(call[0]).toMatch(/^\[INFO\]\s+\d{4}-\d{2}-\d{2}T/);
      expect(call[1]).toBe('hello');
    });
  });
});
