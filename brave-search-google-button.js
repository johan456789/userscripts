// ==UserScript==
// @name           Brave Search - Search on Google button
// @namespace      none
// @description    Shows a "Search on Google instead" button above the search results on Brave Search.
// @version        1.2.0
// @match          https://search.brave.com/*
// @icon           https://search.brave.com/favicon.ico
// @run-at         document-start
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
  const RESULTS_LIST_SELECTOR = "#mixed-main";
  // Holds the Leo AI answer and other top-of-page widgets, above the results.
  const TOP_SECTION_SELECTOR = "#mixed-top";
  const HYDRATION_TIMEOUT_MS = 10000;
  const OVERLAY_CLASS = "userscript-search-on-google-overlay";
  const PENDING_ATTR = "data-userscript-google-pending";
  // Fixed so the space reserved for the overlay matches the placed button.
  const BUTTON_HEIGHT_PX = 40;
  const BUTTON_MARGIN_PX = 16;

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
  display: flex;
  box-sizing: border-box;
  height: ${BUTTON_HEIGHT_PX}px;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin: ${BUTTON_MARGIN_PX}px 0;
  padding: 0 16px;
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

.${OVERLAY_CLASS} {
  position: absolute;
  z-index: 1;
  margin: 0;
}

/* Reserve the button's space with CSS only, so Svelte's DOM is untouched. */
html[${PENDING_ATTR}] ${TOP_SECTION_SELECTOR},
html[${PENDING_ATTR}]:not(:has(${TOP_SECTION_SELECTOR})) ${RESULTS_LIST_SELECTOR} {
  padding-top: ${BUTTON_HEIGHT_PX + BUTTON_MARGIN_PX * 2}px !important;
}

.${BUTTON_CLASS} svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
`;
    (document.head || document.documentElement).appendChild(style);
  }

  function buildButton(query) {
    const link = document.createElement("a");
    link.id = BUTTON_ID;
    link.className = BUTTON_CLASS;
    link.href = googleUrl(query);

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

  // The SERP is a Svelte app that hydrates well after `load`. Svelte claims the
  // server-rendered nodes by walking siblings, so any node added before that
  // shifts the walk, fails hydration and drops results. Server-rendered images
  // stash early load events in `img.__e`; Svelte replays and clears them when
  // it hydrates, so a cleared `__e` means it is safe to touch the DOM.
  function isHydrated() {
    const list = document.querySelector(RESULTS_LIST_SELECTOR);
    if (!list) {
      return false;
    }
    return [...list.querySelectorAll("img")].some(
      (img) => "__e" in img && img.__e === undefined
    );
  }

  function waitForHydration(callback) {
    const start = Date.now();
    const timer = setInterval(() => {
      if (isHydrated() || Date.now() - start > HYDRATION_TIMEOUT_MS) {
        clearInterval(timer);
        callback();
      }
    }, 100);
  }

  function placeButton() {
    const firstResult = document.querySelector(FIRST_RESULT_SELECTOR);
    if (!firstResult) {
      return;
    }

    // Stay out of the results list itself: Svelte keeps updating it with
    // sibling-based anchors, so place the button before the whole list, or
    // before the Leo AI answer section when there is one.
    const anchor =
      document.querySelector(TOP_SECTION_SELECTOR) ||
      firstResult.closest(RESULTS_LIST_SELECTOR) ||
      firstResult;

    const query = getQuery();
    const existing = document.getElementById(BUTTON_ID);

    if (existing) {
      const targetUrl = googleUrl(query);
      if (existing.nextElementSibling === anchor) {
        if (existing.getAttribute("href") !== targetUrl) {
          existing.setAttribute("href", targetUrl);
          logger(`Updated Google URL for query: ${query}`);
        }
        alignButton(existing);
        return;
      }
      existing.remove();
    }

    const button = buildButton(query);
    anchor.parentElement.insertBefore(button, anchor);
    alignButton(button);
    logger(`Inserted button above results (query: ${query})`);
  }

  // Line the pill up with the result text. The top section spans the whole
  // grid, so size it from the results column rather than its container.
  function alignButton(button) {
    const firstResult = document.querySelector(FIRST_RESULT_SELECTOR);
    if (!firstResult || !button.parentElement) {
      return;
    }

    const list = firstResult.closest(RESULTS_LIST_SELECTOR) || firstResult;
    const listRect = list.getBoundingClientRect();
    const parentRect = button.parentElement.getBoundingClientRect();
    const inset = parseFloat(getComputedStyle(firstResult).paddingLeft) || 0;
    const marginLeft = `${listRect.left - parentRect.left + inset}px`;
    const width = `${listRect.width - inset}px`;

    if (button.style.marginLeft !== marginLeft) {
      button.style.marginLeft = marginLeft;
    }
    if (button.style.width !== width) {
      button.style.width = width;
    }
  }

  // Until Svelte hydrates, show the button as an overlay appended to <body>,
  // outside the Svelte root, over space reserved for it with CSS.
  function showOverlay() {
    const firstResult = document.querySelector(FIRST_RESULT_SELECTOR);
    const anchor =
      document.querySelector(TOP_SECTION_SELECTOR) ||
      document.querySelector(RESULTS_LIST_SELECTOR);
    if (!firstResult || !anchor || document.getElementById(BUTTON_ID)) {
      return false;
    }

    const button = buildButton(getQuery());
    button.classList.add(OVERLAY_CLASS);
    document.body.appendChild(button);
    logger("Showing overlay button until hydration");

    const position = () => {
      if (!button.isConnected) {
        return;
      }
      const list = firstResult.closest(RESULTS_LIST_SELECTOR) || firstResult;
      const listRect = list.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const inset = parseFloat(getComputedStyle(firstResult).paddingLeft) || 0;
      button.style.left = `${listRect.left + window.scrollX + inset}px`;
      button.style.top = `${anchorRect.top + window.scrollY + BUTTON_MARGIN_PX}px`;
      button.style.width = `${listRect.width - inset}px`;
      requestAnimationFrame(position);
    };
    position();
    return true;
  }

  // Runs at document-start: reserve the space before the browser first paints
  // the results, then show the overlay as soon as the results are parsed.
  function start() {
    ensureStyles();
    document.documentElement.setAttribute(PENDING_ATTR, "");
    overlayObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  const overlayObserver = new MutationObserver(() => {
    if (showOverlay()) {
      overlayObserver.disconnect();
    }
  });

  // Some managers run document-start scripts before <html> exists.
  if (document.documentElement) {
    start();
  } else {
    const rootObserver = new MutationObserver(() => {
      if (document.documentElement) {
        rootObserver.disconnect();
        start();
      }
    });
    rootObserver.observe(document, { childList: true });
  }

  waitForHydration(() => {
    overlayObserver.disconnect();
    // Swap the overlay for the real button in one task, so nothing flickers.
    const overlay = document.querySelector(`.${OVERLAY_CLASS}`);
    if (overlay) {
      overlay.remove();
    }
    document.documentElement.removeAttribute(PENDING_ATTR);
    placeButton();

    const observer = new MutationObserver(placeButton);
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("resize", () => {
      const button = document.getElementById(BUTTON_ID);
      if (button) {
        alignButton(button);
      }
    });

    let lastHref = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastHref) {
        lastHref = window.location.href;
        placeButton();
      }
    }, 1000);
  });
})();