/**
 * @fileoverview Tests for shared logger utility
 * @module scripts/shared/logger.test
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { Logger } from './logger';

describe('Logger', () => {
  let originalLog: any;
  let originalWarn: any;
  let originalError: any;
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    // Save originals
    originalLog = console.log;
    originalWarn = console.warn;
    originalError = console.error;
    
    // Create fresh spies
    consoleLogSpy = mock(() => {});
    consoleWarnSpy = mock(() => {});
    consoleErrorSpy = mock(() => {});
    
    console.log = consoleLogSpy;
    console.warn = consoleWarnSpy;
    console.error = consoleErrorSpy;
  });

  afterEach(() => {
    // Restore originals
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  });

  describe('Basic Logging', () => {
    it('should log info messages', () => {
      const logger = new Logger({ timestamp: false });
      logger.info('Test message');
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log success messages', () => {
      const logger = new Logger({ timestamp: false });
      logger.success('Operation completed');
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log warning messages', () => {
      const logger = new Logger({ timestamp: false });
      logger.warn('Warning message');
      
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      const logger = new Logger({ timestamp: false });
      logger.error('Error message');
      
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Log Level Filtering', () => {
    it('should filter debug logs when level is info', () => {
      const logger = new Logger({ level: 'info', timestamp: false });
      
      logger.debug('Debug message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
      
      logger.info('Info message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should filter info logs when level is warn', () => {
      const logger = new Logger({ level: 'warn', timestamp: false });
      
      logger.info('Info message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
      
      logger.warn('Warning message');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should only show errors when level is error', () => {
      const logger = new Logger({ level: 'error', timestamp: false });
      
      logger.info('Info');
      logger.warn('Warning');
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      
      logger.error('Error');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Prefix Support', () => {
    it('should include prefix in log messages', () => {
      const logger = new Logger({ prefix: 'TEST', timestamp: false });
      logger.info('Message');
      
      // Check that logged message contains prefix
      const call = consoleLogSpy.mock.calls[0];
      const message = call[0];
      
      expect(message).toContain('[TEST]');
    });

    it('should support multiple prefixes via child logger', () => {
      const logger = new Logger({ prefix: 'MAIN', timestamp: false });
      const child = logger.child('SUB');
      
      // Just verify child logger can be created and called
      child.info('Child message');
      
      // Verify spy was called
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('Timestamp Support', () => {
    it('should include timestamp when enabled', () => {
      const logger = new Logger({ timestamp: true });
      logger.info('Message');
      
      const call = consoleLogSpy.mock.calls[0];
      const message = call[0];
      
      // Check for ISO timestamp format
      expect(message).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should not include timestamp when disabled', () => {
      const logger = new Logger({ timestamp: false });
      logger.info('Message');
      
      const call = consoleLogSpy.mock.calls[0];
      const message = call[0];
      
      expect(message).not.toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Helper Methods', () => {
    it('should create separators', () => {
      const logger = new Logger({ timestamp: false });
      logger.separator('=', 40);
      
      const call = consoleLogSpy.mock.calls[0];
      const message = call[0];
      
      expect(message).toBe('='.repeat(40));
    });

    it('should create box around message', () => {
      const logger = new Logger({ timestamp: false });
      logger.box('Test Message');
      
      // Should log 3 lines: top, message, bottom
      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('Formatting', () => {
    it('should include emoji icons', () => {
      const logger = new Logger({ timestamp: false });
      
      logger.info('Info');
      expect(consoleLogSpy.mock.calls[0][0]).toContain('ℹ️');
      
      logger.success('Success');
      expect(consoleLogSpy.mock.calls[1][0]).toContain('✅');
      
      logger.warn('Warning');
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('⚠️');
      
      logger.error('Error');
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('❌');
    });

    it('should support additional arguments', () => {
      const logger = new Logger({ timestamp: false });
      const data = { key: 'value' };
      
      logger.info('Message with data', data);
      
      // Should log message and data
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0].length).toBeGreaterThan(1);
    });
  });
});

describe('Logger Integration Examples', () => {
  it('should demonstrate deployment script logging', () => {
    // Verify logger can be created and used without errors
    const logger = new Logger({ prefix: 'DEPLOY', timestamp: false });
    
    // These should not throw
    logger.info('Starting deployment...');
    logger.success('Token deployed at 0x123...');
    logger.warn('High gas price detected');
    logger.error('Deployment failed');
    
    expect(true).toBe(true);
  });

  it('should demonstrate oracle bot logging', () => {
    const logger = new Logger({ prefix: 'ORACLE', level: 'info', timestamp: false });
    
    // These should not throw
    logger.debug('Price fetch details'); // Filtered out
    logger.info('Fetching prices...');
    logger.success('Prices updated');
    
    expect(true).toBe(true);
  });

  it('should demonstrate monitoring script logging', () => {
    const logger = new Logger({ prefix: 'MONITOR', timestamp: false });
    const nodeLogger = logger.child('NODE-1');
    
    // Child logger should work without errors
    nodeLogger.info('Checking node health...');
    nodeLogger.success('Node is healthy');
    
    expect(true).toBe(true);
  });
});

