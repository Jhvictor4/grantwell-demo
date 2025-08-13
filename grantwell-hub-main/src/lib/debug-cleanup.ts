/* eslint-disable no-console */
import { logger } from './logger';

/**
 * Development utility for cleaning up debug code and console statements
 * This file should be removed in production builds
 */

// Replace console methods with logger in development
export const replaceConsoleWithLogger = () => {
  if (process.env.NODE_ENV === 'development') {
    const originalConsole = { ...console };
    
    console.log = (...args) => {
      logger.debug(args.join(' '));
      originalConsole.log(...args);
    };
    
    console.warn = (...args) => {
      logger.warn(args.join(' '));
      originalConsole.warn(...args);
    };
    
    console.error = (...args) => {
      logger.error(args.join(' '));
      originalConsole.error(...args);
    };
  }
};

// Helper to identify debug code patterns
export const debugPatterns = {
  consoleStatements: /console\.(log|warn|error|debug)/g,
  testFunctions: /test[A-Z]\w*\s*=/g,
  debugComments: /\/\/\s*(TODO|FIXME|DEBUG|TEST)/gi,
  unusedImports: /import.*from.*[\'\"].*[\'\"];\s*$/gm
};

// Development helper to scan for debug code
export const scanForDebugCode = (code: string) => {
  const issues = [];
  
  if (debugPatterns.consoleStatements.test(code)) {
    issues.push('Console statements found');
  }
  
  if (debugPatterns.testFunctions.test(code)) {
    issues.push('Test functions found');
  }
  
  if (debugPatterns.debugComments.test(code)) {
    issues.push('Debug comments found');
  }
  
  return issues;
};