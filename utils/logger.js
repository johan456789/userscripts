/**
 * Lightweight logger factory for userscripts.
 * Usage in userscript:
 *   // @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
 *   const logger = Logger('[My-Script]');
 *   logger('started');
 *   logger.error('Something went wrong', err);
 *
 * The returned logger is a callable function that forwards extra arguments and
 * has .error and .warn methods with the same prefix.
 */
function Logger(prefix) {
  function log(message, ...rest) {
    console.log(prefix + " " + message, ...rest);
  }
  log.error = function (message, ...rest) {
    console.error(prefix + " " + message, ...rest);
  };
  log.warn = function (message, ...rest) {
    console.warn(prefix + " " + message, ...rest);
  };
  return log;
}
