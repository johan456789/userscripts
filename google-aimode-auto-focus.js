// ==UserScript==
// @name         Auto Focus on TextBox in Google Search AI Mode (udm=50)
// @namespace    https://greasyfork.org/en/users/688917
// @version      1.1.3
// @description  Automatically focuses on the textarea when the page loads.
// @author       You
// @match        https://www.google.com/search?udm=50*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @run-at       document-end
// @license      MIT
// @downloadURL  https://github.com/johan456789/userscripts/raw/refs/heads/main/google-aimode-auto-focus.js
// @updateURL    https://github.com/johan456789/userscripts/raw/refs/heads/main/google-aimode-auto-focus.js
// ==/UserScript==

(function () {
  "use strict";
  const logger = Logger("[Google-AI-Mode-Auto-Focus]");
  logger("Script started");

  const textAreaSelector = "#cnt textarea";
  const textarea = document.querySelector(textAreaSelector);
  if (!textarea) {
    logger("Textarea not found. Exiting.");
    return;
  }

  function focusTextarea() {
    if (textarea) {
      textarea.focus();
    }
  }

  // Run immediately
  focusTextarea();

  // Also try again if elements are loaded dynamically
  new MutationObserver(focusTextarea).observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Detect user typing and auto-focus the textarea
  document.addEventListener("keydown", (event) => {
    logger("Keydown detected.");
    if (event.ctrlKey || event.metaKey) {
      return; // Ignore shortcuts like Ctrl+C, Ctrl+V, Cmd+C, etc.
    }
    if (document.activeElement !== textarea) {
      logger("Textarea not focused. Focusing.");
      focusTextarea();
    }
  });
})();
