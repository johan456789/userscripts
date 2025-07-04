// ==UserScript==
// @name         Always Show UI Elements
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Makes .hn-comment-collapse and .hn-comment-icons always visible
// @author       You
// @match        https://news.ycombinator.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ycombinator.com
// @grant        none
// @run-at       document-start
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/hn-modern-show-ui-elements.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/hn-modern-show-ui-elements.js
// ==/UserScript==

// This is userscript used to modify behavior of Modern for Hacker News (https://chromewebstore.google.com/detail/modern-for-hacker-news/dabkegjlekdcmefifaolmdhnhdcplklo).
// It's useless unless you have the extension installed.

(function() {
    'use strict';

    const style = document.createElement('style');
    style.innerHTML = `
        .hn-comment-icons {
            opacity: 0.7 !important;
            pointer-events: auto !important;
            z-index: 20 !important;
        }
        .hn-story-icon {
            opacity: 0.7 !important;
        }
        .hn-comment-collapse {
            opacity: 0.3 !important;
            pointer-events: auto !important;
        }
    `;
    document.head.appendChild(style);
})();
