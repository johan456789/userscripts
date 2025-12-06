// ==UserScript==
// @name         SpanishDict renew free pages
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  try to take over the world!
// @author       You
// @match        https://www.spanishdict.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=spanishdict.com
// @run-at       document-end
// @grant        none
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @require      https://github.com/johan456789/userscripts/raw/main/utils/wait-for-element.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/spanishdict-refresh-free.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/spanishdict-refresh-free.js
// ==/UserScript==

(function() {
    'use strict';

  const logger = Logger("[SpanishDict-Renew-Free]");
  logger("script started");

    localStorage.clear();
    logger('cleared localStorage');

    const buttonSelector = 'div.ReactModalPortal div button:not([aria-label])';

    const timeoutMs = 5000;

    const findMaybeLaterButton = () => Array.from(document.querySelectorAll(buttonSelector))
      .find((btn) => btn.textContent?.trim() === 'Maybe Later');

    const observer = new MutationObserver(() => {
      const button = findMaybeLaterButton();
      if (!button) return;

      logger('found "Maybe Later" button, clicking');
      button.click();
      observer.disconnect();
      clearTimeout(timeoutId);
    });

    const timeoutId = setTimeout(() => {
      observer.disconnect();
      logger('Error: "Maybe Later" button not found before timeout');
    }, timeoutMs);

    // Check immediately in case the modal is already present
    const existingButton = findMaybeLaterButton();
    if (existingButton) {
      logger('found "Maybe Later" button immediately, clicking');
      existingButton.click();
      clearTimeout(timeoutId);
      return;
    }

    observer.observe(document.body, { childList: true, subtree: true });
})();