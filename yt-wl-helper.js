// ==UserScript==
// @name         YouTube Watchlist Helper
// @description  Adds helper controls to the playlist header menu on YouTube
// @match        https://www.youtube.com/playlist?list=WL
// @grant        none
// @license      MIT
// @run-at       document-end
// @noframes
// @version      0.2.0
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @require      https://github.com/johan456789/userscripts/raw/main/utils/debounce.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/yt-wl-helper.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/yt-wl-helper.js
// ==/UserScript==

const logger = Logger("[YT-wl-helper]");
logger("Userscript started.");

const IDS = {
  filterBar: "yt-wl-helper-duration-filters",
};

const SELECTORS = {
  header: "#header.ytd-item-section-renderer",
  baseChipBar: "#header chip-bar-view-model",
  playlistItem: "#contents ytd-playlist-video-renderer",
  durationText:
    "#thumbnail #overlays #time-status #text, #thumbnail #overlays .yt-badge-shape__text",
};

const FILTERS = [
  { id: "all", label: "All", matches: () => true },
  { id: "lt5", label: "<5min", matches: (seconds) => seconds !== null && seconds < 300 },
  {
    id: "5to25",
    label: "5-25min",
    matches: (seconds) => seconds !== null && seconds >= 300 && seconds < 1500,
  },
  {
    id: "25to45",
    label: "25-45min",
    matches: (seconds) => seconds !== null && seconds >= 1500 && seconds < 2700,
  },
  { id: "gt45", label: ">45min", matches: (seconds) => seconds !== null && seconds >= 2700 },
];

let currentFilterId = "all";

(function () {
  "use strict";

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

  function getDurationSeconds(item) {
    const cached = item.dataset.ytWlHelperDuration;
    if (cached) {
      const value = Number(cached);
      return Number.isNaN(value) ? null : value;
    }
    if (cached === "unknown") {
      return null;
    }

    const durationNode = item.querySelector(SELECTORS.durationText);
    if (!durationNode) {
      return null;
    }

    const durationText = durationNode.textContent.trim();
    if (!durationText) {
      return null;
    }

    const seconds = parseDurationSeconds(durationText);
    if (seconds === null) {
      item.dataset.ytWlHelperDuration = "unknown";
      return null;
    }

    item.dataset.ytWlHelperDuration = String(seconds);
    return seconds;
  }

  function updateChipStates(filterBar, activeId) {
    const buttons = filterBar.querySelectorAll("button[data-filter-id]");
    buttons.forEach((button) => {
      const isActive = activeId ? button.dataset.filterId === activeId : false;
      button.setAttribute("aria-selected", isActive ? "true" : "false");
      const chip = button.querySelector(".ytChipShapeChip");
      if (chip) {
        chip.classList.toggle("ytChipShapeActive", isActive);
        chip.classList.toggle("ytChipShapeInactive", !isActive);
      }
    });
  }

  function applyFilter(filterId = currentFilterId) {
    const filter = FILTERS.find((entry) => entry.id === filterId) || FILTERS[0];
    currentFilterId = filter.id;

    const items = Array.from(document.querySelectorAll(SELECTORS.playlistItem));
    items.forEach((item) => {
      const seconds = getDurationSeconds(item);
      const shouldShow = filter.matches(seconds);
      item.style.display = shouldShow ? "" : "none";
    });

    const filterBar = document.getElementById(IDS.filterBar);
    if (filterBar) {
      updateChipStates(filterBar, currentFilterId);
    }
  }

  function createFilterBar() {
    const filterBar = document.createElement("chip-bar-view-model");
    filterBar.id = IDS.filterBar;
    filterBar.setAttribute(
      "class",
      "ytChipBarViewModelHost style-scope ytd-item-section-renderer"
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

      button.addEventListener("click", () => applyFilter(filter.id));
    });

    return filterBar;
  }

  function ensureFilterBarExists() {
    const header = document.querySelector(SELECTORS.header);
    if (!header) {
      return false;
    }

    if (document.getElementById(IDS.filterBar)) {
      applyFilter(currentFilterId);
      return true;
    }

    const baseChipBar = header.querySelector(SELECTORS.baseChipBar);
    if (!baseChipBar) {
      return false;
    }

    const filterBar = createFilterBar();
    baseChipBar.insertAdjacentElement("afterend", filterBar);
    logger("Inserted duration filter bar");
    applyFilter(currentFilterId);
    return true;
  }

  const debouncedEnsureFilterBar = debounce(ensureFilterBarExists, 100);

  function init() {
    ensureFilterBarExists();

    const observer = new MutationObserver(debouncedEnsureFilterBar);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("yt-navigate-finish", () => {
      logger("Navigation finished, ensuring filter bar exists");
      ensureFilterBarExists();
    });
  }

  init();
})();
