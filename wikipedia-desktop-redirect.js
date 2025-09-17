// ==UserScript==
// @name        Wikipedia-Desktop-Redirect
// @description Redirect mobile wikipedia to desktop version
// @run-at      document-start
// @include     http://*.m.wikipedia.org/*
// @include     https://*.m.wikipedia.org/*
// @version     1.0.1
// @grant       none
// @updateURL   https://github.com/johan456789/userscripts/raw/main/wikipedia-desktop-redirect.js
// @downloadURL https://github.com/johan456789/userscripts/raw/main/wikipedia-desktop-redirect.js
// ==/UserScript==

if (location.href.includes(".m.wikipedia.org")) {
  location.replace(location.href.replace(".m.wikipedia.org", ".wikipedia.org"));
}
