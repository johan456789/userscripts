// ==UserScript==
// @name         YouTube Watchlist Helper
// @description  Adds helper controls to the playlist header menu on YouTube
// @match        https://www.youtube.com/playlist?list=WL
// @grant        none
// @license      MIT
// @run-at       document-end
// @noframes
// @version      0.1.0
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @require      https://github.com/johan456789/userscripts/raw/main/utils/debounce.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/yt-wl-helper.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/yt-wl-helper.js
// ==/UserScript==

const logger = Logger("[YT-wl-helper]");
logger("Userscript started.");

const IDS = {
  menuButton: "yt-wl-helper-menu-button",
  overlay: "yt-wl-helper-url-overlay",
  overlayContent: "yt-wl-helper-url-overlay-content",
  overlayClose: "yt-wl-helper-url-overlay-close",
};

const SELECTORS = {
  playlistMenu: "#page-manager div.ytd-playlist-header-renderer ytd-menu-renderer",
  buttonList: "#top-level-buttons-computed",
};

const BUTTON_HTML = `
<yt-button-shape id="${IDS.menuButton}" class="style-scope ytd-menu-renderer">
  <button class="yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--overlay yt-spec-button-shape-next--size-m yt-spec-button-shape-next--icon-button yt-spec-button-shape-next--enable-backdrop-filter-experiment" title="" aria-label="Action menu">
    <div aria-hidden="true" class="yt-spec-button-shape-next__icon">
      <span class="ytIconWrapperHost" style="width: 24px; height: 24px;">
        <span class="yt-icon-shape ytSpecIconShapeHost">
          <div style="width: 100%; height: 100%; display: block; fill: currentcolor;">
            <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" focusable="false" aria-hidden="true" style="pointer-events: none; display: inherit; width: 100%; height: 100%;">
              <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2.3">
                <line x1="4" y1="6" x2="20" y2="6"></line>
                <line x1="6" y1="12" x2="18" y2="12"></line>
                <line x1="8" y1="18" x2="16" y2="18"></line>
              </g>
            </svg>
          </div>
        </span>
      </span>
    </div>
    <yt-touch-feedback-shape aria-hidden="true" class="yt-spec-touch-feedback-shape yt-spec-touch-feedback-shape--overlay-touch-response">
      <div class="yt-spec-touch-feedback-shape__stroke"></div>
      <div class="yt-spec-touch-feedback-shape__fill"></div>
    </yt-touch-feedback-shape>
  </button>
</yt-button-shape>
`;

const STYLE_ID = "yt-wl-helper-style";
const STYLE_TEXT = `
#${IDS.menuButton} .yt-spec-button-shape-next__icon svg {
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.45));
}
#${IDS.overlay} {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
#${IDS.overlayContent} {
  width: min(900px, 90vw);
  height: min(70vh, 600px);
  background: #fff;
  color: #111;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
#${IDS.overlayContent} textarea {
  flex: 1;
  width: 100%;
  resize: none;
  font-size: 12px;
  line-height: 1.4;
}
#${IDS.overlayClose} {
  align-self: flex-end;
}
`;

// To avoid "This document requires 'TrustedHTML' assignment" errors.
// https://stackoverflow.com/a/69309927/6306190
const dangerouslyEscapeHTMLPolicy = trustedTypes.createPolicy("forceInner", {
  createHTML: (to_escape) => to_escape,
});

(function () {
  "use strict";

  const buttonTemplate = document.createElement("div");
  buttonTemplate.innerHTML = dangerouslyEscapeHTMLPolicy.createHTML(BUTTON_HTML.trim());
  const baseButton = buttonTemplate.firstElementChild;

  function createMenuButton() {
    if (baseButton) {
      return baseButton.cloneNode(true);
    }

    const fallbackWrapper = document.createElement("div");
    fallbackWrapper.innerHTML = dangerouslyEscapeHTMLPolicy.createHTML(BUTTON_HTML.trim());
    const buttonShape = fallbackWrapper.firstElementChild;
    if (!buttonShape) {
      logger.error("Failed to create button from template");
      return null;
    }
    return buttonShape;
  }

  function getButtonsContainer(menu) {
    return menu.querySelector(SELECTORS.buttonList) || menu;
  }

  function ensureMenuButtonExists() {
    // Quick check: if button already exists, skip DOM queries
    if (document.getElementById(IDS.menuButton)) {
      return true;
    }

    const menu = document.querySelector(SELECTORS.playlistMenu);
    if (!menu) {
      return false;
    }

    const container = getButtonsContainer(menu);
    if (!container) {
      logger("Buttons container not found in menu");
      return false;
    }

    const button = createMenuButton();
    if (!button) {
      return false;
    }

    container.appendChild(button);
    bindMenuButton(button);
    logger("Inserted playlist helper button");
    return true;
  }

  const debouncedEnsureButton = debounce(ensureMenuButtonExists, 100);

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    (document.head || document.documentElement).appendChild(style);
  }

  function collectVisibleUrls() {
    const anchors = Array.from(document.querySelectorAll("a#video-title"));
    const urls = anchors
      .map((anchor) => anchor.href)
      .filter((href) => href && href.includes("watch?v="));
    return Array.from(new Set(urls));
  }

  function closeOverlay() {
    const overlay = document.getElementById(IDS.overlay);
    if (overlay) {
      overlay.remove();
    }
  }

  function showOverlay(urls) {
    closeOverlay();

    const overlay = document.createElement("div");
    overlay.id = IDS.overlay;

    const content = document.createElement("div");
    content.id = IDS.overlayContent;

    const closeButton = document.createElement("button");
    closeButton.id = IDS.overlayClose;
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", closeOverlay);

    const textarea = document.createElement("textarea");
    textarea.readOnly = true;
    textarea.value = urls.join("\n");

    content.appendChild(closeButton);
    content.appendChild(textarea);
    overlay.appendChild(content);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeOverlay();
      }
    });

    document.body.appendChild(overlay);
  }

  function bindMenuButton(buttonShape) {
    if (!buttonShape || buttonShape.dataset.ytWlHelperBound === "true") {
      return;
    }
    buttonShape.dataset.ytWlHelperBound = "true";

    const button = buttonShape.querySelector("button");
    if (!button) {
      return;
    }

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const urls = collectVisibleUrls();
      logger(`Collected ${urls.length} URLs`);
      showOverlay(urls);
    });
  }

  function init() {
    ensureStyles();
    ensureMenuButtonExists();

    const observer = new MutationObserver(debouncedEnsureButton);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("yt-navigate-finish", () => {
      logger("Navigation finished, ensuring button exists");
      ensureMenuButtonExists();
    });
  }

  init();
})();
