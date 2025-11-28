/**
 * Logger utility that automatically disables logs in production
 * 
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.log('[Component] Message');
 *   logger.error('[Component] Error:', error);
 * 
 * Environment control:
 *   - Development (VITE_ENV=development): All logs enabled
 *   - Production (VITE_ENV=production): All logs disabled
 */

const isDevelopment = import.meta.env.MODE === 'development' || import.meta.env.DEV;

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  error: (...args: any[]) => {
    if (isDevelopment) {
      console.error(...args);
    }
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
  
  // Force log even in production (use sparingly for critical errors)
  forceLog: (...args: any[]) => {
    console.log(...args);
  },
  
  forceError: (...args: any[]) => {
    console.error(...args);
  }
};

// Export environment check for conditional logic
export const isDevMode = isDevelopment;
