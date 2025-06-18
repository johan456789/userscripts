// ==UserScript==
// @name         Quora-Show-Answers-By-Default
// @namespace    http://tampermonkey.net/
// @description  Show direct (instead of related) answers by default on Quora.
// @version      0.4.2
// @match        https://www.quora.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @require      https://github.com/johan456789/userscripts/raw/main/utils/wait-for-element.js
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
