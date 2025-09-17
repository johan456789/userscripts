// ==UserScript==
// @name         Leetcode Tag List Always Sort by Frequency
// @namespace    https://greasyfork.org/en/users/688917
// @version      0.2.1
// @description  Sort LeetCode tag list by frequency in descending order by default.
// @author       You
// @match        https://leetcode.com/company/*
// @match        https://leetcode.com/tag/*
// @icon         https://www.google.com/s2/favicons?domain=leetcode.com
// @grant        none
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @license      MIT
// @run-at       document-end
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/lc-tag-list-sort-by-freq.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/lc-tag-list-sort-by-freq.js
// ==/UserScript==

(function () {
  "use strict";

  const logger = Logger("[LC-Tag-List-Sort]");
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
      logger.warn("Timeout reached, aborting");
      return;
    }

    // Using the provided selector to target the element
    var targetElement = document.querySelector(
      "#app > div > div.ant-row.content__xk8m > div > div.container__2dba > div > table > thead > tr > th.reactable-th-frequency.reactable-header-sortable.frequency__Hs3t"
    );
    logger("checking if frequency element exist");
    if (targetElement) {
      logger("Element found, clicking twice");
      targetElement.click();
      targetElement.click();
    } else {
      setTimeout(modifyFrequencyElement, 100); // Adjust the delay as necessary
    }
  }

  modifyFrequencyElement();
})();
