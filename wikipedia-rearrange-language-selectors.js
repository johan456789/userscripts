// ==UserScript==
// @name           Wikipedia rearrange other languages
// @namespace      none
// @include        http://*.wikipedia.org/wiki/*
// @include        https://*.wikipedia.org/wiki/*
// @description    Rearranges the "other languages" section of Wikipedia
// @version        1.1.1
// @updateURL    https://github.com/johan456789/userscripts/raw/main/wikipedia-rearrange-language-selectors.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/wikipedia-rearrange-language-selectors.js
// ==/UserScript==

// 2025-06-26 modified from https://greasyfork.org/en/scripts/10731-wikipedia-rearrange-other-languages

// set your languages here
const myLangs = ["en", "simple", "zh", "ja"];
// setting false will leave other languages in the list
const removeOthers = false;

const plang = window.document.querySelector("div#p-lang");
if (plang == null) return;
const langs = plang.querySelectorAll("div > ul > li");
let first = langs[0];
const ul = first.parentNode;

const found = [];
for (let i = 0; i < langs.length; i++) {
    const lncn = langs[i].className;
    const l1 = lncn.replace(/^.*interwiki-(\S+).*$/, "$1");

    const ln = myLangs.indexOf(l1);
    if (ln > -1) {
        found[ln] = langs[i];
    }
}

let foundcount = 0;
for (let i = found.length - 1; i >= 0; i--){
    if (found[i]) {
        ul.insertBefore(found[i], first);
        first = found[i];
        foundcount++;
    }
}

if (removeOthers) {
    if (foundcount == 0) {
        // remove "other languages" menu if empty
        plang.parentNode.removeChild(plang);
    } else {
        while(ul.children.length > foundcount) {
            ul.removeChild(ul.children[foundcount]);
        }
    }
}