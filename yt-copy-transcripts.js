// ==UserScript==
// @name         YouTube Transcript Copy to Clipboard
// @description  Adds a button that copies the transcript directly to the clipboard
// @match        https://www.youtube.com/*
// @grant        GM_setClipboard
// @license      MIT
// @run-at       document-end
// @noframes
// @version      2.3.2
// @require      https://gist.github.com/johan456789/89c50735911afb7251c3a6a3d06f5657/raw/gistfile1.txt
// @updateURL    https://github.com/johan456789/userscripts/raw/main/yt-copy-transcripts.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/yt-copy-transcripts.js
// ==/UserScript==

// ---- Constants (reused across multiple places) ----
const IDS = { transcriptButton: "transcript-button" };
const SELECTORS = { topButtons: "#menu #top-level-buttons-computed" };
const CLASSES = { buttonTextContent: "yt-spec-button-shape-next__button-text-content" };
const TAGS = { wrapper: "yt-button-view-model" };
const ICONS = { maskId: "copy-mask" };

function logger(message) {
    console.log("[YT-transcript] " + message);
}

logger("Userscript started.");
let transcriptCache = new Map();

const ytBtnClassList = `yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono \
yt-spec-button-shape-next--size-m yt-spec-button-shape-next--enable-backdrop-filter-experiment`.split(" ").filter(Boolean);

const cssText = `
#${IDS.transcriptButton} button.yt-spec-button-shape-next[disabled] {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Center icon within YouTube button text container */
#${IDS.transcriptButton} .yt-spec-button-shape-next__button-text-content {
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

#${IDS.transcriptButton} .yt-spec-button-shape-next__button-text-content svg {
    display: block;
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

    function updateButtonAppearance(button, availability) {
        if (!button) {
            console.error('[YT-transcript] Button is null/undefined');
            return;
        }
        const buttonTextDiv = button.querySelector(`.${CLASSES.buttonTextContent}`);
        if (!buttonTextDiv) {
            console.error('[YT-transcript] Button text container not found');
            return;
        }

        // availability: true (available), false (unavailable), null (loading)
        if (availability === null) {
            button.disabled = true;
            buttonTextDiv.textContent = "...";
            return;
        }

        const isAvailable = Boolean(availability);
        button.toggleAttribute('disabled', !isAvailable);
        buttonTextDiv.replaceChildren(createCopySvgIcon());
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

    function createCopySvgIcon(variant = "lines") {
        const svgns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgns, "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("width", "20");
        svg.setAttribute("height", "20");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");

        // Layout constants
        const frontX = 5, frontY = 7, frontW = 12, frontH = 14, radius = 2;
        const backX = 9, backY = 3, backW = 12, backH = 14;

        // Mask so the back card does not show through the front card
        const defs = document.createElementNS(svgns, "defs");
        const mask = document.createElementNS(svgns, "mask");
        mask.setAttribute("id", ICONS.maskId);
        mask.setAttribute("maskUnits", "userSpaceOnUse");
        const maskBg = document.createElementNS(svgns, "rect");
        maskBg.setAttribute("x", "0");
        maskBg.setAttribute("y", "0");
        maskBg.setAttribute("width", "24");
        maskBg.setAttribute("height", "24");
        maskBg.setAttribute("fill", "white");
        const maskCut = document.createElementNS(svgns, "rect");
        // Slightly expand cutout to cover the stroke of the front card
        maskCut.setAttribute("x", String(frontX - 2));
        maskCut.setAttribute("y", String(frontY - 2));
        maskCut.setAttribute("width", String(frontW + 4));
        maskCut.setAttribute("height", String(frontH + 4));
        maskCut.setAttribute("rx", String(radius + 1));
        maskCut.setAttribute("fill", "black");
        mask.appendChild(maskBg);
        mask.appendChild(maskCut);
        defs.appendChild(mask);
        svg.appendChild(defs);

        const back = document.createElementNS(svgns, "rect");
        back.setAttribute("x", String(backX));
        back.setAttribute("y", String(backY));
        back.setAttribute("width", String(backW));
        back.setAttribute("height", String(backH));
        back.setAttribute("rx", String(radius));
        back.setAttribute("fill", "none");
        back.setAttribute("stroke", "currentColor");
        back.setAttribute("stroke-width", "2");
        back.setAttribute("opacity", "0.6");
        back.setAttribute("mask", `url(#${ICONS.maskId})`);

        const front = document.createElementNS(svgns, "rect");
        front.setAttribute("x", String(frontX));
        front.setAttribute("y", String(frontY));
        front.setAttribute("width", String(frontW));
        front.setAttribute("height", String(frontH));
        front.setAttribute("rx", String(radius));
        front.setAttribute("fill", "none");
        front.setAttribute("stroke", "currentColor");
        front.setAttribute("stroke-width", "2");

        svg.appendChild(back);
        svg.appendChild(front);

        if (variant === "check") {
            const check = document.createElementNS(svgns, "path");
            const pad = 3;
            const p1x = frontX + pad + 0.5;
            const p1y = frontY + pad + 4;
            const p2x = frontX + pad + 3;
            const p2y = frontY + pad + 6.5;
            const p3x = frontX + frontW - pad - 0.5;
            const p3y = frontY + pad + 1.5;
            check.setAttribute("d", `M ${p1x} ${p1y} L ${p2x} ${p2y} L ${p3x} ${p3y}`);
            check.setAttribute("fill", "none");
            check.setAttribute("stroke", "currentColor");
            check.setAttribute("stroke-width", "2");
            check.setAttribute("stroke-linecap", "round");
            check.setAttribute("stroke-linejoin", "round");
            svg.appendChild(check);
        } else {
            const line1 = document.createElementNS(svgns, "line");
            line1.setAttribute("x1", String(frontX + 3));
            line1.setAttribute("y1", String(frontY + 4));
            line1.setAttribute("x2", String(frontX + 9));
            line1.setAttribute("y2", String(frontY + 4));
            line1.setAttribute("stroke", "currentColor");
            line1.setAttribute("stroke-width", "2");
            line1.setAttribute("stroke-linecap", "round");

            const line2 = document.createElementNS(svgns, "line");
            line2.setAttribute("x1", String(frontX + 3));
            line2.setAttribute("y1", String(frontY + 7));
            line2.setAttribute("x2", String(frontX + 7));
            line2.setAttribute("y2", String(frontY + 7));
            line2.setAttribute("stroke", "currentColor");
            line2.setAttribute("stroke-width", "2");
            line2.setAttribute("stroke-linecap", "round");
            svg.appendChild(line1);
            svg.appendChild(line2);
        }
        return svg;
    }

    function createCopySuccessSvgIcon() {
        return createCopySvgIcon("check");
    }

    function addTranscriptButton() {
        const topButtons = document.querySelector(SELECTORS.topButtons);
        if (!topButtons) {
            logger(SELECTORS.topButtons + " not found");
            return null;
        }

        const outerContainer = document.createElement("div");
        outerContainer.id = IDS.transcriptButton;
        outerContainer.classList.add("style-scope", "ytd-video-owner-renderer", "copy-panel");

        const container = document.createElement("div");
        container.classList.add("copy-button-container");

        const button = document.createElement("button");
        button.classList.add(...ytBtnClassList);
        button.disabled = true;

        const buttonTextDiv = document.createElement("div");
        buttonTextDiv.classList.add(CLASSES.buttonTextContent);
        button.appendChild(buttonTextDiv);
        // initialize as loading state
        updateButtonAppearance(button, null);

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
                // swap icon to success state and briefly show it
                buttonTextDiv.replaceChildren(createCopySuccessSvgIcon());
                setTimeout(() => {
                    buttonTextDiv.replaceChildren(createCopySvgIcon());
                }, 1500);
            } catch (error) {
                console.error("[YT-transcript] Error copying transcript to clipboard using GM_setClipboard:", error);
            }
        };
        button.addEventListener("click", btnClickHandler);
        container.appendChild(button);
        outerContainer.appendChild(container);

        // Outer wrapper element per YouTube's structure
        const wrapper = document.createElement(TAGS.wrapper);
        wrapper.classList.add("ytd-menu-renderer");
        wrapper.appendChild(outerContainer);

        // Insert after the last yt-button-view-model within #top-level-buttons-computed
        let insertAfter = null;
        for (let el = topButtons.lastElementChild; el; el = el.previousElementSibling) {
            if (el.tagName && el.tagName.toLowerCase() === TAGS.wrapper) {
                insertAfter = el;
                break;
            }
        }
        const referenceNode = insertAfter ? insertAfter.nextSibling : null;
        topButtons.insertBefore(wrapper, referenceNode);

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
            const topButtons = document.querySelector(SELECTORS.topButtons);
            const alreadyExists = document.getElementById(IDS.transcriptButton);
            if (topButtons && !alreadyExists) {
                observer.disconnect();
                const button = addTranscriptButton();

                const pageRefreshHandler = async () => {
                    const videoId = getVideoId();
                    logger(`updating transcript (in cache: ${transcriptCache.has(videoId)})`);
                    // Set loading state while checking availability
                    updateButtonAppearance(button, null);
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
                    const isAvailable = transcriptCache.has(videoId);
                    updateButtonAppearance(button, isAvailable);
                    logger("pageRefreshHandler: finished updating transcript");
                }
                await pageRefreshHandler();
                window.addEventListener("yt-navigate-finish", async () => {
                    logger("yt-navigate-finish detected, updating transcript");
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
