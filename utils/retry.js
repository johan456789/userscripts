/**
 * Repeatedly invokes `fn` until it returns `true`, waiting `delay` ms between attempts.
 * Logs progress via `logger` (defaults to `console.log`).
 *
 * Note: Uses `setTimeout` for retries, so the final outcome may occur asynchronously.
 * The return value is `true` if the first attempt succeeds synchronously, `false` if all
 * attempts are exhausted synchronously, otherwise `undefined` when retries are scheduled.
 *
 * @param {() => boolean} fn - Synchronous predicate that indicates success when it returns `true`.
 * @param {number} [maxRetries=5] - Maximum number of attempts.
 * @param {number} [delay=100] - Delay in milliseconds between attempts.
 * @param {(msg: string) => void} [logger=console.log] - Logger function for status messages.
 * @returns {boolean|undefined} Immediate outcome for synchronous success/failure; otherwise `undefined`.
 */
function retry(fn, maxRetries = 5, delay = 100, logger = null) {
  if (!logger || typeof logger !== "function") {
    logger = console.log;
  }

  let retryCount = 0;

  function attempt() {
    const result = fn();

    if (result === true) {
      return true; // Success
    }

    retryCount++;
    if (retryCount < maxRetries) {
      logger(`Retry ${retryCount}/${maxRetries} in ${delay}ms...`);
      setTimeout(attempt, delay);
    } else {
      logger(`Failed after ${maxRetries} attempts.`);
      return false;
    }
  }

  return attempt();
}
