// ==UserScript==
// @name         YouTube Ask Gemini Button
// @description  Adds an Ask Gemini button next to YouTube action buttons and clicks the Gemini CTA when available
// @match        https://www.youtube.com/*
// @license      MIT
// @run-at       document-end
// @noframes
// @version      1.0.10
// @require      https://github.com/johan456789/userscripts/raw/main/utils/yt-action-button.js
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/yt-ask-gemini-question.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/yt-ask-gemini-question.js
// ==/UserScript==

const IDS = { askGeminiButton: "ask-gemini-button" };
const TOOLTIP_TEXT = {
  enabled: "Ask Gemini",
  disabled: "Ask Gemini not available",
};
const SELECTORS = {
  topButtons: [
    "#top-row #actions #menu #top-level-buttons-computed",
    "#top-row #actions #menu #flexible-item-buttons",
  ],
  nativeAskButtonHosts: [
    "yt-button-view-model:has(button-view-model.you-chat-entrypoint-button)",
    "yt-button-view-model:has(button[aria-label='Ask'])",
    "yt-button-view-model:has(button .yt-spec-button-shape-next__button-text-content)",
  ],
  geminiTriggers: [
    "#items > yt-video-description-youchat-section-view-model > div.ytVideoDescriptionYouchatSectionViewModelPrimaryButton > button-view-model > button",
    "#above-the-fold yt-video-description-youchat-section-view-model button-view-model > button",
    "#above-the-fold yt-video-description-youchat-section-view-model button",
  ],
  panelCloseTrigger:
    "#visibility-button > ytd-button-renderer > yt-button-shape > button",
  descriptionExpandTrigger: "#above-the-fold #expand",
};
const TAGS = { wrapper: "yt-button-view-model" };
const STYLE_IDS = { hideNativeAsk: "yt-hide-native-ask-button-style" };

const logger = Logger("[YT-ask-gemini-question]");
logger("Userscript started.");
let lastDescriptionExpandAttemptMs = 0;
let askGeminiButtonComponent = null;
const DESCRIPTION_EXPAND_COOLDOWN_MS = 1000;

(function () {
  "use strict";

  function isWatchPage() {
    return window.location.pathname === "/watch";
  }

  function getTopButtonsContainer() {
    for (const selector of SELECTORS.topButtons) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }
    return null;
  }

  function getPanelCloseButton() {
    return document.querySelector(SELECTORS.panelCloseTrigger);
  }

  function getDescriptionExpandButton() {
    return document.querySelector(SELECTORS.descriptionExpandTrigger);
  }

  function isElementInteractable(element) {
    if (!element || !element.isConnected) {
      return false;
    }

    if (element.disabled || element.getAttribute("aria-disabled") === "true") {
      return false;
    }

    if (element.closest("[hidden], [aria-hidden='true']")) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      style.pointerEvents === "none"
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getActiveCloseButton() {
    const closeButton = getPanelCloseButton();
    return isElementInteractable(closeButton) ? closeButton : null;
  }

  function getFirstInteractableMatch(selectors) {
    for (const selector of selectors) {
      const candidates = document.querySelectorAll(selector);
      for (const candidate of candidates) {
        if (isElementInteractable(candidate)) {
          return candidate;
        }
      }
    }

    return null;
  }

  function getActiveGeminiButton() {
    return getFirstInteractableMatch(SELECTORS.geminiTriggers);
  }

  function tryExpandDescription() {
    if (getActiveCloseButton() || getActiveGeminiButton()) {
      return false;
    }

    const now = Date.now();
    if (now - lastDescriptionExpandAttemptMs < DESCRIPTION_EXPAND_COOLDOWN_MS) {
      return false;
    }

    const expandButton = getDescriptionExpandButton();
    if (!isElementInteractable(expandButton)) {
      return false;
    }

    expandButton.click();
    lastDescriptionExpandAttemptMs = now;
    logger("Clicked #expand to expand description");
    return true;
  }

  function getAskGeminiTooltipText(button) {
    return button.disabled ? TOOLTIP_TEXT.disabled : TOOLTIP_TEXT.enabled;
  }

  function removeNativeAskButtons() {
    const topButtons = getTopButtonsContainer();
    if (!topButtons) {
      return;
    }

    let removed = false;
    for (const selector of SELECTORS.nativeAskButtonHosts) {
      const hosts = topButtons.querySelectorAll(selector);
      for (const host of hosts) {
        if (!host.isConnected || host.querySelector(`#${IDS.askGeminiButton}`)) {
          continue;
        }

        const hasYouChatClass = Boolean(
          host.querySelector("button-view-model.you-chat-entrypoint-button")
        );
        const askButton = host.querySelector("button");
        const buttonTextNode = host.querySelector(
          ".yt-spec-button-shape-next__button-text-content"
        );
        const buttonText = (buttonTextNode?.textContent || "").trim();
        const isAskLabel = askButton?.getAttribute("aria-label") === "Ask";
        const isAskText = buttonText === "Ask";

        if (!hasYouChatClass && !isAskLabel && !isAskText) {
          continue;
        }

        host.remove();
        removed = true;
      }
    }

    if (removed) {
      logger("Removed YouTube native Ask button");
    }
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

  function handleAskGeminiButtonClick() {
    const closeButton = getActiveCloseButton();
    if (closeButton) {
      closeButton.click();
      logger("Clicked panel close button (panel hidden)");
      setTimeout(updateAskGeminiButtonState, 100);
      return;
    }

    const geminiButton = getActiveGeminiButton();
    if (!geminiButton) {
      if (tryExpandDescription()) {
        logger("Expanded description, retrying Gemini open");
        setTimeout(() => {
          const retryGeminiButton = getActiveGeminiButton();
          if (!retryGeminiButton) {
            logger("Gemini target button not available after expand");
            updateAskGeminiButtonState();
            return;
          }
          retryGeminiButton.click();
          logger(
            "Clicked Gemini target button after expanding description (panel visible)"
          );
          setTimeout(updateAskGeminiButtonState, 100);
        }, 150);
        return;
      }

      logger("Gemini target button not available");
      updateAskGeminiButtonState();
      return;
    }

    geminiButton.click();
    logger("Clicked Gemini target button (panel visible)");
    setTimeout(updateAskGeminiButtonState, 100);
  }

  function updateAskGeminiButtonState() {
    if (!askGeminiButtonComponent?.button) {
      return;
    }

    const closeButton = getActiveCloseButton();
    const currentTarget = closeButton || getActiveGeminiButton();
    const askButton = askGeminiButtonComponent.button;
    askButton.dataset.askPanelVisible = String(Boolean(closeButton));
    askGeminiButtonComponent.setDisabled(!currentTarget);

    if (!currentTarget && tryExpandDescription()) {
      setTimeout(updateAskGeminiButtonState, 150);
    }
  }

  function buildAskGeminiButton() {
    return ytActionButton.create({
      id: IDS.askGeminiButton,
      getTooltipText: getAskGeminiTooltipText,
      onClick: handleAskGeminiButtonClick,
      buildButtonContent(button, { createTouchFeedback }) {
        button.appendChild(createTouchFeedback());
        button.appendChild(createAskGeminiIcon());
      },
    });
  }

  function addAskGeminiButton() {
    const topButtons = getTopButtonsContainer();
    if (!topButtons) {
      return null;
    }

    const existing = document.getElementById(IDS.askGeminiButton);
    if (existing) {
      return askGeminiButtonComponent?.button || existing.querySelector("button");
    }

    askGeminiButtonComponent = buildAskGeminiButton();
    const { wrapper, button } = askGeminiButtonComponent;

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
      return;
    }

    removeNativeAskButtons();

    const button = addAskGeminiButton();
    if (button) {
      tryExpandDescription();
      updateAskGeminiButtonState();
    }
  }

  function handleNavigationRefresh() {
    ensureAskGeminiButton();
  }

  function init() {
    const hideStyle = document.createElement("style");
    hideStyle.id = STYLE_IDS.hideNativeAsk;
    hideStyle.textContent = `
#top-row #actions #menu #flexible-item-buttons button-view-model.you-chat-entrypoint-button,
#top-row #actions #menu #flexible-item-buttons yt-button-view-model:has(button-view-model.you-chat-entrypoint-button) {
  display: none !important;
}
`;
    document.head.appendChild(hideStyle);

    const observer = new MutationObserver(() => {
      removeNativeAskButtons();
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
