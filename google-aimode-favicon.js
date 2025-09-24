// ==UserScript==
// @name         Replace Favicon in Google Search AI Mode (udm=50)
// @namespace    https://greasyfork.org/en/users/688917
// @version      1.0.0
// @description  Replaces the favicon in Google Search AI mode with the Gemini-inspired SVG.
// @author       You
// @match        https://www.google.com/search?udm=50*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @run-at       document-end
// @license      MIT
// @downloadURL  https://github.com/johan456789/userscripts/raw/refs/heads/main/google-aimode-favicon.js
// @updateURL    https://github.com/johan456789/userscripts/raw/refs/heads/main/google-aimode-favicon.js
// ==/UserScript==

(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  if (params.get("udm") !== "50") {
    return;
  }

  const logger = Logger("[Google-AI-Mode-Favicon]");
  logger("Script started");

  const svgMarkup = `<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 225 225" enable-background="new 0 0 225 225" xml:space="preserve"><path fill="#FFFEFE" opacity="1" stroke="none" d="M129 226c-43 0-85.5 0-128 0 0-75 0-150 0-225C76 1 151 1 226 1c0 75 0 150 0 225-32.17 0-64.34 0-97 0l-2.64-83.04c19.38 19.39 38.76 38.78 58.27 58.29 4.5-4.58 8.65-8.8 12.62-12.83-19.42-19.63-38.82-39.24-58.09-59.51 6.04-9.07 10.7-18.62 11.08-30.14h-17.83c-.48 1.91-.94 3.82-1.44 5.73-3.78 14.24-12.7 24.03-26.39 28.96-21.15 7.6-45.21-1.73-54.7-26.69-9.5-33.38 18.69-61.63 50.24-54.17.97.22 2.68.05 3.48-.63 4.61-4 9.01-8.21 13.85-12.67-12.38-7.29-24.87-7.4-36.93-5.73-23.84 3.3-39.94 17.38-48 39.83-5.77 16.08-5.02 32.28 3.42 48.38 12.35 21.41 30.5 32.74 55.58 32.45 12.85-.15 23.94-4.95 34.83-11.3L170.93 92.59c8.29-14.85 20.96-23.7 37.69-27.16-23.52-4.96-37.46-19.52-43.6-43.37-6.17 24.74-20.76 38.92-45.2 43.54 24.12 4.23 38.32 18.32 45.1 41.78 2.27-5.55 4-9.77 6.04-14.7z"/><path fill="#FBBC09" opacity="1" stroke="none" d="M49.76 107.57c9.5 24.22 33.58 33.52 54.76 25.9 13.69-4.94 22.62-14.75 26.4-28.98.5-1.9.97-3.81 1.48-5.73h17.83c-.37 11.52-5.04 21.08-11.46 30.65-4.53 4.66-8.68 8.81-12.85 12.97-10.44 6.93-21.54 11.73-34.39 11.87-25.08.29-43.23-11.03-55.45-33.07 4.65-4.95 9.18-9.26 13.68-13.61z"/><path fill="#EA4637" opacity="1" stroke="none" d="M49.76 107.21c-4.53 4.67-9.06 8.99-13.77 13.6-8.49-15.11-9.24-31.3-3.47-47.4 8.06-22.48 24.16-36.57 48-39.87 12.07-1.67 24.56-1.55 36.9 5.75-4.84 4.44-9.23 8.67-13.84 12.67-.8.69-2.49.84-3.62.58-31.56-7.46-59.78 20.79-50.17 54.67z"/><path fill="#4586F4" opacity="1" stroke="none" d="M170.77 92.92c-1.88 4.58-3.6 8.82-5.84 14.41-6.79-23.52-21-37.63-45.16-41.85 24.46-4.62 39.05-18.78 45.23-43.46 6.11 23.85 20.05 38.41 43.58 43.37-16.74 3.45-29.41 12.3-37.81 27.53z"/><path fill="#37A954" opacity="1" stroke="none" d="M126.13 142.66c3.94-4.45 8.1-8.6 12.56-12.9 19.71 19.48 39.12 39.1 58.53 58.75-4.02 4.05-8.17 8.27-12.69 12.83-19.49-19.51-38.86-38.9-58.4-58.68z"/></svg>`;
  const svgDataUrl = `data:image/svg+xml,${encodeURIComponent(svgMarkup)}`;
  const iconSelector = 'link[rel*="icon"]';

  function setFavicon(link) {
    if (!link) {
      return;
    }

    if (link.getAttribute("href") === svgDataUrl) {
      return;
    }

    link.setAttribute("href", svgDataUrl);
    link.setAttribute("type", "image/svg+xml");
    link.setAttribute("sizes", "any");
    logger("Updated favicon on", link.getAttribute("rel"));
  }

  function ensureFavicon() {
    const { head } = document;
    if (!head) {
      logger("Head element missing; skipping favicon update");
      return;
    }

    const iconLinks = head.querySelectorAll(iconSelector);

    if (iconLinks.length === 0) {
      const link = document.createElement("link");
      link.setAttribute("rel", "icon");
      head.appendChild(link);
      logger("Created missing favicon link element");
      setFavicon(link);
      return;
    }

    iconLinks.forEach(setFavicon);
  }

  ensureFavicon();

  if (!document.head) {
    return;
  }

  const observer = new MutationObserver((mutations) => {
    const shouldUpdate = mutations.some((mutation) => {
      if (mutation.type === "childList") {
        return [...mutation.addedNodes, ...mutation.removedNodes].some(
          (node) =>
            node.nodeType === Node.ELEMENT_NODE && node.matches?.(iconSelector)
        );
      }

      if (mutation.type === "attributes") {
        return mutation.target.matches?.(iconSelector);
      }

      return false;
    });

    if (shouldUpdate) {
      logger("DOM mutation detected; ensuring favicon");
      ensureFavicon();
    }
  });

  observer.observe(document.head, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href", "rel"],
  });
})();
