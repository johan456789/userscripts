// ==UserScript==
// @name                    DeepWiki Search Tab Title
// @namespace               http://tampermonkey.net/
// @version                 0.1.1
// @description             Change DeepWiki tab title to "{repo_name} | {question}"
// @match                   https://deepwiki.com/*
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
    const DEEPWIKI_ROOT_PATHS = new Set(["", "search"]);
    let lastQuestion = null;

    function getRepoNameFromUrl() {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (pathParts.length < 2 || DEEPWIKI_ROOT_PATHS.has(pathParts[0])) {
            return null;
        }

        return decodeURIComponent(pathParts[1]);
    }

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

    function getQuestionFromSearchInput() {
        const searchInputs = document.querySelectorAll('input[type="search"], textarea, input[name="q"]');
        for (const searchInput of searchInputs) {
            const question = searchInput.value?.trim();
            if (question) {
                lastQuestion = question;
                return question;
            }
        }

        return lastQuestion;
    }

    function getQuestion() {
        const container = document.querySelector(QUESTION_CONTAINER_SELECTOR);
        if (!container) return getQuestionFromSearchInput();

        const questionSpan = container.querySelector('span');
        if (!questionSpan) return getQuestionFromSearchInput();

        const clone = questionSpan.cloneNode(true);
        const button = clone.querySelector('button');
        if (button) button.remove();

        return clone.textContent?.trim() || getQuestionFromSearchInput();
    }

    function rememberQuestionFromEvent(event) {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
            return;
        }

        const question = target.value?.trim();
        if (question) {
            lastQuestion = question;
        }
    }

    function updateTitle() {
        const repoName = getRepoName() || getRepoNameFromUrl();
        const question = getQuestion();

        if (repoName && question) {
            const newTitle = `${repoName} | ${question}`;
            if (document.title !== newTitle) {
                document.title = newTitle;
                logger(`Updated title to: ${newTitle}`);
            }
        }
    }

    function observeTitleTargets() {
        updateTitle();

        const observer = new MutationObserver(() => {
            updateTitle();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    function updateTitleAfterNavigation() {
        window.setTimeout(updateTitle, 0);
        window.setTimeout(updateTitle, 250);
        window.setTimeout(updateTitle, 1000);
    }

    function wrapHistoryMethod(methodName) {
        const original = history[methodName];
        history[methodName] = function (...args) {
            const result = original.apply(this, args);
            updateTitleAfterNavigation();
            return result;
        };
    }

    logger("Script started.");

    document.addEventListener("input", rememberQuestionFromEvent, true);
    wrapHistoryMethod("pushState");
    wrapHistoryMethod("replaceState");
    window.addEventListener("popstate", updateTitleAfterNavigation);

    if (document.body) {
        observeTitleTargets();
    } else {
        waitForElement("body", observeTitleTargets);
    }
})();
