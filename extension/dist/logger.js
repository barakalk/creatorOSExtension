const LOG_PREFIX = "[Creator OS Capture]";
const logger = {
  log(...args) {
    {
      console.log(LOG_PREFIX, ...args);
    }
  },
  warn(...args) {
    {
      console.warn(LOG_PREFIX, ...args);
    }
  },
  error(...args) {
    {
      console.error(LOG_PREFIX, ...args);
    }
  },
  info(...args) {
    {
      console.info(LOG_PREFIX, ...args);
    }
  },
  debug(...args) {
    {
      console.debug(LOG_PREFIX, ...args);
    }
  }
};
export {
  logger as l
};
//# sourceMappingURL=logger.js.map
