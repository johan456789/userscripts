// ==UserScript==
// @name         Reddit Replace Redacted Comments
// @namespace    http://tampermonkey.net/
// @version      0.1.8
// @description  Replace Redact-style mass-deleted Reddit comment bodies with a simple placeholder.
// @include      *://reddit.com/*
// @include      *://*.reddit.com/*
// @match        https://www.reddit.com/*
// @match        https://reddit.com/*
// @match        https://*.reddit.com/*
// @license      MIT
// @run-at       document-end
// @noframes
// @grant        none
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL    https://github.com/johan456789/userscripts/raw/refs/heads/main/reddit-highlight-redacted-comments.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/refs/heads/main/reddit-highlight-redacted-comments.js
// ==/UserScript==

(function () {
  "use strict";

  const logger = Logger("[Reddit-Replace-Redacted-Comments]");
  const BODY_SELECTOR = '[slot="comment"]';
  const REDACT_LINK_SELECTOR = 'a[href*="redact.dev"]';
  const REDACTED_TEXT = "----REDACTED----";
  const REDACTED_MARKER_ATTRIBUTE = "data-redacted-placeholder-applied";
  const ELEMENT_NODE = 1;
  const RESCAN_INTERVAL_MS = 1500;

  logger("Userscript started.");

  function getBodyFromNode(node) {
    if (!node || node.nodeType !== ELEMENT_NODE) {
      return null;
    }

    if (node.matches(BODY_SELECTOR)) {
      return node;
    }

    return node.closest(BODY_SELECTOR) || node.querySelector(BODY_SELECTOR);
  }

  function isAlreadyReplaced(bodyElement) {
    return bodyElement.getAttribute(REDACTED_MARKER_ATTRIBUTE) === "true";
  }

  function hasRedactLink(bodyElement) {
    return Boolean(bodyElement.querySelector(REDACT_LINK_SELECTOR));
  }

  function replaceCommentBody(bodyElement) {
    if (isAlreadyReplaced(bodyElement)) {
      return false;
    }

    bodyElement.replaceChildren(document.createTextNode(REDACTED_TEXT));
    bodyElement.setAttribute(REDACTED_MARKER_ATTRIBUTE, "true");

    return true;
  }

  function processBody(bodyElement) {
    if (!bodyElement || !hasRedactLink(bodyElement)) {
      return;
    }

    if (replaceCommentBody(bodyElement)) {
      logger("Replaced redacted comment body.");
    }
  }

  function scanDocument() {
    document.querySelectorAll(BODY_SELECTOR).forEach(processBody);
  }

  function processNode(node) {
    if (!node || node.nodeType !== ELEMENT_NODE) {
      return;
    }

    const bodyElement = getBodyFromNode(node);
    if (bodyElement) {
      processBody(bodyElement);
    }

    node.querySelectorAll(BODY_SELECTOR).forEach(processBody);
    node.querySelectorAll(REDACT_LINK_SELECTOR).forEach((linkElement) => {
      processBody(getBodyFromNode(linkElement));
    });
  }

  function start() {
    if (!document.body) {
      logger.warn("document.body not ready; retrying start.");
      window.setTimeout(start, 100);
      return;
    }

    scanDocument();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach(processNode);

        if (mutation.target && mutation.target.nodeType === ELEMENT_NODE) {
          const bodyElement = getBodyFromNode(mutation.target);
          if (bodyElement) {
            processBody(bodyElement);
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window.setInterval(scanDocument, RESCAN_INTERVAL_MS);
    logger("Observer and rescan loop attached.");
  }

  start();
})();
