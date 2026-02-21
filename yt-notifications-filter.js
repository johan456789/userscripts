// ==UserScript==
// @name         YouTube Notifications Filter
// @description  Adds Videos/Shorts chip filters to the YouTube notifications popup
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-end
// @noframes
// @version      0.1.1
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
};

const SELECTORS = {
  notificationMenu: "ytd-multi-page-menu-renderer",
  notificationHeader: "#header ytd-simple-menu-header-renderer",
  notificationButtons: "#buttons.ytd-simple-menu-header-renderer",
  notificationItem: "ytd-notification-renderer",
  notificationSection: "yt-multi-page-menu-section-renderer",
  notificationSectionTitle: "#section-title",
  notificationSectionItems: "#items",
  chipButton: "button[data-filter-id]",
};

const FILTERS = [
  { id: "videos", label: "Videos", matches: (type) => type === "videos" },
  { id: "shorts", label: "Shorts", matches: (type) => type === "shorts" },
];

let currentFilterId = "videos";

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
      const type = getNotificationType(item);
      item.style.display = filter.matches(type) ? "" : "none";
    });

    const sectionStates = Array.from(menu.querySelectorAll(SELECTORS.notificationSection))
      .map((section) => getSectionState(section))
      .filter(Boolean);

    const visibleSectionCount = sectionStates.filter((state) => state.hasVisibleItems).length;
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
    const itemsContainer = section.querySelector(SELECTORS.notificationSectionItems);
    if (!title || !itemsContainer) {
      return null;
    }

    const hasVisibleItems = Array.from(itemsContainer.querySelectorAll(SELECTORS.notificationItem)).some(
      (item) => item.style.display !== "none"
    );

    return { title, hasVisibleItems };
  }

  function createFilterBar(menu) {
    const filterBar = document.createElement("chip-bar-view-model");
    filterBar.setAttribute(
      "class",
      `ytChipBarViewModelHost style-scope ytd-item-section-renderer style-scope ytd-sort-filter-header-renderer ${CLASSES.filterBar}`
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
    const menus = Array.from(document.querySelectorAll(SELECTORS.notificationMenu));
    menus.forEach((menu) => {
      ensureFilterBar(menu);
    });
  }

  const debouncedEnsureFilters = debounce(ensureFilters, 100);

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
