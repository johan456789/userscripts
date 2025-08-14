// ==UserScript==
// @name         Twitter Remove Discover More Feed
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Hide the irrelevant "Discover more" feed and everything after it in comment threads.
// @author       You
// @match        https://*.twitter.com/*
// @match        https://twitter.com/*
// @match        https://x.com/*
// @license      MIT
// @run-at       document-end
// @noframes
// @require      https://github.com/johan456789/userscripts/raw/main/utils/wait-for-element.js
// @require      https://github.com/johan456789/userscripts/raw/main/utils/debounce.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/twitter-remove-discover-more-feed.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/twitter-remove-discover-more-feed.js
// ==/UserScript==

function logger(message) {
    console.log("[Twitter-Remove-Discover-More] " + message);
}
logger("Userscript started.");

(function() {
    'use strict';

    const CELL_SELECTOR = 'main div[data-testid="cellInnerDiv"]';
    const DISCOVER_TEXT = 'discover more';

    function cellContainsDiscoverMore(cell) {
        const spans = cell.querySelectorAll('span');
        for (const span of spans) {
            const text = span.textContent || '';
            if (text.trim().toLowerCase().includes(DISCOVER_TEXT)) {
                return true;
            }
        }
        return false;
    }

    function hideDiscoverMoreAndFollowing() {
        const cells = document.querySelectorAll(CELL_SELECTOR);
        let hideFromHere = false;

        for (const cell of cells) {
            if (!hideFromHere && cellContainsDiscoverMore(cell)) {
                logger('"Discover more" marker found. Hiding this cell and all following cells.');
                hideFromHere = true;
            }

            if (hideFromHere) {
                if (cell.style.display !== 'none') {
                    cell.style.display = 'none';
                }
            }
        }
    }

    

    if (window.__twitterRemoveDiscoverMoreInitialized) {
        return;
    }
    window.__twitterRemoveDiscoverMoreInitialized = true;

    waitForElement('main', (mainEl) => {
        hideDiscoverMoreAndFollowing();

        const debouncedRun = debounce(hideDiscoverMoreAndFollowing, 200);

        const observer = new MutationObserver(() => {
            debouncedRun();
        });

        observer.observe(mainEl, { childList: true, subtree: true });
    });
})();


