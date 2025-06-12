// ==UserScript==
// @name         Auto Focus on TextBox in Google Search AI Mode (udm=50)
// @namespace    https://greasyfork.org/en/users/688917
// @version      1.1
// @description  Automatically focuses on the textarea when the page loads.
// @author       You
// @match        https://www.google.com/search?udm=50*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// @run-at       document-end
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/531522/Auto%20Focus%20on%20TextBox%20in%20Google%20Search%20AI%20Mode%20%28udm%3D50%29.user.js
// @updateURL https://update.greasyfork.org/scripts/531522/Auto%20Focus%20on%20TextBox%20in%20Google%20Search%20AI%20Mode%20%28udm%3D50%29.meta.js
// ==/UserScript==

(function() {
    'use strict';

    const textAreaSelector = '#cnt > div.QGG6Id.YNk70c.YzCcne > div:nth-child(2) > section > div > div > div > div.WzWwpc > div.y4VEUd > div > div.AgWCw > div.esoFne > div > textarea';
    const textarea = document.querySelector(textAreaSelector);

    function focusTextarea() {
        if (textarea) {
            textarea.focus();
        }
    }

    // Run immediately
    focusTextarea();

    // Also try again if elements are loaded dynamically
    new MutationObserver(focusTextarea).observe(document.body, { childList: true, subtree: true });

    // Detect user typing and auto-focus the textarea
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey || event.metaKey) {
            return; // Ignore shortcuts like Ctrl+C, Ctrl+V, Cmd+C, etc.
        }
        if (document.activeElement !== textarea) {
            focusTextarea();
        }
    });
})();
