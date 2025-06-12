// ==UserScript==
// @name         Quora-Show-Answers-By-Default
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  Show answers by default instead of 'all related' answers
// @match        https://www.quora.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @updateURL    https://github.com/johan456789/userscripts/raw/main/quora-show-answers-by-default.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/quora-show-answers-by-default.js
// ==/UserScript==


(function() {
    'use strict';
    console.log('running');

    const dropdownBtnSelector = '#mainContent > div.q-box button';
    const dropdownMenuSelector = '.q-box .puppeteer_test_popover_menu';

    waitForKeyElements(dropdownBtnSelector, click);
    waitForKeyElements(dropdownMenuSelector, callback);

    console.log('done');
    
    function callback(jNode) {
        // Find element containing "answer" text (case insensitive)
        const answerElement = jNode.find('*').filter(function() {
            return $(this).text().toLowerCase().includes('answer');
        }).first();
        
        if (answerElement.length) {
            console.log('Found answer element, clicking...');
            answerElement.click();
        } else {
            console.log('Answer element not found');
        }
    }
    
    function click(jNode) {
        jNode.click();
    }
})();
