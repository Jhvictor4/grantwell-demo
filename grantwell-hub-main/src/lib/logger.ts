/* eslint-disable no-console */

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  info(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.log(`[INFO] ${message}`, context ? context : '');
    }
  }

  warn(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.warn(`[WARN] ${message}`, context ? context : '');
    }
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    // Always log errors, but format them properly
    const errorDetails = error instanceof Error 
      ? { message: error.message, stack: error.stack }
      : error;
    
    console.error(`[ERROR] ${message}`, errorDetails, context ? context : '');
  }

  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, context ? context : '');
    }
  }

  // Production-safe logging methods that respect environment
  production = {
    // Only logs in development, silent in production
    log: (message: string, context?: LogContext) => {
      if (this.isDevelopment) {
        console.log(message, context || '');
      }
    },
    
    // Always logs errors for debugging
    error: (message: string, error?: Error | unknown, context?: LogContext) => {
      const errorDetails = error instanceof Error 
        ? { message: error.message, stack: error.stack }
        : error;
      console.error(message, errorDetails, context || '');
    },
    
    // Only logs warnings in development
    warn: (message: string, context?: LogContext) => {
      if (this.isDevelopment) {
        console.warn(message, context || '');
      }
    }
  };
}

export const logger = new Logger();