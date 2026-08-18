// ==UserScript==
// @name           Brave Search - Search on Google button
// @namespace      none
// @description    Shows a "Search on Google instead" button right before the first search result on Brave Search.
// @version        1.0.0
// @match          https://search.brave.com/*
// @icon           https://search.brave.com/favicon.ico
// @run-at         document-end
// @grant          none
// @require        https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL      https://github.com/johan456789/userscripts/raw/main/brave-search-google-button.js
// @downloadURL    https://github.com/johan456789/userscripts/raw/main/brave-search-google-button.js
// ==/UserScript==

(function () {
  "use strict";

  const logger = Logger("[Brave-Search-Google-Button]");

  const BUTTON_ID = "userscript-search-on-google-button";
  const BUTTON_CLASS = "userscript-search-on-google-button";
  const STYLE_ID = "userscript-search-on-google-button-styles";
  const FIRST_RESULT_SELECTOR = '.main-column .snippet[data-type="web"]';

  function getQuery() {
    return new URLSearchParams(window.location.search).get("q") || "";
  }

  function googleUrl(query) {
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
.${BUTTON_CLASS} {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0;
  padding: 8px 16px;
  border: 1px solid var(--color-neutral-20, rgba(127, 127, 127, 0.35));
  border-radius: var(--border-radius-full, 999px);
  background: var(--color-neutral-10, transparent);
  color: inherit;
  font: 600 0.8rem/1.2rem var(--main-font, sans-serif);
  text-decoration: none;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.${BUTTON_CLASS}:hover {
  border-color: var(--color-accent, rgba(127, 127, 127, 0.6));
  background: var(--color-neutral-20, rgba(127, 127, 127, 0.12));
}

.${BUTTON_CLASS} svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
`;
    document.head.appendChild(style);
  }

  function buildButton(query) {
    const link = document.createElement("a");
    link.id = BUTTON_ID;
    link.className = BUTTON_CLASS;
    link.href = googleUrl(query);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = `Search "${query}" on Google`;
    link.setAttribute("role", "button");

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "currentColor");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML =
      '<path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"/>';

    const span = document.createElement("span");
    span.textContent = "Search on Google instead";

    link.appendChild(svg);
    link.appendChild(span);
    return link;
  }

  function placeButton() {
    const firstResult = document.querySelector(FIRST_RESULT_SELECTOR);
    if (!firstResult) {
      return;
    }

    const query = getQuery();
    const existing = document.getElementById(BUTTON_ID);

    if (existing) {
      const targetUrl = googleUrl(query);
      if (existing.nextElementSibling === firstResult) {
        if (existing.getAttribute("href") !== targetUrl) {
          existing.setAttribute("href", targetUrl);
          logger(`Updated Google URL for query: ${query}`);
        }
        return;
      }
      existing.remove();
    }

    const button = buildButton(query);
    firstResult.parentElement.insertBefore(button, firstResult);
    logger(`Inserted button before first result (query: ${query})`);
  }

  ensureStyles();
  placeButton();

  const observer = new MutationObserver(placeButton);
  observer.observe(document.body, { childList: true, subtree: true });

  let lastHref = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastHref) {
      lastHref = window.location.href;
      placeButton();
    }
  }, 1000);
})();