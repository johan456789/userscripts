// ==UserScript==
// @name           Brave Search - Auto click captcha Verify
// @namespace      none
// @description    Automatically clicks the "Verify" button on the Brave Search proof-of-work captcha page.
// @version        1.0.0
// @match          https://search.brave.com/*
// @icon           https://search.brave.com/favicon.ico
// @run-at         document-end
// @grant          none
// @require        https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL      https://github.com/johan456789/userscripts/raw/main/brave-search-auto-verify-captcha.js
// @downloadURL    https://github.com/johan456789/userscripts/raw/main/brave-search-auto-verify-captcha.js
// ==/UserScript==

(function () {
  "use strict";

  const logger = Logger("[Brave-Search-Auto-Verify-Captcha]");

  const WRAPPER_SELECTOR = ".captcha-wrapper";
  const BUTTON_SELECTOR = ".captcha-button-wrap button";
  // The button exists before SvelteKit hydrates it, so a click can be a no-op.
  // Retry while the captcha stays idle, but cap attempts to avoid looping.
  const RETRY_INTERVAL_MS = 1000;
  const MAX_ATTEMPTS = 5;

  let attempts = 0;
  let lastClickAt = 0;

  function tryClick() {
    const wrapper = document.querySelector(WRAPPER_SELECTOR);
    if (!wrapper || wrapper.dataset.state !== "idle") {
      return;
    }

    const button = wrapper.querySelector(BUTTON_SELECTOR);
    if (!button || button.disabled || button.getAttribute("aria-busy") === "true") {
      return;
    }

    if (attempts >= MAX_ATTEMPTS || Date.now() - lastClickAt < RETRY_INTERVAL_MS) {
      return;
    }

    attempts += 1;
    lastClickAt = Date.now();
    button.click();
    logger(`Clicked Verify button (attempt ${attempts})`);
  }

  tryClick();

  const observer = new MutationObserver(tryClick);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-state", "aria-busy"],
  });

  setInterval(tryClick, RETRY_INTERVAL_MS);
})();
