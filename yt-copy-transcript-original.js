// ==UserScript==
// @name         YouTube Transcript Copy to Clipboard
// @description  Adds a button that copies the transcript directly to the clipboard
// @match        https://www.youtube.com/watch*
// @grant        GM_setClipboard
// @license      MIT
// @run-at       document-end
// @version      2.0
// @require      https://gist.github.com/johan456789/0493c123c1b9182cf546e5e49dbb8067/raw/gistfile1.txt
// ==/UserScript==

// 2024-03-25 v1.2 edited from https://greasyfork.org/en/scripts/468715-youtube-script-downloader-button
// TODO 1: move the button to a better place

// 2024-07-17 v1.3
// DONE: prefetch transcript. if no transcript show grayed out button, if yes transcript show normal button.
// TODO 1: use the same hover and click effect as native buttons
// TODO 2: use a better spacing between neighboring buttons

// 2024-08-08 v1.4
// DONE: fix "Trusted Type expected, but String received" by using a textNode instead of replacing innerHTML with a string

// 2024-12-09 v2.0
// DONE: fix: button not being added to the page at first load
// DONE: fix: transcript and button class not being updated after a page navigation
// DONE: refactor: remove redundant loops
// TODO 0: when left clicking the video from channel page, the button doesn't load
// TODO 1: make button not clickable when transcript is not available
// TODO 2: check if the button and its parent elements can be simplified

console.log("[YT-transcript] Userscript started.");
let transcriptCache = new Map();

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
            console.log(`[YT-transcript] Failed to prefetch transcript. Error: "${error}`);
        }
        return "";
    }

    function updateButtonAppearance(button, isAvailable) {
        if (!button) {
            console.error('[YT-transcript] Button is null/undefined');
        }
        button.classList.remove('transcript-available', 'transcript-unavailable');
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
        let query = "#analytics-button:not(.copy-panel)";
        const elements = document.querySelectorAll(query);

        if (elements.length == 0) {
            console.error("[YT-transcript] element not found");
        }
        const container = document.createElement("div");
        container.classList.add("copy-button-container");

        const button = document.createElement("div");
        button.classList.add("copy-button", "transcript-unavailable");  // set to unavailable by default

        const buttonText = document.createElement("span");
        buttonText.classList.add("copy-button-text");
        buttonText.textContent = "Transcript";
        button.appendChild(buttonText);

        const btnClickHandler = async () => {
            // copy transcript to clipboard
            const videoId = getVideoId();
            console.log(`[YT-transcript] Button clicked: getting transcript for ${videoId}`);
            if (!transcriptCache.has(videoId)) {
                console.log("[YT-transcript] Transcript not available");
                return;
            }
            const transcript = transcriptCache.get(videoId);
            try {
                GM_setClipboard(transcript);
                console.log("[YT-transcript] Transcript copied to clipboard using GM_setClipboard!");
            } catch (error) {
                console.error("[YT-transcript] Error copying transcript to clipboard using GM_setClipboard:", error);
            }
        }
        button.addEventListener("click", btnClickHandler);
        container.appendChild(button);

        const panel = elements[0];
        panel.classList.add("copy-panel");
        panel.insertBefore(container, panel.firstElementChild);

        console.log(`[YT-transcript] Transcript button created`);
        return button;
    }

    window.onload = () => {
        // Inject CSS
        const style = document.createElement("style");
        const cssTextNode = document.createTextNode(cssText); // Create a TextNode with the CSS content
        style.appendChild(cssTextNode); // Append the TextNode to the <style> element
        document.head.appendChild(style);

        // observe element load
        const observer = new MutationObserver(async (mutations, observer) => {
            const analyticsButton = document.querySelector("#analytics-button");
            if (analyticsButton) {
                observer.disconnect();
                const button = addTranscriptButton(analyticsButton);

                const pageRefreshHandler = async () => {
                    const videoId = getVideoId();
                    console.log(`[YT-transcript] updating transcript (in cache: ${transcriptCache.has(videoId)})`);
                    if (!transcriptCache.has(videoId)) {
                        const fullTranscript = await prefetchTranscript(videoId);
                        if (fullTranscript) {
                            transcriptCache.set(videoId, fullTranscript);
                        }
                    }
                    updateButtonAppearance(button, transcriptCache.has(videoId));
                    console.log(`[YT-transcript] finished updating transcript`);
                }
                await pageRefreshHandler();
                window.addEventListener("yt-navigate-finish", pageRefreshHandler);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    };
})();