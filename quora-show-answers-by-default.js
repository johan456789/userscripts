// ==UserScript==
// @name         Quora-Show-Answers-By-Default
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Show answers by default instead of 'all related' answers
// @match        https://www.quora.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// ==/UserScript==


(function() {
    'use strict';
    console.log('running');
    
    waitForKeyElements("#mainContent > div:nth-child(2) > div > div.q-inlineFlex.qu-alignItems--flex-end.DesktopPopoverMenu___StyledInlineFlex-sc-47js9m-0.hfwRBf > div > div > button > div", click);
    waitForKeyElements("#mainContent > div:nth-child(2) > div > div.q-inlineFlex.qu-alignItems--flex-end.DesktopPopoverMenu___StyledInlineFlex-sc-47js9m-0.hfwRBf > div > div.q-box.qu-zIndex--popover > div > div.q-box.qu-bg--raised.qu-borderRadius--small.qu-borderAll.qu-borderColor--gray.qu-overflow--hidden.qu-boxShadow--large > div > div > div:nth-child(2)", click);

    console.log('done');
    function click(jNode) {
        jNode.click();
    }
})();