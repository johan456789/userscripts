// ==UserScript==
// @name         Google Skip Redirect Warning
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Skip Google's redirection notice (google.com/url?q=*) and go directly to the target link
// @author       You
// @match        https://www.google.com/url*
// @run-at       document-start
// @grant        none
// @license      MIT
// @updateURL    https://github.com/johan456789/userscripts/raw/main/google-skip-lucky-redirect-warning.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/google-skip-lucky-redirect-warning.js
// ==/UserScript==

function logger(message) {
    console.log("[Google-Skip-Redirect] " + message);
}

(function () {
    'use strict';

    const logger = window.__G_SKIP_REDIRECT_LOGGER__ || ((msg) => console.log("[Google-Skip-Redirect] " + msg));
    logger('Script started');

    try {
        const currentUrl = new URL(window.location.href);
        if (currentUrl.hostname === 'www.google.com' && currentUrl.pathname === '/url') {
            const params = currentUrl.searchParams;
            const target = params.get('q');

            if (target && typeof target === 'string') {
                // Avoid loops if q points back to Google's redirector
                if (!/^https?:\/\/www\.google\.com\/url/i.test(target)) {
                    // Redirect immediately without adding to history
                    logger('Redirecting to target: ' + target);
                    window.location.replace(target);
                }
                else {
                    logger('Target is another Google redirect URL. Skipping to avoid loop.');
                }
            } else {
                logger('No target found in q or url parameter.');
            }
        }
    } catch (e) {
        logger('Error occurred: ' + (e && e.message ? e.message : String(e)));
    }
})();


