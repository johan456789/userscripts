// ==UserScript==
// @name         Leetcode Tag List Always Sort by Frequency
// @namespace    https://greasyfork.org/en/users/688917
// @version      0.2
// @description  Sort LeetCode tag list by frequency in descending order by default.
// @author       You
// @match        https://leetcode.com/company/*
// @match        https://leetcode.com/tag/*
// @icon         https://www.google.com/s2/favicons?domain=leetcode.com
// @grant        none
// @license      MIT
// @run-at       document-end
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/lc-tag-list-sort-by-freq.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/lc-tag-list-sort-by-freq.js
// ==/UserScript==

(function() {
    'use strict';

    const MAX_TIMEOUT = 10000; // 10 seconds
    let startTime;

    function modifyFrequencyElement() {
        // Get current time on first run
        if (!startTime) {
            startTime = Date.now();
        }

        // Check elapsed time
        let elapsed = Date.now() - startTime;
        if (elapsed > MAX_TIMEOUT) {
            // console.log('Timeout reached, aborting');
            return;
        }

        // Using the provided selector to target the element
        var targetElement = document.querySelector('#app > div > div.ant-row.content__xk8m > div > div.container__2dba > div > table > thead > tr > th.reactable-th-frequency.reactable-header-sortable.frequency__Hs3t');
        // console.log('checking if frequency element exist');
        if (targetElement) {
            // console.log('modify');
            targetElement.click();
            targetElement.click();
        } else {
            setTimeout(modifyFrequencyElement, 100); // Adjust the delay as necessary
        }
    }

    modifyFrequencyElement();
})();
