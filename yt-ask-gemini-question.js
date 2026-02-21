// ==UserScript==
// @name         YouTube Ask Gemini Button
// @description  Adds an Ask Gemini button next to YouTube action buttons and clicks the Gemini CTA when available
// @match        https://www.youtube.com/*
// @license      MIT
// @run-at       document-end
// @noframes
// @version      1.0.1
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/yt-ask-gemini-question.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/yt-ask-gemini-question.js
// ==/UserScript==

const IDS = { askGeminiButton: "ask-gemini-button" };
const SELECTORS = {
  topButtons: "#top-row #actions #menu #top-level-buttons-computed",
  geminiTrigger:
    "#items > yt-video-description-youchat-section-view-model > div.ytVideoDescriptionYouchatSectionViewModelPrimaryButton > button-view-model > button",
  panelCloseTrigger:
    "#visibility-button > ytd-button-renderer > yt-button-shape > button",
};
const TAGS = { wrapper: "yt-button-view-model" };

const logger = Logger("[YT-ask-gemini-question]");
logger("Userscript started.");
let askPanelVisible = false;

const ytBtnClassList =
  "yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m yt-spec-button-shape-next--enable-backdrop-filter-experiment"
    .split(" ")
    .filter(Boolean);

const cssText = `
#${IDS.askGeminiButton} button.yt-spec-button-shape-next[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}
`;

(function () {
  "use strict";

  function isWatchPage() {
    return window.location.pathname === "/watch";
  }

  function getGeminiTargetButton() {
    return document.querySelector(SELECTORS.geminiTrigger);
  }

  function getPanelCloseButton() {
    return document.querySelector(SELECTORS.panelCloseTrigger);
  }

  function setAskPanelVisible(nextState) {
    askPanelVisible = nextState;
    const askButton = document.querySelector(`#${IDS.askGeminiButton} button`);
    if (askButton) {
      askButton.dataset.askPanelVisible = String(askPanelVisible);
    }
  }

  function updateAskGeminiButtonState() {
    const askButton = document.querySelector(`#${IDS.askGeminiButton} button`);
    if (!askButton) {
      return;
    }

    const currentTarget = askPanelVisible
      ? getPanelCloseButton()
      : getGeminiTargetButton();
    askButton.toggleAttribute("disabled", !currentTarget);
  }

  function createAskGeminiIcon() {
    const icon = document.createElement("div");
    icon.setAttribute("aria-hidden", "true");
    icon.className = "yt-spec-button-shape-next__icon";

    const wrapperHost = document.createElement("span");
    wrapperHost.className = "ytIconWrapperHost";
    wrapperHost.style.width = "24px";
    wrapperHost.style.height = "24px";

    const iconShapeHost = document.createElement("span");
    iconShapeHost.className = "yt-icon-shape ytSpecIconShapeHost";

    const svgHost = document.createElement("div");
    svgHost.style.width = "100%";
    svgHost.style.height = "100%";
    svgHost.style.display = "block";
    svgHost.style.fill = "currentcolor";

    const svgns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgns, "svg");
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("width", "24");
    svg.setAttribute("height", "24");
    svg.setAttribute("viewBox", "0 -960 960 960");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("aria-hidden", "true");
    svg.style.pointerEvents = "none";
    svg.style.display = "inherit";
    svg.style.width = "100%";
    svg.style.height = "100%";

    const path = document.createElementNS(svgns, "path");
    path.setAttribute(
      "d",
      "M480-80q0-83-31.5-156T363-363q-54-54-127-85.5T80-480q83 0 156-31.5T363-597q54-54 85.5-127T480-880q0 83 31.5 156T597-597q54 54 127 85.5T880-480q-83 0-156 31.5T597-363q-54 54-85.5 127T480-80Z"
    );

    svg.appendChild(path);
    svgHost.appendChild(svg);
    iconShapeHost.appendChild(svgHost);
    wrapperHost.appendChild(iconShapeHost);
    icon.appendChild(wrapperHost);

    return icon;
  }

  function createTouchFeedback() {
    const touchFeedback = document.createElement("yt-touch-feedback-shape");
    touchFeedback.style.borderRadius = "inherit";

    const feedbackContainer = document.createElement("div");
    feedbackContainer.className =
      "yt-spec-touch-feedback-shape yt-spec-touch-feedback-shape--touch-response";

    const stroke = document.createElement("div");
    stroke.className = "yt-spec-touch-feedback-shape__stroke";

    const fill = document.createElement("div");
    fill.className = "yt-spec-touch-feedback-shape__fill";

    feedbackContainer.appendChild(stroke);
    feedbackContainer.appendChild(fill);
    touchFeedback.appendChild(feedbackContainer);

    return touchFeedback;
  }

  function buildAskGeminiButton() {
    const outerContainer = document.createElement("div");
    outerContainer.id = IDS.askGeminiButton;
    outerContainer.classList.add(
      "style-scope",
      "ytd-video-owner-renderer",
      "copy-panel"
    );

    const container = document.createElement("div");
    container.className = "copy-button-container";

    const button = document.createElement("button");
    button.classList.add(...ytBtnClassList);
    button.addEventListener("click", () => {
      if (!askPanelVisible) {
        const geminiButton = getGeminiTargetButton();
        if (!geminiButton) {
          logger("Gemini target button not found");
          updateAskGeminiButtonState();
          return;
        }

        geminiButton.click();
        setAskPanelVisible(true);
        logger("Clicked Gemini target button (panel visible)");
        setTimeout(updateAskGeminiButtonState, 100);
        return;
      }

      const closeButton = getPanelCloseButton();
      if (!closeButton) {
        logger("Panel close button not found. Keeping visible state.");
        updateAskGeminiButtonState();
        return;
      }

      closeButton.click();
      setAskPanelVisible(false);
      logger("Clicked panel close button (panel hidden)");
      setTimeout(updateAskGeminiButtonState, 100);
    });

    button.appendChild(createTouchFeedback());
    button.appendChild(createAskGeminiIcon());

    container.appendChild(button);
    outerContainer.appendChild(container);

    const wrapper = document.createElement(TAGS.wrapper);
    wrapper.classList.add("ytd-menu-renderer");
    wrapper.appendChild(outerContainer);

    return { wrapper, button };
  }

  function addAskGeminiButton() {
    const topButtons = document.querySelector(SELECTORS.topButtons);
    if (!topButtons) {
      return null;
    }

    const existing = document.getElementById(IDS.askGeminiButton);
    if (existing) {
      return existing.querySelector("button");
    }

    const { wrapper, button } = buildAskGeminiButton();

    let insertAfter = null;
    for (
      let el = topButtons.lastElementChild;
      el;
      el = el.previousElementSibling
    ) {
      if (el.tagName && el.tagName.toLowerCase() === TAGS.wrapper) {
        insertAfter = el;
        break;
      }
    }

    const referenceNode = insertAfter ? insertAfter.nextSibling : null;
    topButtons.insertBefore(wrapper, referenceNode);

    logger("Ask Gemini button created");

    return button;
  }

  function ensureAskGeminiButton() {
    if (!isWatchPage()) {
      setAskPanelVisible(false);
      return;
    }

    const button = addAskGeminiButton();
    if (button) {
      updateAskGeminiButtonState();
    }
  }

  function handleNavigationRefresh() {
    setAskPanelVisible(Boolean(getPanelCloseButton()));
    ensureAskGeminiButton();
  }

  function init() {
    const style = document.createElement("style");
    style.appendChild(document.createTextNode(cssText));
    document.head.appendChild(style);

    const observer = new MutationObserver(() => {
      ensureAskGeminiButton();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("yt-navigate-finish", handleNavigationRefresh);

    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        handleNavigationRefresh();
      }
    }, 250);

    handleNavigationRefresh();
  }

  init();
})();
