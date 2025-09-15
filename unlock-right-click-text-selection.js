// ==UserScript==
// @name         Unlock Right-Click & Text Selection
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  Unlock right-click menu and text selection on unfriendly websites like pixnet.net
// @author       You
// @match        https://*.pixnet.net/*
// @match        https://www.granitefirm.com/*
// @match        https://blog.udn.com/*
// @run-at       document-start
// @grant        none
// @license      MIT
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/unlock-right-click-text-selection.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/unlock-right-click-text-selection.js
// ==/UserScript==

(function () {
    'use strict';

    const logger = Logger('[Unlock-Right-Click]');

    function removeInlineHandlerFor(eventType) {
        const onProp = 'on' + eventType;
        if (window.addEventListener) {
            window.addEventListener(
                eventType,
                function (e) {
                    // Clear inline handlers up the tree for this event type
                    for (let node = e.target; node; node = node.parentNode) {
                        try {
                            if (onProp in node) node[onProp] = null;
                        } catch (_) {
                            // Ignore nodes that disallow property assignment
                        }
                    }
                },
                true // capture
            );
        }

        try { window[onProp] = null; } catch (_) {}
        try { document[onProp] = null; } catch (_) {}
        try { if (document.body) document.body[onProp] = null; } catch (_) {}
    }

    function injectUserSelectCSS() {
        const style = document.createElement('style');
        style.setAttribute('data-pixnet-unlock', 'true');
        style.textContent = `
            * {
                -webkit-user-select: auto !important;
                -moz-user-select: auto !important;
                -ms-user-select: auto !important;
                user-select: auto !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function unlockInteractions() {
        logger('Applying unlock handlers');
        removeInlineHandlerFor('contextmenu');
        removeInlineHandlerFor('click');
        removeInlineHandlerFor('mousedown');
        removeInlineHandlerFor('mouseup');
        removeInlineHandlerFor('selectstart');
        injectUserSelectCSS();
    }

    // Run ASAP
    unlockInteractions();

    // Run again after DOM is ready in case <head> / <body> was not yet available
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', unlockInteractions, { once: true });
    } else {
        // Also schedule a micro-delay to catch late mutations
        setTimeout(unlockInteractions, 0);
    }
})();


