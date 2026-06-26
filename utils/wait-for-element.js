/**
 * Waits for a DOM element matching `selector` to appear.
 *
 * Callback mode: waitForElement(selector, callback, timeout?)
 *   Invokes callback(el) when found. If not found within timeout,
 *   logs a warning and stops observing. Returns void.
 *
 * Promise mode: await waitForElement(selector, timeout?)
 *   Resolves with the element when found. Resolves with null after timeout.
 *
 * @param {string} selector - CSS selector to watch for.
 * @param {(el: Element) => void | number} [callback] - Callback or timeout value.
 * @param {number} [timeout=5000] - Milliseconds to wait before giving up.
 * @returns {void | Promise<Element|null>}
 */
function waitForElement(selector, callback, timeout = 5000) {
  if (typeof callback !== "function") {
    timeout = typeof callback === "number" ? callback : timeout;
    return new Promise((resolve) => {
      waitForElement(selector, resolve, timeout);
    });
  }

  const existing = document.querySelector(selector);
  if (existing) {
    callback(existing);
    return;
  }

  let done = false;
  const observer = new MutationObserver(() => {
    const element = document.querySelector(selector);
    if (element && !done) {
      done = true;
      observer.disconnect();
      callback(element);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(() => {
    if (!done) {
      done = true;
      observer.disconnect();
      if (typeof console !== "undefined" && console.warn) {
        console.warn(
          `[waitForElement] Element '${selector}' not found within ${timeout}ms.`
        );
      }
      callback(null);
    }
  }, timeout);
}
