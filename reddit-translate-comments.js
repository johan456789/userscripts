// ==UserScript==
// @name         Reddit Translate Comments
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Add a translate button to Reddit comments that translates foreign language comments to English
// @include      *://reddit.com/*
// @include      *://*.reddit.com/*
// @match        https://www.reddit.com/*
// @match        https://reddit.com/*
// @match        https://*.reddit.com/*
// @license      MIT
// @run-at       document-end
// @noframes
// @grant        GM_xmlhttpRequest
// @connect      translate.googleapis.com
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL    https://github.com/johan456789/userscripts/raw/refs/heads/main/reddit-translate-comments.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/refs/heads/main/reddit-translate-comments.js
// ==/UserScript==

(function () {
  "use strict";

  const logger = Logger("[Reddit-Translate-Comments]");
  const COMMENT_SELECTOR = "shreddit-comment";
  const COMMENT_BODY_SELECTOR = '[slot="comment"]';
  const ACTION_ROW_COMPONENT_SELECTOR = "shreddit-comment-action-row";
  const TRANSLATE_BTN_CLASS = "translate-comment-btn";
  const PROCESSED_MARKER = "data-translate-btn-added";
  const RESCAN_INTERVAL_MS = 2000;

  const TRANSLATE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor" height="16" width="16" style="vertical-align: middle;">
    <path d="M192 64C209.7 64 224 78.3 224 96L224 128L352 128C369.7 128 384 142.3 384 160C384 177.7 369.7 192 352 192L342.4 192L334 215.1C317.6 260.3 292.9 301.6 261.8 337.1C276 345.9 290.8 353.7 306.2 360.6L356.6 383L418.8 243C423.9 231.4 435.4 224 448 224C460.6 224 472.1 231.4 477.2 243L605.2 531C612.4 547.2 605.1 566.1 589 573.2C572.9 580.3 553.9 573.1 546.8 557L526.8 512L369.3 512L349.3 557C342.1 573.2 323.2 580.4 307.1 573.2C291 566 283.7 547.1 290.9 531L330.7 441.5L280.3 419.1C257.3 408.9 235.3 396.7 214.5 382.7C193.2 399.9 169.9 414.9 145 427.4L110.3 444.6C94.5 452.5 75.3 446.1 67.4 430.3C59.5 414.5 65.9 395.3 81.7 387.4L116.2 370.1C132.5 361.9 148 352.4 162.6 341.8C148.8 329.1 135.8 315.4 123.7 300.9L113.6 288.7C102.3 275.1 104.1 254.9 117.7 243.6C131.3 232.3 151.5 234.1 162.8 247.7L173 259.9C184.5 273.8 197.1 286.7 210.4 298.6C237.9 268.2 259.6 232.5 273.9 193.2L274.4 192L64.1 192C46.3 192 32 177.7 32 160C32 142.3 46.3 128 64 128L160 128L160 96C160 78.3 174.3 64 192 64zM448 334.8L397.7 448L498.3 448L448 334.8z"/>
  </svg>`;

  // Store original text for each comment
  const originalTexts = new WeakMap();

  logger("Userscript started.");

  /**
   * Translate text using Google Translate API
   * @param {string} text - Text to translate
   * @param {string} targetLang - Target language code (default: 'en')
   * @returns {Promise<string>} - Translated text
   */
  async function translateText(text, targetLang = "en") {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: url,
        onload: function (response) {
          try {
            const result = JSON.parse(response.responseText);
            if (result && result[0]) {
              const translatedText = result[0]
                .map((item) => item[0])
                .filter(Boolean)
                .join("");
              resolve(translatedText);
            } else {
              reject(new Error("Invalid response format"));
            }
          } catch (e) {
            reject(e);
          }
        },
        onerror: function (error) {
          reject(error);
        },
      });
    });
  }

  /**
   * Get the text content from a comment body element
   * @param {Element} bodyElement - The comment body element
   * @returns {string} - The text content
   */
  function getCommentText(bodyElement) {
    const paragraphs = bodyElement.querySelectorAll("p");
    if (paragraphs.length > 0) {
      return Array.from(paragraphs)
        .map((p) => p.textContent)
        .join("\n\n");
    }
    return bodyElement.textContent || "";
  }

  /**
   * Set the text content of a comment body element
   * Preserves the structure with paragraphs
   * @param {Element} bodyElement - The comment body element
   * @param {string} text - The text to set
   */
  function setCommentText(bodyElement, text) {
    // Find the content container (may be .py-0, .md, or direct child div)
    let contentDiv =
      bodyElement.querySelector(".py-0") ||
      bodyElement.querySelector(".md") ||
      bodyElement.querySelector("div");

    if (!contentDiv) {
      contentDiv = bodyElement;
    }

    const paragraphs = text.split("\n\n");
    contentDiv.innerHTML = paragraphs
      .map((p) => `<p dir="auto">${escapeHtml(p)}</p>`)
      .join("");
  }

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   */
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Create the translate button element
   * @param {Element} comment - The shreddit-comment element
   * @returns {Element} - The button element
   */
  function createTranslateButton(comment) {
    const button = document.createElement("button");
    button.className = `${TRANSLATE_BTN_CLASS} button border-sm shrink-0 text-label-2 button-plain-weak inline-flex items-center px-sm py-xs`;
    button.style.cssText = "height: var(--size-button-sm-h);";
    button.innerHTML = `
      <span class="flex items-center">
        <span class="flex text-body-1 me-2xs">${TRANSLATE_ICON_SVG}</span>
        <span>Translate</span>
      </span>
    `;

    let isTranslated = false;

    button.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const bodyElement = comment.querySelector(COMMENT_BODY_SELECTOR);
      if (!bodyElement) {
        logger.error("Could not find comment body element");
        return;
      }

      const textSpan = button.querySelector("span > span:last-child");

      if (isTranslated) {
        // Restore original text
        const original = originalTexts.get(comment);
        if (original) {
          setCommentText(bodyElement, original);
          textSpan.textContent = "Translate";
          isTranslated = false;
          logger("Restored original text");
        }
      } else {
        // Translate
        const originalText = getCommentText(bodyElement);
        if (!originalText.trim()) {
          logger.warn("No text to translate");
          return;
        }

        // Store original text
        originalTexts.set(comment, originalText);

        // Show loading state
        textSpan.textContent = "Translating...";
        button.disabled = true;

        try {
          const translatedText = await translateText(originalText);
          setCommentText(bodyElement, translatedText);
          textSpan.textContent = "Original";
          isTranslated = true;
          logger("Translated comment successfully");
        } catch (error) {
          logger.error("Translation failed:", error);
          textSpan.textContent = "Translate";
          originalTexts.delete(comment);
        } finally {
          button.disabled = false;
        }
      }
    });

    return button;
  }

  /**
   * Find the insertion point for the translate button inside shadow DOM
   * Looks for the share slot first, then award slot as fallback
   * @param {ShadowRoot} shadowRoot - The shadow root of the action row component
   * @returns {Element|null} - The slot element to insert before, or null if not found
   */
  function findInsertionPoint(shadowRoot) {
    // Look for share slot first (insert before it)
    const shareSlot = shadowRoot.querySelector('slot[name="comment-share"]');
    if (shareSlot) {
      return shareSlot;
    }

    // Look for award slot (insert before it, after Reply)
    const awardSlot = shadowRoot.querySelector('slot[name="comment-award"]');
    if (awardSlot) {
      return awardSlot;
    }

    return null;
  }

  /**
   * Process a single comment element
   * @param {Element} comment - The shreddit-comment element
   */
  function processComment(comment) {
    if (comment.getAttribute(PROCESSED_MARKER) === "true") {
      return;
    }

    // Find the action row component (shreddit-comment-action-row)
    const actionRowComponent = comment.querySelector(ACTION_ROW_COMPONENT_SELECTOR);
    if (!actionRowComponent) {
      return;
    }

    // Access the shadow root to insert into the correct location
    const shadowRoot = actionRowComponent.shadowRoot;
    if (!shadowRoot) {
      return;
    }

    const insertionPoint = findInsertionPoint(shadowRoot);
    if (!insertionPoint) {
      return;
    }

    const translateBtn = createTranslateButton(comment);

    // Insert into shadow DOM before the share slot
    insertionPoint.parentElement.insertBefore(translateBtn, insertionPoint);

    comment.setAttribute(PROCESSED_MARKER, "true");
    logger("Added translate button to comment");
  }

  /**
   * Scan document for comments and add translate buttons
   */
  function scanDocument() {
    const comments = document.querySelectorAll(COMMENT_SELECTOR);
    comments.forEach(processComment);
  }

  /**
   * Process a single DOM node (for MutationObserver)
   * @param {Node} node - The DOM node to process
   */
  function processNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    if (node.matches && node.matches(COMMENT_SELECTOR)) {
      processComment(node);
    }

    const comments = node.querySelectorAll
      ? node.querySelectorAll(COMMENT_SELECTOR)
      : [];
    comments.forEach(processComment);
  }

  /**
   * Start the userscript
   */
  function start() {
    if (!document.body) {
      logger.warn("document.body not ready; retrying start.");
      window.setTimeout(start, 100);
      return;
    }

    // Add custom styles
    const style = document.createElement("style");
    style.textContent = `
      .${TRANSLATE_BTN_CLASS}:hover {
        background-color: var(--color-neutral-background-hover, rgba(0, 0, 0, 0.05));
      }
      .${TRANSLATE_BTN_CLASS}:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `;
    document.head.appendChild(style);

    scanDocument();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach(processNode);
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.setInterval(scanDocument, RESCAN_INTERVAL_MS);
    logger("Observer and rescan loop attached.");
  }

  start();
})();
