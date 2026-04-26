// ==UserScript==
// @name                    DeepWiki Search Tab Title
// @namespace               http://tampermonkey.net/
// @version                 0.1.0
// @description             Change DeepWiki search page tab title to "{repo_name} | {question}"
// @match                   https://deepwiki.com/search/*
// @require                 https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @require                 https://github.com/johan456789/userscripts/raw/main/utils/wait-for-element.js
// @downloadURL             https://github.com/johan456789/userscripts/raw/refs/heads/main/deepwiki-search-tab-title.js
// @updateURL               https://github.com/johan456789/userscripts/raw/refs/heads/main/deepwiki-search-tab-title.js
// ==/UserScript==

(function () {
    "use strict";

    const logger = Logger("[DeepWiki-Search-Title]");

    const REPO_LINK_SELECTOR = '#\\31  > div.flex.max-h-fit.min-w-0.flex-1.flex-shrink-0.flex-col.xl\\:\\[flex-grow\\:2\\] > div > div.flex.flex-col > a';
    const QUESTION_CONTAINER_SELECTOR = '#\\31  > div.flex.max-h-fit.min-w-0.flex-1.flex-shrink-0.flex-col.xl\\:\\[flex-grow\\:2\\] > div > div.flex.flex-col > div';

    function getRepoName() {
        const repoLink = document.querySelector(REPO_LINK_SELECTOR);
        if (!repoLink) return null;

        const text = repoLink.textContent?.trim();
        if (!text) return null;

        const parts = text.split('/');
        if (parts.length >= 2) {
            return parts[parts.length - 1];
        }
        return text;
    }

    function getQuestion() {
        const container = document.querySelector(QUESTION_CONTAINER_SELECTOR);
        if (!container) return null;

        const questionSpan = container.querySelector('span');
        if (!questionSpan) return null;

        const clone = questionSpan.cloneNode(true);
        const button = clone.querySelector('button');
        if (button) button.remove();

        return clone.textContent?.trim() || null;
    }

    function updateTitle() {
        const repoName = getRepoName();
        const question = getQuestion();

        if (repoName && question) {
            const newTitle = `${repoName} | ${question}`;
            if (document.title !== newTitle) {
                document.title = newTitle;
                logger(`Updated title to: ${newTitle}`);
            }
        }
    }

    logger("Script started.");

    waitForElement(REPO_LINK_SELECTOR, () => {
        waitForElement(QUESTION_CONTAINER_SELECTOR, () => {
            updateTitle();

            const observer = new MutationObserver(() => {
                updateTitle();
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
        });
    });
})();
