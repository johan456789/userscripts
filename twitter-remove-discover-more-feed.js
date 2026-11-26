// ==UserScript==
// @name         Twitter Remove Discover More Feed
// @namespace    http://tampermonkey.net/
// @version      1.0.7
// @description  Hide the irrelevant "Discover more" feed and everything after it in comment threads.
// @author       You
// @match        https://*.twitter.com/*
// @match        https://twitter.com/*
// @match        https://x.com/*
// @exclude      https://x.com/home
// @license      MIT
// @run-at       document-end
// @noframes
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @require      https://github.com/johan456789/userscripts/raw/main/utils/wait-for-element.js
// @require      https://github.com/johan456789/userscripts/raw/main/utils/debounce.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/twitter-remove-discover-more-feed.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/twitter-remove-discover-more-feed.js
// ==/UserScript==

const logger = Logger("[Twitter-Remove-Discover-More-Feed]");
logger("Userscript started.");

(function () {
  "use strict";

  // X now renders timelines as virtualized lists: <ul> rows with data-index.
  // Keep the old cellInnerDiv markup as a fallback for older app versions.
  const CELL_SELECTOR = 'li[data-index], div[data-testid="cellInnerDiv"]';
  const DISCOVER_TEXT = "discover more";
  const HIDDEN_FROM_ATTR = "data-remove-discover-more-from";

  function cellContainsDiscoverMore(cell) {
    // Current markup puts the label in an unqualified h2; older markup used
    // spans (sometimes under a role="heading" h2).
    for (const heading of cell.querySelectorAll("h2, h3")) {
      const text = heading.textContent || "";
      if (text.trim().toLowerCase().includes(DISCOVER_TEXT)) {
        return true;
      }
    }

    for (const span of cell.querySelectorAll("span")) {
      const text = span.textContent || "";
      if (text.trim().toLowerCase() === DISCOVER_TEXT) {
        return true;
      }
    }

    return false;
  }

  function listForCell(cell) {
    // Scope each virtualized list on its own so a marker in the photo overlay
    // never hides the timeline behind it. Fall back to the old main/overlay
    // containers for cellInnerDiv markup.
    const list = cell.closest("ul, ol");
    if (list) {
      return list;
    }
    return cell.closest('[role="dialog"], #layers, main') || document.body;
  }

  function indexOfCell(cell, cells) {
    const raw = cell.getAttribute("data-index");
    return raw === null ? cells.indexOf(cell) : Number(raw);
  }

  function hideDiscoverMoreAndFollowing() {
    const cellsByList = new Map();

    for (const cell of document.querySelectorAll(CELL_SELECTOR)) {
      const list = listForCell(cell);
      if (!cellsByList.has(list)) {
        cellsByList.set(list, []);
      }
      cellsByList.get(list).push(cell);
    }

    for (const [list, cells] of cellsByList) {
      // Remember the marker index on the list itself: virtualized rows are
      // recycled as you scroll, so the marker cell can leave the DOM.
      let hideFrom = list.getAttribute(HIDDEN_FROM_ATTR);

      if (hideFrom === null) {
        const marker = cells.find(cellContainsDiscoverMore);
        if (!marker) {
          continue;
        }
        hideFrom = String(indexOfCell(marker, cells));
        list.setAttribute(HIDDEN_FROM_ATTR, hideFrom);
        logger(
          `"Discover more" marker found. Hiding this cell and all following cells in this list.`
        );
      }

      const from = Number(hideFrom);
      for (const cell of cells) {
        if (indexOfCell(cell, cells) >= from && cell.style.display !== "none") {
          cell.style.display = "none";
        }
      }
    }
  }

  if (window.__twitterRemoveDiscoverMoreInitialized) {
    return;
  }
  window.__twitterRemoveDiscoverMoreInitialized = true;

  // Observe both main element and document body for virtualized lists
  waitForElement("main", (mainEl) => {
    hideDiscoverMoreAndFollowing();

    const debouncedRun = debounce(hideDiscoverMoreAndFollowing, 200);

    const observer = new MutationObserver(() => {
      debouncedRun();
    });

    observer.observe(mainEl, { childList: true, subtree: true });

    // Also observe body for absolutely positioned virtualized list cells
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
