// ==UserScript==
// @name         YouTube Transcript Copy to Clipboard
// @description  Adds a button that copies the transcript directly to the clipboard
// @match        https://www.youtube.com/*
// @grant        GM_setClipboard
// @license      MIT
// @run-at       document-end
// @noframes
// @version      2.3.1
// @require      https://gist.github.com/johan456789/89c50735911afb7251c3a6a3d06f5657/raw/gistfile1.txt
// @updateURL    https://github.com/johan456789/userscripts/raw/main/yt-copy-transcripts.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/yt-copy-transcripts.js
// ==/UserScript==

function logger(message) {
    console.log("[YT-transcript] " + message);
}

logger("Userscript started.");
let transcriptCache = new Map();

const ytBtnClassList = `yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono \
yt-spec-button-shape-next--size-m yt-spec-button-shape-next--enable-backdrop-filter-experiment`.split(" ").filter(Boolean);

const cssText = `
#transcript-button button.yt-spec-button-shape-next[disabled] {
    opacity: 0.5;
    cursor: not-allowed;
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
        button.toggleAttribute('disabled', !isAvailable);
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

        const button = document.createElement("button");
        button.classList.add(...ytBtnClassList);
        button.disabled = true;

        const buttonTextDiv = document.createElement("div");
        buttonTextDiv.classList.add("yt-spec-button-shape-next__button-text-content");
        buttonTextDiv.textContent = "T";
        button.appendChild(buttonTextDiv);

        const touchFeedback = document.createElement("yt-touch-feedback-shape");
        touchFeedback.style.borderRadius = "inherit";
        const feedbackContainer = document.createElement("div");
        feedbackContainer.className = "yt-spec-touch-feedback-shape yt-spec-touch-feedback-shape--touch-response";
        const stroke = document.createElement("div");
        stroke.className = "yt-spec-touch-feedback-shape__stroke";
        const fill = document.createElement("div");
        fill.className = "yt-spec-touch-feedback-shape__fill";
        feedbackContainer.appendChild(stroke);
        feedbackContainer.appendChild(fill);
        touchFeedback.appendChild(feedbackContainer);
        button.appendChild(touchFeedback);

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
            logger("Observer callback fired");
            const owner = document.querySelector("#owner");
            if (owner) {
                observer.disconnect();
                const button = addTranscriptButton();

                const pageRefreshHandler = async () => {
                    const videoId = getVideoId();
                    logger(`updating transcript (in cache: ${transcriptCache.has(videoId)})`);
                    let fullTranscript;
                    if (!transcriptCache.has(videoId)) {
                        fullTranscript = await prefetchTranscript(videoId);
                        logger("pageRefreshHandler: fullTranscript", fullTranscript);
                        if (fullTranscript) {
                            transcriptCache.set(videoId, fullTranscript);
                        }
                    } else {
                        logger("pageRefreshHandler: transcript already cached");
                    }
                    updateButtonAppearance(button, transcriptCache.has(videoId));
                    logger("pageRefreshHandler: finished updating transcript");
                }
                await pageRefreshHandler();
                window.addEventListener("yt-navigate-finish", async () => {
                    logger("[YT-transcript] yt-navigate-finish detected, updating transcript");
                    await pageRefreshHandler();
                });
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
