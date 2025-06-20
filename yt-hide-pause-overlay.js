// ==UserScript==
// @name      Youtube hide pause overlay
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Hides the pause overlay on YouTube
// @author       You
// @match        https://www.youtube.com/*
// @run-at       document-start
// @grant        none
// @license      MIT
// @updateURL    https://github.com/johan456789/userscripts/raw/main/yt-hide-pause-overlay.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/yt-hide-pause-overlay.js
// ==/UserScript==

function logger(message) {
    console.log("[YT-hide-pause-overlay] " + message);
}

(function() {
    'use strict';
    
    logger('Script started');
    
    // Add CSS to ensure the overlay stays hidden
    const style = document.createElement('style');
    style.textContent = `
        .ytp-pause-overlay {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
    logger('Added CSS to hide the pause overlay.');
})();
