// ==UserScript==
// @name         Quora-Show-Answers-By-Default
// @namespace    http://tampermonkey.net/
// @version      0.4.1
// @match        https://www.quora.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @updateURL    https://github.com/johan456789/userscripts/raw/main/quora-show-answers-by-default.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/quora-show-answers-by-default.js
// ==/UserScript==

(function () {
    'use strict';
    console.log('Quora-Show-Answers-By-Default: script started');

    const dropdownBtnSelector = '#mainContent .q-box button';
    const dropdownMenuSelector = '.q-box .puppeteer_test_popover_menu';

    // Delay (ms) between clicking the dropdown button and selecting the "answer" option.
    const SECOND_CLICK_DELAY_MS = 100;

    waitForElement(dropdownBtnSelector, clickDropdownBtn);
    waitForElement(dropdownMenuSelector, clickAnswerInMenu);

    /**
     * Observe the document until an element that matches `selector` exists, then
     * invoke `callback(el)` and stop observing.
     * @param {string} selector CSS selector for target element.
     * @param {(el: HTMLElement) => void} callback Function to run when found.
     */
    function waitForElement(selector, callback) {
        const existing = document.querySelector(selector);
        if (existing) {
            callback(existing);
            return;
        }

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                observer.disconnect();
                callback(el);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function clickDropdownBtn(btn) {
        console.log('Quora-Show-Answers-By-Default: clicking dropdown button');
        btn.click();
    }

    function clickAnswerInMenu(menu) {
        setTimeout(() => {
            const answerBtn = Array.from(menu.querySelectorAll('*'))
                .find((el) => el.textContent.toLowerCase().includes('answer'));

            if (answerBtn) {
                console.log('Quora-Show-Answers-By-Default: clicking "answer" option');
                answerBtn.click();
            } else {
                console.log('Quora-Show-Answers-By-Default: "answer" option not found');
            }
        }, SECOND_CLICK_DELAY_MS);
    }
})();
