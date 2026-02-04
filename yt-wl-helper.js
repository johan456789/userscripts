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
  overlayFilters: "yt-wl-helper-url-overlay-filters",
  overlayList: "yt-wl-helper-url-overlay-list",
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
  padding: 16px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: min(70vh, 600px);
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}
#${IDS.overlayList} {
  flex: 1;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  min-width: 0;
}
#${IDS.overlay} .yt-spec-dialog-layout__dialog-layout-container,
#${IDS.overlay} .yt-spec-dialog-layout__dialog-layout-content {
  overflow: hidden;
  max-height: min(70vh, 600px);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
#${IDS.overlay} .yt-spec-dialog-layout__dialog-layout-content-inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
#${IDS.overlayFilters} {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.yt-wl-helper-item {
  display: block;
  padding: 8px 0;
  border-bottom: 1px solid #e6e6e6;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}
.yt-wl-helper-item:last-child {
  border-bottom: none;
}
.yt-wl-helper-line {
  font-size: 12px;
  line-height: 1.4;
  word-break: break-word;
  overflow-wrap: anywhere;
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

  function toWatchUrl(rawUrl) {
    try {
      const parsed = new URL(rawUrl, window.location.origin);
      const videoId = parsed.searchParams.get("v");
      if (!videoId) {
        return null;
      }
      return `https://www.youtube.com/watch?v=${videoId}`;
    } catch (error) {
      return null;
    }
  }

  function collectVisibleItems() {
    const anchors = Array.from(document.querySelectorAll("a#video-title"));
    const items = [];
    const seen = new Set();

    anchors.forEach((anchor) => {
      const watchUrl = toWatchUrl(anchor.href);
      if (!watchUrl || seen.has(watchUrl)) {
        return;
      }
      seen.add(watchUrl);

      const title = anchor.getAttribute("title") || anchor.textContent.trim();
      const container = anchor.closest("ytd-playlist-video-renderer") || anchor.closest("#meta");
      const info = container ? container.querySelector("#byline-container #video-info") : null;
      const durationNode = container
        ? container.querySelector(
            "#thumbnail #overlays #time-status #text, #thumbnail #overlays .yt-badge-shape__text"
          )
        : null;
      const duration = durationNode ? durationNode.textContent.trim() : "";
      const infoText = info ? info.textContent : "";
      const parts = infoText
        .split("•")
        .map((part) => part.trim())
        .filter(Boolean);

      const views = parts[0] || "";
      const uploadDate = parts[1] || "";

      items.push({
        title,
        duration,
        views,
        uploadDate,
        url: watchUrl,
      });
    });

    return items;
  }

  function closeOverlay() {
    const overlay = document.getElementById(IDS.overlay);
    if (overlay) {
      overlay.remove();
    }
  }

  function parseDurationSeconds(durationText) {
    if (!durationText) {
      return null;
    }
    const parts = durationText
      .trim()
      .split(":")
      .map((part) => Number(part));
    if (parts.some((part) => Number.isNaN(part))) {
      return null;
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 1) {
      return parts[0];
    }
    return null;
  }

  function showOverlay(items) {
    closeOverlay();

    const enrichedItems = items.map((item) => ({
      ...item,
      durationSeconds: parseDurationSeconds(item.duration),
    }));

    const overlay = document.createElement("div");
    overlay.id = IDS.overlay;

    const dialogHost = document.createElement("yt-dialog-view-model");
    dialogHost.className = "ytDialogViewModelHost ytDialogViewModelResetSpacing";
    dialogHost.setAttribute("dialog", "true");
    dialogHost.tabIndex = -1;

    const dialogLayout = document.createElement("dialog-layout");
    dialogLayout.className = "yt-spec-dialog-layout yt-spec-dialog-layout--dialog-layout-responsive";

    const headerContainer = document.createElement("div");
    headerContainer.className = "yt-spec-dialog-layout__dialog-header-container";

    const header = document.createElement("yt-dialog-header-view-model");
    header.className = "ytDialogHeaderViewModelHost ytDialogHeaderViewModelHostDisablePadding";

    const headerTitle = document.createElement("h2");
    const headerText = document.createElement("span");
    headerText.className =
      "yt-core-attributed-string ytDialogHeaderViewModelText yt-core-attributed-string--white-space-pre-wrap";
    headerText.textContent = "Watch later items";
    headerTitle.appendChild(headerText);
    header.appendChild(headerTitle);
    headerContainer.appendChild(header);

    const layoutContainer = document.createElement("div");
    layoutContainer.className = "yt-spec-dialog-layout__dialog-layout-container";

    const layoutContent = document.createElement("div");
    layoutContent.className = "yt-spec-dialog-layout__dialog-layout-content";

    const content = document.createElement("div");
    content.id = IDS.overlayContent;
    content.className = "yt-spec-dialog-layout__dialog-layout-content-inner";

    const filters = [
      { id: "all", label: "All", matches: () => true },
      { id: "lt5", label: "<5min", matches: (item) => item.durationSeconds !== null && item.durationSeconds < 300 },
      {
        id: "5to25",
        label: "5-25min",
        matches: (item) =>
          item.durationSeconds !== null && item.durationSeconds >= 300 && item.durationSeconds < 1500,
      },
      {
        id: "25to45",
        label: "25-45min",
        matches: (item) =>
          item.durationSeconds !== null &&
          item.durationSeconds >= 1500 &&
          item.durationSeconds < 2700,
      },
      {
        id: "gt45",
        label: ">45min",
        matches: (item) => item.durationSeconds !== null && item.durationSeconds >= 2700,
      },
    ];

    const filterBar = document.createElement("chip-bar-view-model");
    filterBar.id = IDS.overlayFilters;
    filterBar.className = "ytChipBarViewModelHost";
    filterBar.setAttribute("role", "tablist");

    const list = document.createElement("div");
    list.id = IDS.overlayList;

    const itemElements = enrichedItems.map((item) => {
      const itemEl = document.createElement("a");
      itemEl.className = "yt-wl-helper-item";
      itemEl.dataset.durationSeconds =
        item.durationSeconds === null ? "" : String(item.durationSeconds);
      itemEl.href = item.url;
      itemEl.target = "_self";
      itemEl.rel = "noopener";

      const title = document.createElement("div");
      title.className = "yt-wl-helper-line";
      title.textContent = item.title;

      const duration = document.createElement("div");
      duration.className = "yt-wl-helper-line";
      duration.textContent = item.duration;

      const views = document.createElement("div");
      views.className = "yt-wl-helper-line";
      views.textContent = item.views;

      const uploadDate = document.createElement("div");
      uploadDate.className = "yt-wl-helper-line";
      uploadDate.textContent = item.uploadDate;

      const url = document.createElement("div");
      url.className = "yt-wl-helper-line";
      url.textContent = item.url;

      itemEl.appendChild(title);
      itemEl.appendChild(duration);
      itemEl.appendChild(views);
      itemEl.appendChild(uploadDate);
      itemEl.appendChild(url);
      return itemEl;
    });

    itemElements.forEach((itemEl) => list.appendChild(itemEl));

    function applyFilter(filterId) {
      const active = filters.find((filter) => filter.id === filterId) || filters[0];
      itemElements.forEach((itemEl, index) => {
        const item = enrichedItems[index];
        itemEl.style.display = active.matches(item) ? "" : "none";
      });

      const buttons = filterBar.querySelectorAll("button[role='tab']");
      buttons.forEach((button) => {
        const isActive = button.dataset.filterId === active.id;
        button.setAttribute("aria-selected", isActive ? "true" : "false");
        const chip = button.querySelector(".ytChipShapeChip");
        if (chip) {
          chip.classList.toggle("ytChipShapeActive", isActive);
          chip.classList.toggle("ytChipShapeInactive", !isActive);
        }
      });
    }

    filters.forEach((filter, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "ytChipBarViewModelChipWrapper";

      const chipView = document.createElement("chip-view-model");
      chipView.className = "ytChipViewModelHost";

      const chipShape = document.createElement("chip-shape");
      chipShape.className = "ytChipShapeHost";

      const button = document.createElement("button");
      button.className = "ytChipShapeButtonReset";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-label", filter.label);
      button.setAttribute("aria-selected", index === 0 ? "true" : "false");
      button.dataset.filterId = filter.id;

      const chip = document.createElement("div");
      chip.className = `ytChipShapeChip ${index === 0 ? "ytChipShapeActive" : "ytChipShapeInactive"} ytChipShapeOnlyTextPadding`;
      chip.textContent = filter.label;

      button.appendChild(chip);
      chipShape.appendChild(button);
      chipView.appendChild(chipShape);
      wrapper.appendChild(chipView);
      filterBar.appendChild(wrapper);

      button.addEventListener("click", () => applyFilter(filter.id));
    });

    content.appendChild(filterBar);
    content.appendChild(list);

    layoutContent.appendChild(content);
    layoutContainer.appendChild(layoutContent);
    dialogLayout.appendChild(headerContainer);
    dialogLayout.appendChild(layoutContainer);
    dialogHost.appendChild(dialogLayout);
    overlay.appendChild(dialogHost);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeOverlay();
      }
    });

    document.body.appendChild(overlay);
    applyFilter("all");
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
      const items = collectVisibleItems();
      logger(`Collected ${items.length} items`);
      showOverlay(items);
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
