// ==UserScript==
// @name         Google Maps Language Selector
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Adds a language selector button to Google Maps.
// @author       You
// @match        https://www.google.com/maps*
// @match        https://www.google.*/maps*
// @match        https://maps.google.com/*
// @match        https://maps.google.*/
// @grant        none
// @run-at       document-end
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @require      https://github.com/johan456789/userscripts/raw/main/utils/wait-for-element.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/google-maps-language-selector.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/google-maps-language-selector.js
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    const logger = Logger('[Google-Maps-Language-Selector]');
    if (window.__googleMapsLangSelectorInitialized) {
        return;
    }
    window.__googleMapsLangSelectorInitialized = true;
    logger('Script started.');

    const CONTAINER_SELECTOR = '#gb div.gb_Ad';
    // Only Tc0rEd Zf54rc are required for the white squircle background. Center icon via inline flex styles.
    const BUTTON_WRAPPER_HTML = '<div class="gb_z gb_td gb_Pf gb_0"><button class="Tc0rEd Zf54rc" style="display:flex;align-items:center;justify-content:center"><span class="google-symbols" style="font-size: 18px; line-height: 1;"></span></button></div>';

    function createButtonElement() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = BUTTON_WRAPPER_HTML;
        const element = wrapper.firstElementChild;
        const button = element.querySelector('button');
        if (button) {
            button.type = 'button';
            button.title = 'Switch language to zh-TW';
            button.addEventListener('click', (event) => {
                event.preventDefault();
                // No need to check existing 'hl' parameter; Google uses the last one.
                try {
                    const url = new URL(window.location.href);
                    url.searchParams.append('hl', 'zh-TW');
                    logger('Navigating to', url.toString());
                    window.location.href = url.toString();
                } catch (error) {
                    logger.error('URL construction failed, falling back to string append.', error);
                    const separator = window.location.href.includes('?') ? '&' : '?';
                    window.location.href = window.location.href + separator + 'hl=zh-TW';
                }
            });
        }
        return element;
    }

    waitForElement(CONTAINER_SELECTOR, (container) => {
        logger('Container found:', container);
        const buttonEl = createButtonElement();
        if (!buttonEl) {
            logger.error('Failed to create button element.');
            return;
        }

        const firstItem = container.firstElementChild;
        if (firstItem && firstItem.nextSibling) {
            container.insertBefore(buttonEl, firstItem.nextSibling);
        } else if (firstItem) {
            container.appendChild(buttonEl);
        } else {
            container.appendChild(buttonEl);
        }
        logger('Language selector inserted after the first item.');
    }, 10000);
})();
