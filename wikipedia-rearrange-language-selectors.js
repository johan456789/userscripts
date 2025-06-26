// ==UserScript==
// @name           Wikipedia rearrange other languages
// @namespace      none
// @include        http://*.wikipedia.org/wiki/*
// @include        https://*.wikipedia.org/wiki/*
// @include        https://zh.wikipedia.org/*/*
// @description    Rearranges the "other languages" section of Wikipedia
// @version        1.1.5
// @updateURL    https://github.com/johan456789/userscripts/raw/main/wikipedia-rearrange-language-selectors.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/wikipedia-rearrange-language-selectors.js
// ==/UserScript==

// 2025-06-26 modified from https://greasyfork.org/en/scripts/10731-wikipedia-rearrange-other-languages

////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Configuration
////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Set your preferred languages here in order of priority
 * @type {string[]}
 */
const myLangs = ["en", "simple", "zh", "ja", "es", "pt", "fr", "ar", "ru"];

/**
 * Setting false will leave other languages in the list
 * @type {boolean}
 */
const removeOthers = true;

////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Locate the sidebar that contains the language links (id="p-lang").
const pLang = window.document.querySelector("div#p-lang");
if (pLang == null) return; // exit early
const langs = pLang.querySelectorAll("div > ul > li");

// Remember the first <li> so we can easily insert other nodes before it later.
let first = langs[0];
const ul = first.parentNode;

// Build a sparse array that will hold the DOM nodes for each preferred language,
// indexed by their priority in the myLangs list.
const found = [];
for (let i = 0; i < langs.length; i++) {
    const lncn = langs[i].className;
    const l1 = lncn.replace(/^.*interwiki-(\S+).*$/, "$1");

    const ln = myLangs.indexOf(l1);
    if (ln > -1) {
        found[ln] = langs[i];
    }
}

// Traverse the 'found' array backwards so languages earlier in 'myLangs'
// end up closest to the top of the list.
let foundCount = 0;
for (let i = found.length - 1; i >= 0; i--){
    if (found[i]) {
        ul.insertBefore(found[i], first);
        first = found[i];
        foundCount++;
    }
}

// If 'removeOthers' is true, prune any languages that weren't in 'myLangs';
// otherwise, leave them in place.
if (removeOthers) {
    if (foundCount == 0) {
        // remove "other languages" menu if empty
        pLang.parentNode.removeChild(pLang);
    } else {
        while(ul.children.length > foundCount) {
            ul.removeChild(ul.children[foundCount]);
        }
    }
}
