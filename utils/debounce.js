/**
 * Creates a debounced version of a function that delays invoking `fn` until
 * after `wait` milliseconds have elapsed since the last time the debounced
 * function was called. Preserves `this` context and forwards all arguments.
 * @param {Function} fn - Function to debounce.
 * @param {number} wait - Delay in milliseconds.
 * @returns {Function} Debounced function.
 */
function debounce(fn, wait) {
  let timeoutId = null;
  return function (...args) {
    if (timeoutId) clearTimeout(timeoutId);
    const context = this;
    timeoutId = setTimeout(() => fn.apply(context, args), wait);
  };
}
