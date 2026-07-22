// ==UserScript==
// @name           F-Droid move links to top
// @namespace      none
// @description    Moves the package links section above the description and version list on F-Droid app pages.
// @version        1.0.0
// @match          https://f-droid.org/*
// @icon           https://f-droid.org/assets/ic_repo_app.png
// @run-at         document-end
// @require        https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @require        https://github.com/johan456789/userscripts/raw/main/utils/wait-for-element.js
// @updateURL      https://github.com/johan456789/userscripts/raw/main/fdroid-move-links-to-top.js
// @downloadURL    https://github.com/johan456789/userscripts/raw/main/fdroid-move-links-to-top.js
// ==/UserScript==

(function () {
  "use strict";

  const logger = Logger("[F-Droid-Move-Links-To-Top]");

  const ARTICLE_SELECTOR = "body > div > div > div.article-area > article";
  const HEADER_SELECTOR = "body > div > div > div.article-area > article > header";
  const LINKS_SELECTOR = "#links";

  waitForElement(HEADER_SELECTOR, moveLinksBelowHeader);

  function moveLinksBelowHeader(header) {
    const article = header.closest(ARTICLE_SELECTOR);
    if (!article) {
      logger.warn("Article container not found.");
      return;
    }

    const links = article.querySelector(LINKS_SELECTOR);
    if (!links) {
      logger.warn("Links section not found.");
      return;
    }

    if (header.nextElementSibling === links) {
      return;
    }

    header.insertAdjacentElement("afterend", links);
    logger("Moved links section below package header.");
  }
})();
