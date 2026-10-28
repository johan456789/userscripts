// ==UserScript==
// @name         Twitter Stable Scrollbar Gutter
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Always reserve space for the scrollbar to avoid layout shift while tweets load.
// @author       You
// @match        https://*.twitter.com/*
// @match        https://twitter.com/*
// @match        https://x.com/*
// @run-at       document-start
// @noframes
// @grant        GM_addStyle
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/twitter-stable-scrollbar-gutter.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/twitter-stable-scrollbar-gutter.js
// ==/UserScript==

const logger = Logger("[Twitter-Stable-Scrollbar-Gutter]");
logger("Userscript started.");

(function () {
  "use strict";

  // https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter
  // Twitter toggles overflow on html/body (e.g. when opening modals), which
  // adds/removes the scrollbar and shifts the layout. Reserve the gutter always.
  const css = "html { scrollbar-gutter: stable !important; }";

  if (typeof GM_addStyle === "function") {
    GM_addStyle(css);
  } else {
    const style = document.createElement("style");
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }
})();
