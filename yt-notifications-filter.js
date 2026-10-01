// ==UserScript==
// @name         YouTube Notifications Filter
// @description  Adds Videos/Shorts chip filters to the YouTube notifications popup
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-end
// @noframes
// @version      0.1.7
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @require      https://github.com/johan456789/userscripts/raw/main/utils/debounce.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/yt-notifications-filter.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/yt-notifications-filter.js
// ==/UserScript==

const logger = Logger("[YT-notifications-filter]");
logger("Userscript started.");

const CLASSES = {
  style: "yt-notification-filter-style",
  filterBar: "yt-notification-filter-bar",
  durationChip: "yt-notification-duration-chip",
};

const SELECTORS = {
  notificationMenu: "ytd-multi-page-menu-renderer",
  notificationHeader: "#header ytd-simple-menu-header-renderer",
  notificationButtons: "#buttons.ytd-simple-menu-header-renderer",
  notificationItem: "ytd-notification-renderer",
  notificationMessage: "yt-formatted-string.message",
  notificationSection: "yt-multi-page-menu-section-renderer",
  notificationSectionTitle: "#section-title",
  notificationSectionItems: "#items",
  chipButton: "button[data-filter-id]",
};

const FILTERS = [
  { id: "videos", label: "Videos", matches: (type) => type === "videos" },
  { id: "shorts", label: "Shorts", matches: (type) => type === "shorts" },
  { id: "others", label: "Others", matches: (type) => type === "unknown" },
];

let currentFilterId = "videos";
const authorCache = {};
const durationCache = {};
const OBSERVER_DEBOUNCE_MS = 100;
const OBSERVER_MAX_WAIT_MS = 500;
const INNER_TUBE_CLIENT_VERSION = "2.20250116.10.00";

(function () {
  "use strict";

  function ensureStyleTag() {
    if (document.getElementById(CLASSES.style)) {
      return;
    }

    const style = document.createElement("style");
    style.id = CLASSES.style;
    style.textContent = `
      .${CLASSES.filterBar} {
        margin-left: auto;
        margin-right: 12px;
      }
      .${CLASSES.filterBar} button {
        cursor: pointer;
      }
      .thumbnail-container.style-scope.ytd-notification-renderer {
        position: relative;
      }
      .${CLASSES.durationChip} {
        position: absolute;
        right: 2px;
        bottom: 2px;
        z-index: 1;
        background-color: rgba(0, 0, 0, 0.6);
        color: #fff;
        font-size: 12px;
        font-weight: 400;
        line-height: 1.3;
        letter-spacing: 0;
        padding: 1px 3px;
        border-radius: 3px;
        pointer-events: none;
        font-family: Roboto, Arial, sans-serif;
      }
    `;
    document.head.appendChild(style);
  }

  function updateChipStates(filterBar, activeId) {
    const buttons = filterBar.querySelectorAll(SELECTORS.chipButton);
    buttons.forEach((button) => {
      const isActive = button.dataset.filterId === activeId;
      button.setAttribute("aria-selected", isActive ? "true" : "false");

      const chip = button.querySelector(".ytChipShapeChip");
      if (chip) {
        chip.classList.toggle("ytChipShapeActive", isActive);
        chip.classList.toggle("ytChipShapeInactive", !isActive);
      }
    });
  }

  function getNotificationType(item) {
    const cached = item.dataset.ytNotificationType;
    if (cached && cached !== "unknown") {
      return cached;
    }

    const links = Array.from(item.querySelectorAll("a[href]"))
      .map((link) => link.getAttribute("href") || "")
      .filter(Boolean);

    if (links.some((href) => href.includes("/shorts/"))) {
      item.dataset.ytNotificationType = "shorts";
      return "shorts";
    }

    if (links.some((href) => href.includes("/watch"))) {
      item.dataset.ytNotificationType = "videos";
      return "videos";
    }

    return "unknown";
  }

  function applyFilter(menu, filterId = currentFilterId) {
    const filter = FILTERS.find((entry) => entry.id === filterId) || FILTERS[0];
    currentFilterId = filter.id;

    const items = Array.from(menu.querySelectorAll(SELECTORS.notificationItem));
    items.forEach((item) => {
      simplifyNotificationMessage(item);
      enrichWithAuthor(item);
      enrichWithDuration(item);
      const type = getNotificationType(item);
      item.style.display = filter.matches(type) ? "" : "none";
    });

    const sectionStates = Array.from(
      menu.querySelectorAll(SELECTORS.notificationSection),
    )
      .map((section) => getSectionState(section))
      .filter(Boolean);

    const visibleSectionCount = sectionStates.filter(
      (state) => state.hasVisibleItems,
    ).length;
    sectionStates.forEach((state) => {
      const shouldShowTitle = state.hasVisibleItems && visibleSectionCount > 1;
      state.title.style.display = shouldShowTitle ? "" : "none";
    });

    const filterBar = menu.querySelector(`.${CLASSES.filterBar}`);
    if (filterBar) {
      updateChipStates(filterBar, currentFilterId);
    }
  }

  function getSectionState(section) {
    const title = section.querySelector(SELECTORS.notificationSectionTitle);
    const itemsContainer = section.querySelector(
      SELECTORS.notificationSectionItems,
    );
    if (!title || !itemsContainer) {
      return null;
    }

    const hasVisibleItems = Array.from(
      itemsContainer.querySelectorAll(SELECTORS.notificationItem),
    ).some((item) => item.style.display !== "none");

    return { title, hasVisibleItems };
  }

  function getVideoId(item) {
    const link = item.querySelector("a[href]");
    if (!link) return null;
    const href = link.getAttribute("href") || "";
    const match = href.match(/\/(?:watch\?v=|shorts\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  function formatDuration(totalSeconds) {
    const secs = Math.floor(Number(totalSeconds));
    if (!Number.isFinite(secs) || secs < 0) {
      return null;
    }
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  async function fetchVideoDuration(videoId) {
    if (durationCache[videoId]) {
      return durationCache[videoId];
    }

    const response = await fetch(
      "https://www.youtube.com/youtubei/v1/player",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "WEB",
              clientVersion: INNER_TUBE_CLIENT_VERSION,
            },
          },
          videoId,
        }),
      },
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    if (data?.videoDetails?.isLiveContent) {
      durationCache[videoId] = "LIVE";
      return "LIVE";
    }
    const formatted = formatDuration(data?.videoDetails?.lengthSeconds);
    if (formatted) {
      durationCache[videoId] = formatted;
    }
    return formatted;
  }

  function renderDurationChip(item, label) {
    const container = item.querySelector(
      ".thumbnail-container.style-scope.ytd-notification-renderer",
    );
    if (!container) {
      return false;
    }
    let chip = container.querySelector(`:scope > .${CLASSES.durationChip}`);
    if (!chip) {
      chip = document.createElement("span");
      chip.className = CLASSES.durationChip;
      container.appendChild(chip);
    }
    chip.textContent = label;
    return true;
  }

  async function enrichWithDuration(item) {
    if (item.dataset.durationEnriched) return;

    const videoId = getVideoId(item);
    if (!videoId) return;

    if (durationCache[videoId]) {
      if (renderDurationChip(item, durationCache[videoId])) {
        item.dataset.durationEnriched = "true";
      }
      return;
    }

    try {
      const label = await fetchVideoDuration(videoId);
      if (!label) return;
      if (renderDurationChip(item, label)) {
        item.dataset.durationEnriched = "true";
      }
    } catch (_err) {
      logger("Failed to fetch duration for " + videoId);
    }
  }

  async function enrichWithAuthor(item) {
    if (item.dataset.authorEnriched) return;

    const videoId = getVideoId(item);
    if (!videoId) return;

    const metadata = item.querySelector(
      ".metadata.style-scope.ytd-notification-renderer",
    );
    if (!metadata) return;

    const timeElement = metadata.querySelectorAll("yt-formatted-string")[1];
    if (!timeElement) return;

    if (authorCache[videoId]) {
      timeElement.textContent = `${authorCache[videoId]} | ${timeElement.textContent}`;
      item.dataset.authorEnriched = "true";
      return;
    }

    try {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      );
      if (!response.ok) return;
      const data = await response.json();
      authorCache[videoId] = data.author_name;
      timeElement.textContent = `${data.author_name} | ${timeElement.textContent}`;
      item.dataset.authorEnriched = "true";
    } catch (_err) {
      logger("Failed to fetch author for " + videoId);
    }
  }

  function simplifyNotificationMessage(item) {
    const message = item.querySelector(SELECTORS.notificationMessage);
    if (!message) {
      return;
    }

    const text = message.textContent.trim();
    if (!text) {
      return;
    }

    // Reduce clutter by dropping "CHANNEL_NAME uploaded:" and keeping only the title.
    const simplified = text.replace(/^.+?\s+uploaded:\s*/i, "");
    if (!simplified || simplified === text) {
      return;
    }

    message.textContent = simplified;
  }

  function createFilterBar(menu) {
    const filterBar = document.createElement("chip-bar-view-model");
    filterBar.setAttribute(
      "class",
      `ytChipBarViewModelHost style-scope ytd-item-section-renderer style-scope ytd-sort-filter-header-renderer ${CLASSES.filterBar}`,
    );
    filterBar.setAttribute("role", "tablist");

    FILTERS.forEach((filter, index) => {
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
      chip.className = `ytChipShapeChip ${
        index === 0 ? "ytChipShapeActive" : "ytChipShapeInactive"
      } ytChipShapeOnlyTextPadding`;
      chip.textContent = filter.label;

      button.appendChild(chip);
      chipShape.appendChild(button);
      chipView.appendChild(chipShape);
      wrapper.appendChild(chipView);
      filterBar.appendChild(wrapper);

      button.addEventListener("click", () => {
        applyFilter(menu, filter.id);
      });
    });

    return filterBar;
  }

  function isNotificationsMenu(menu) {
    return Boolean(menu.querySelector(SELECTORS.notificationItem));
  }

  function ensureFilterBar(menu) {
    if (!isNotificationsMenu(menu)) {
      return false;
    }

    const header = menu.querySelector(SELECTORS.notificationHeader);
    if (!header) {
      return false;
    }

    let filterBar = header.querySelector(`.${CLASSES.filterBar}`);
    if (!filterBar) {
      ensureStyleTag();
      filterBar = createFilterBar(menu);

      const buttons = header.querySelector(SELECTORS.notificationButtons);
      if (buttons) {
        buttons.insertAdjacentElement("beforebegin", filterBar);
      } else {
        header.appendChild(filterBar);
      }

      logger("Inserted notifications filter bar");
    }

    applyFilter(menu, currentFilterId);
    return true;
  }

  function ensureFilters() {
    const menus = Array.from(
      document.querySelectorAll(SELECTORS.notificationMenu),
    );
    menus.forEach((menu) => {
      ensureFilterBar(menu);
    });
  }

  const debouncedEnsureFilters = debounce(ensureFilters, OBSERVER_DEBOUNCE_MS, {
    maxWait: OBSERVER_MAX_WAIT_MS,
  });

  function init() {
    ensureFilters();

    const observer = new MutationObserver(debouncedEnsureFilters);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("yt-navigate-finish", () => {
      ensureFilters();
    });
  }

  init();
})();
