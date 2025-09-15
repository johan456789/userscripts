// ==UserScript==
// @name         Google Skip Redirect Warning
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  Skip Google's redirection notice (google.com/url?q=*) and go directly to the target link
// @author       You
// @match        https://www.google.com/url*
// @run-at       document-start
// @grant        none
// @license      MIT
// @updateURL    https://github.com/johan456789/userscripts/raw/main/google-skip-lucky-redirect-warning.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/google-skip-lucky-redirect-warning.js
// ==/UserScript==

//function logger(message) {
//    console.log("[Google-Skip-Redirect] " + message);
//}

(() => {
  const u = new URL(window.location.href);
  const q = u.searchParams.get("q");
  window.location.replace(q);
  //logger('redirected');
})();
