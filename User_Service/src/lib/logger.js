const util = require('util');
module.exports = {
info: (...args) => console.log('[INFO]', ...args),
warn: (...args) => console.warn('[WARN]', ...args),
error: (...args) => console.error('[ERROR]', ...args),
debug: (...args) => console.debug('[DEBUG]', ...args),
inspect: (obj) => console.log(util.inspect(obj, { depth: null })),
};