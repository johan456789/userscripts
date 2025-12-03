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
              <path d="M12 4a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Z"></path>
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
    logger("Inserted playlist helper button");
    return true;
  }

  const debouncedEnsureButton = debounce(ensureMenuButtonExists, 100);

  function init() {
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

