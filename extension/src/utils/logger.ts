import { DEBUG } from '../config';

const LOG_PREFIX = '[Creator OS Capture]';

export const logger = {
  log(...args: any[]): void {
    if (DEBUG) {
      console.log(LOG_PREFIX, ...args);
    }
  },

  warn(...args: any[]): void {
    if (DEBUG) {
      console.warn(LOG_PREFIX, ...args);
    }
  },

  error(...args: any[]): void {
    if (DEBUG) {
      console.error(LOG_PREFIX, ...args);
    }
  },

  info(...args: any[]): void {
    if (DEBUG) {
      console.info(LOG_PREFIX, ...args);
    }
  },

  debug(...args: any[]): void {
    if (DEBUG) {
      console.debug(LOG_PREFIX, ...args);
    }
  },
};