const util = require('util');
const Log = require('../models/Log');  // <-- add this

async function saveToDb(level, message, args) {
  try {
    await Log.create({
      level,
      message,
      args,
    });
  } catch (err) {
    console.error('[LOGGER ERROR] Failed to save log:', err);
  }
}

module.exports = {
  info: (...args) => {
    console.log('[INFO]', ...args);
    saveToDb("info", args[0], args);
  },

  warn: (...args) => {
    console.warn('[WARN]', ...args);
    saveToDb("warn", args[0], args);
  },

  error: (...args) => {
    console.error('[ERROR]', ...args);
    saveToDb("error", args[0], args);
  },

  debug: (...args) => {
    console.debug('[DEBUG]', ...args);
    saveToDb("debug", args[0], args);
  },

  inspect: (obj) => {
    const inspected = util.inspect(obj, { depth: null });
    console.log(inspected);
    saveToDb("inspect", inspected, obj);
  }
};
