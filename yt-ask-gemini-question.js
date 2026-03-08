// ==UserScript==
// @name         YouTube Ask Gemini Button
// @description  Adds an Ask Gemini button next to YouTube action buttons and clicks the Gemini CTA when available
// @match        https://www.youtube.com/*
// @license      MIT
// @run-at       document-end
// @noframes
// @version      1.0.7
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
  topButtons: "#top-row #actions #menu #top-level-buttons-computed",
  geminiTriggers: [
    "#items > yt-video-description-youchat-section-view-model > div.ytVideoDescriptionYouchatSectionViewModelPrimaryButton > button-view-model > button",
    "#above-the-fold yt-video-description-youchat-section-view-model button-view-model > button",
    "#above-the-fold yt-video-description-youchat-section-view-model button",
  ],
  panelCloseTrigger:
    "#visibility-button > ytd-button-renderer > yt-button-shape > button",
  descriptionExpandTrigger: "#above-the-fold #expand",
  descriptionContainer: "#above-the-fold #description",
  tooltipPopover: `#${IDS.askGeminiButton} .ask-gemini-tooltip-popover`,
};
const TAGS = { wrapper: "yt-button-view-model" };

const logger = Logger("[YT-ask-gemini-question]");
logger("Userscript started.");
let lastDescriptionExpandAttemptMs = 0;
const DESCRIPTION_EXPAND_COOLDOWN_MS = 1000;

const ytBtnClassList =
  "yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m yt-spec-button-shape-next--enable-backdrop-filter-experiment"
    .split(" ")
    .filter(Boolean);

const cssText = `
#${IDS.askGeminiButton} {
  position: relative;
}

#${IDS.askGeminiButton} button.yt-spec-button-shape-next[disabled] {
  opacity: 0.5;
  cursor: default !important;
}

#${IDS.askGeminiButton} button.yt-spec-button-shape-next:not([disabled]) {
  cursor: pointer;
}

#${IDS.askGeminiButton} yt-tooltip {
  pointer-events: none;
}

#${IDS.askGeminiButton} yt-popover {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(15, 15, 15, 0.9);
  color: #fff;
  font-family: "YouTube Sans", "Roboto", sans-serif;
  font-size: 1.2rem;
  line-height: 1.6rem;
  white-space: nowrap;
  z-index: 2202;
}

#${IDS.askGeminiButton} .ask-gemini-tooltip {
  pointer-events: none;
}

#${IDS.askGeminiButton} .ask-gemini-tooltip-popover {
  position: absolute;
  left: 50%;
  top: calc(100% + 8px);
  transform: translateX(-50%);
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgb(91, 91, 91);
  color: #fff;
  font-family: "YouTube Sans", "Roboto", sans-serif;
  font-size: 1.2rem;
  line-height: 1.6rem;
  white-space: nowrap;
  z-index: 2202;
}
`;

(function () {
  "use strict";

  function isWatchPage() {
    return window.location.pathname === "/watch";
  }

  function getPanelCloseButton() {
    return document.querySelector(SELECTORS.panelCloseTrigger);
  }

  function getDescriptionContainer() {
    return document.querySelector(SELECTORS.descriptionContainer);
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

  function syncTooltipState(button, tooltipPopover) {
    const tooltipText = getAskGeminiTooltipText(button);
    if (button.getAttribute("aria-label") !== tooltipText) {
      button.setAttribute("aria-label", tooltipText);
    }
    if (tooltipPopover.textContent !== tooltipText) {
      tooltipPopover.textContent = tooltipText;
    }
  }

  function showTooltip(tooltip, tooltipPopover) {
    tooltip.setAttribute("aria-hidden", "false");
    tooltipPopover.hidden = false;
  }

  function hideTooltip(tooltip, tooltipPopover) {
    tooltip.setAttribute("aria-hidden", "true");
    tooltipPopover.hidden = true;
  }

  function updateAskGeminiButtonState() {
    const askButton = document.querySelector(`#${IDS.askGeminiButton} button`);
    if (!askButton) {
      return;
    }
    const tooltipPopover = document.querySelector(SELECTORS.tooltipPopover);

    const closeButton = getActiveCloseButton();
    const currentTarget = closeButton || getActiveGeminiButton();
    askButton.dataset.askPanelVisible = String(Boolean(closeButton));
    askButton.toggleAttribute("disabled", !currentTarget);
    if (tooltipPopover) {
      syncTooltipState(askButton, tooltipPopover);
    }

    if (!currentTarget && tryExpandDescription()) {
      setTimeout(updateAskGeminiButtonState, 150);
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

  function createTooltip() {
    const tooltip = document.createElement("div");
    tooltip.className = "ask-gemini-tooltip";
    tooltip.setAttribute("aria-hidden", "true");

    const tooltipPopover = document.createElement("div");
    tooltipPopover.className = "ask-gemini-tooltip-popover";
    tooltipPopover.textContent = "Ask Gemini about the video";
    tooltipPopover.hidden = true;

    tooltip.appendChild(tooltipPopover);

    return tooltip;
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
    const tooltip = createTooltip();
    const tooltipPopover = tooltip.querySelector(".ask-gemini-tooltip-popover");
    if (tooltipPopover) {
      syncTooltipState(button, tooltipPopover);
    }

    outerContainer.addEventListener("mouseenter", () => {
      logger("tooltip mouseenter");
      if (tooltipPopover) {
        showTooltip(tooltip, tooltipPopover);
      }
    });
    outerContainer.addEventListener("mouseleave", () => {
      logger("tooltip mouseleave");
      if (tooltipPopover) {
        hideTooltip(tooltip, tooltipPopover);
      }
    });
    button.addEventListener("focus", () => {
      logger("tooltip focus");
      if (tooltipPopover) {
        showTooltip(tooltip, tooltipPopover);
      }
    });
    button.addEventListener("blur", () => {
      logger("tooltip blur");
      if (tooltipPopover) {
        hideTooltip(tooltip, tooltipPopover);
      }
    });

    button.addEventListener("click", () => {
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
    });

    button.appendChild(createTouchFeedback());
    button.appendChild(createAskGeminiIcon());

    container.appendChild(button);
    outerContainer.appendChild(container);
    outerContainer.appendChild(tooltip);

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
      return;
    }

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
