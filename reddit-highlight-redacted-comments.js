// ==UserScript==
// @name         Reddit Replace Redacted Comments
// @namespace    http://tampermonkey.net/
// @version      0.1.6
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
  const COMMENT_SELECTOR = "shreddit-comment";
  const BODY_SELECTOR = '[slot="comment"]';
  const REDACTED_TEXT = "----REDACTED----";
  const REDACTED_MARKER_ATTRIBUTE = "data-redacted-placeholder-applied";
  const ELEMENT_NODE = 1;
  const RESCAN_INTERVAL_MS = 1500;

  logger("Userscript started.");

  function getCommentBody(commentElement) {
    return commentElement.querySelector(`:scope > ${BODY_SELECTOR}`) || commentElement.querySelector(BODY_SELECTOR);
  }

  function isAlreadyReplaced(bodyElement) {
    return bodyElement.getAttribute(REDACTED_MARKER_ATTRIBUTE) === "true";
  }

  function isRedactMassDeletedComment(bodyElement) {
    const bodyText = (bodyElement.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!bodyText) {
      return false;
    }

    const hasRedactLink = Boolean(bodyElement.querySelector('a[href*="redact.dev"]'));
    const mentionsMassDelete = bodyText.includes("mass deleted");
    const mentionsAnonymized = bodyText.includes("anonymized");
    const mentionsRedact = bodyText.includes("redact");

    return (
      (hasRedactLink && (mentionsMassDelete || mentionsAnonymized)) ||
      (mentionsMassDelete && mentionsAnonymized && mentionsRedact)
    );
  }

  function replaceCommentBody(bodyElement) {
    if (isAlreadyReplaced(bodyElement)) {
      return false;
    }

    bodyElement.replaceChildren(document.createTextNode(REDACTED_TEXT));
    bodyElement.setAttribute(REDACTED_MARKER_ATTRIBUTE, "true");

    return true;
  }

  function processComment(commentElement) {
    const bodyElement = getCommentBody(commentElement);
    if (!bodyElement || !isRedactMassDeletedComment(bodyElement)) {
      return;
    }

    if (replaceCommentBody(bodyElement)) {
      logger("Replaced redacted comment body.");
    }
  }

  function scanDocument() {
    document.querySelectorAll(COMMENT_SELECTOR).forEach(processComment);
  }

  function processNode(node) {
    if (!node || node.nodeType !== ELEMENT_NODE) {
      return;
    }

    if (node.matches(COMMENT_SELECTOR)) {
      processComment(node);
    }

    node.querySelectorAll(COMMENT_SELECTOR).forEach(processComment);
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
          const commentElement = mutation.target.closest(COMMENT_SELECTOR);
          if (commentElement) {
            processComment(commentElement);
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
