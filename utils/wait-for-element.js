function waitForElement(selector, callback, timeout = 5000) {
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
            logger(`Error: Element '${selector}' not found within ${timeout}ms.`);
            observer.disconnect(); // Ensure we stop observing
        }
    }, timeout);
}