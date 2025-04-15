// ==UserScript==
// @name         YouTube Transcript Copy to Clipboard
// @description  Adds a button that copies the transcript directly to the clipboard
// @match        https://www.youtube.com/*
// @grant        GM_setClipboard
// @license      MIT
// @run-at       document-end
// @version      2.1
// @require      https://gist.github.com/johan456789/0493c123c1b9182cf546e5e49dbb8067/raw/gistfile1.txt
// ==/UserScript==

// 2024-03-25 v1.2 edited from https://greasyfork.org/en/scripts/468715-youtube-script-downloader-button
// TODO 1: move the button to a better place

// 2024-07-17 v1.3
// DONE: prefetch transcript. if no transcript show grayed out button, if yes transcript show normal button.
// TODO 1: use a better spacing between neighboring buttons

// 2024-08-08 v1.4
// DONE: fix "Trusted Type expected, but String received" by using a textNode instead of replacing innerHTML with a string

// 2024-12-09 v2.0
// DONE: fix: button not being added to the page at first load
// DONE: fix: transcript and button class not being updated after a page navigation
// DONE: refactor: remove redundant loops
// TODO 1: check if the button and its parent elements can be simplified

// 2025-03-24 v2.1
// DONE: make button not clickable when transcript is not available
// DONE: make button text not selectable
// DONE: create a logger function
// DONE: fix: when left clicking the video from channel page, the button doesn't load
// DONE: use the same hover and click effect as native buttons
// TODO 0: observer doesn't work at all
// TODO 1: fix: styling when transcript is unavailable is off because of conflict with yt official css rules
// TODO 2: the css rule when the button is clicked is still off. dunno why

function logger(message) {
    console.log("[YT-transcript] " + message);
}

logger("Userscript started.");
let transcriptCache = new Map();

const ytBtnClassList = `yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono \
yt-spec-button-shape-next--size-m yt-spec-button-shape-next--icon-leading-trailing`.split(" ").filter(Boolean);

const cssText = `
    .copy-button {
        border-radius: 20px;
        display: flex;
        flex-direction: row;
        cursor: pointer;
        background-color: var(--yt-spec-10-percent-layer);
        padding: var(--yt-button-padding);
        margin: auto var(--ytd-subscribe-button-margin, 12px);
        white-space: nowrap;
        font-size: var(--ytd-tab-system-font-size, 1.4rem);
        font-weight: var(--ytd-tab-system-font-weight, 500);
        letter-spacing: var(--ytd-tab-system-letter-spacing, .007px);
        user-select: none; /* Prevent text selection */
    }
    .copy-button-text {
        --yt-formatted-string-deemphasize_-_display: initial;
        --yt-formatted-string-deemphasize_-_margin-left: 4px;
    }
    .copy-button-container {
        display: flex;
        flex-direction: row;
    }
    .transcript-available {
        color: var(--yt-spec-text-primary);
    }
    .transcript-unavailable {
        color: var(--yt-spec-text-secondary);
        pointer-events: none;
    }
`;

(function () {
    'use strict';

    async function prefetchTranscript() {
        try {
            const videoId = getVideoId();
            const transcript = await YoutubeTranscript.fetchTranscript(videoId);
            if (transcript) {
                const fullTranscript = transcript.map(item => decodeHtmlEntities(item.text)).join(' ');
                return fullTranscript;
            }
        } catch (error) {
            logger(`Failed to prefetch transcript. Error: "${error}`);
        }
        return "";
    }

    function updateButtonAppearance(button, isAvailable) {
        if (!button) {
            console.error('[YT-transcript] Button is null/undefined');
        }
        button.classList.remove('transcript-available', 'transcript-unavailable');
        // if (!isAvailable) {
        //     button.classList.remove(...ytBtnClassList);
        // }
        button.classList.add(isAvailable ? 'transcript-available' : 'transcript-unavailable');
    }

    function decodeHtmlEntities(str) {
        const entities = {
            '&quot;': '"',
            '&#39;': "'",
            '&lt;': '<',
            '&gt;': '>',
            '"': '"',
            '\'': "'",
            '<': '<',
            '>': '>',
            '&amp;': '&',
        };

        // First, replace &amp; with & to handle nested entities
        str = str.replace(/&amp;/g, '&');

        // Then replace all other entities
        return str.replace(/&(?:#39|quot|lt|gt);|[<>'"]/g, match => entities[match] || match);
    }

    function getVideoId() {
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const videoId = urlParams.get('v');
        return videoId;
    }

    function addTranscriptButton() {
        let query = "#owner:not(.copy-panel)";
        const owner = document.querySelector(query);

        // if (elements.length == 0) {
        //     console.error("[YT-transcript] element not found");
        // }
        const outerContainer = document.createElement("div");
        outerContainer.id = "transcript-button";
        outerContainer.classList.add("style-scope", "ytd-video-owner-renderer", "copy-panel");

        const container = document.createElement("div");
        container.classList.add("copy-button-container");

        const button = document.createElement("div");
        button.classList.add("copy-button", "transcript-unavailable");  // set to unavailable by default
        // button.classList.add(...ytBtnClassList); // use YT default styles

        const buttonText = document.createElement("span");
        buttonText.classList.add("copy-button-text");
        buttonText.textContent = "T";
        buttonText.title = "Copy Transcript";
        button.appendChild(buttonText);

        const btnClickHandler = async () => {
            // copy transcript to clipboard
            const videoId = getVideoId();
            logger(`Button clicked: getting transcript for ${videoId}`);
            if (!transcriptCache.has(videoId)) {
                logger("Transcript not available");
                return;
            }
            const transcript = transcriptCache.get(videoId);
            try {
                GM_setClipboard(transcript);
                logger("Transcript copied to clipboard using GM_setClipboard!");
            } catch (error) {
                console.error("[YT-transcript] Error copying transcript to clipboard using GM_setClipboard:", error);
            }
        }
        button.addEventListener("click", btnClickHandler);
        container.appendChild(button);
        outerContainer.appendChild(container);

        owner.classList.add("copy-panel");
        owner.insertBefore(outerContainer, owner.lastElementChild.nextElementSibling); // most likely after the subscribe button

        logger(`Transcript button created`);
        return button;
    }

    function watchPageHandler() {
        if (!window.location.href.includes('/watch')) {
            logger(`not including /watch in url: ${window.location.href}`);
            return;
        }
        logger("running watchPageHandler");


        // observe element load
        const observer = new MutationObserver(async (mutations, observer) => {
            const owner = document.querySelector("#owner");
            if (owner) {
                observer.disconnect();
                const button = addTranscriptButton();

                const pageRefreshHandler = async () => {
                    const videoId = getVideoId();
                    logger(`updating transcript (in cache: ${transcriptCache.has(videoId)})`);
                    if (!transcriptCache.has(videoId)) {
                        const fullTranscript = await prefetchTranscript(videoId);
                        if (fullTranscript) {
                            transcriptCache.set(videoId, fullTranscript);
                        }
                    }
                    updateButtonAppearance(button, transcriptCache.has(videoId));
                    logger(`finished updating transcript`);
                }
                await pageRefreshHandler();
                // window.addEventListener("yt-navigate-finish", pageRefreshHandler);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function init() {
        // Inject CSS
        const style = document.createElement("style");
        const cssTextNode = document.createTextNode(cssText); // Create a TextNode with the CSS content
        style.appendChild(cssTextNode); // Append the TextNode to the <style> element
        document.head.appendChild(style);


        // Initial run
        watchPageHandler();

        // Monitor URL changes
        let lastUrl = window.location.href;
        setInterval(() => {
            // logger(`periodic check: href: ${window.location.href}, lastUrl: ${lastUrl}`);
            if (window.location.href !== lastUrl) { // url changed
                logger('URL changed');
                lastUrl = window.location.href;

                watchPageHandler();
            }
        }, 100); // check periodically
    }

    init();
})();