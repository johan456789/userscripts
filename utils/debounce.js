/**
 * Creates a debounced version of a function that delays invoking `fn` until
 * after `wait` milliseconds have elapsed since the last time the debounced
 * function was called. Preserves `this` context and forwards all arguments.
 * Optionally enforces a maximum wait time so the function is guaranteed to run
 * at least once during sustained activity.
 * @param {Function} fn - Function to debounce.
 * @param {number} wait - Delay in milliseconds.
 * @param {{ maxWait?: number }} [options] - Optional debounce options.
 * @returns {Function} Debounced function.
 */
function debounce(fn, wait, options = {}) {
  let timeoutId = null;
  let maxTimeoutId = null;
  let lastArgs = null;
  let lastContext = null;
  const hasMaxWait =
    Number.isFinite(options.maxWait) && Number(options.maxWait) >= 0;
  const maxWait = hasMaxWait ? Number(options.maxWait) : 0;

  function invoke() {
    if (!lastArgs) {
      return;
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (maxTimeoutId) {
      clearTimeout(maxTimeoutId);
      maxTimeoutId = null;
    }

    const args = lastArgs;
    const context = lastContext;
    lastArgs = null;
    lastContext = null;
    fn.apply(context, args);
  }

  return function (...args) {
    lastArgs = args;
    lastContext = this;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(invoke, wait);

    if (hasMaxWait && !maxTimeoutId) {
      maxTimeoutId = setTimeout(invoke, maxWait);
    }
  };
}
