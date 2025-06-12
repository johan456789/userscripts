// ==UserScript==
// @name        wikipedia_desktop_redirect
// @namespace   https://jspenguin.org/monkey
// @description Redirect mobile wikipedia to desktop version
// @run-at      document-start
// @include     http://*.m.wikipedia.org/*
// @include     https://*.m.wikipedia.org/*
// @version     1.2
// @grant       none
// ==/UserScript==

var m = /^(https?:\/\/.*)\.m(\.wikipedia\.org\/.*)/.exec(location.href);
if (m) location.href = m[1] + m[2];
