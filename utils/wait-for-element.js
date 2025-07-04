function waitForElement(selector, callback, timeout = 5000) {
    // Check if element already exists
    const existing = document.querySelector(selector);
    if (existing) {
        callback(existing);
        return;
    }

    const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
            obs.disconnect(); // Stop observing once the element is found
            isDisconnected = true;
            callback(element);
        }
    });

    let isDisconnected = false;

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
        if (!isDisconnected) {
            // TODO: add logger as optional parameter. use console.log if not provided.
            logger(`Error: Element '${selector}' not found within ${timeout}ms.`);
            observer.disconnect(); // Ensure we stop observing
        }
    }, timeout);
}