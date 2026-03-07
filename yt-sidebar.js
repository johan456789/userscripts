// ==UserScript==
// @name         YouTube Sidebar Shortcuts
// @description  Adds Watch Later and History shortcuts to YouTube's mini guide sidebar
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-end
// @noframes
// @version      0.1.2
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/yt-sidebar.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/yt-sidebar.js
// ==/UserScript==

const logger = Logger("[YT-sidebar]");
logger("Userscript started.");

const SELECTORS = {
  miniGuide: "#content > ytd-mini-guide-renderer",
  items: "#items",
  homeEntry: 'a#endpoint[title="Home"], a#endpoint[aria-label="Home"]',
  entry: "ytd-mini-guide-entry-renderer",
};

const ENTRY_ATTR = "data-yt-sidebar-shortcut";

const ICON_PATHS = {
  history:
    "M8.76 1.487a11 11 0 11-7.54 12.706 1 1 0 011.96-.4 9 9 0 0014.254 5.38A9 9 0 0016.79 4.38 9 9 0 004.518 7H7a1 1 0 010 2H1V3a1 1 0 012 0v2.678a11 11 0 015.76-4.192ZM12 6a1 1 0 00-1 1v5.58l.504.288 3.5 2a1 1 0 10.992-1.736L13 11.42V7a1 1 0 00-1-1Z",
  watchLater:
    "M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1Zm0 2a9 9 0 110 18.001A9 9 0 0112 3Zm0 3a1 1 0 00-1 1v5.565l.485.292 3.33 2a1 1 0 001.03-1.714L13 11.435V7a1 1 0 00-1-1Z",
};

const SHORTCUTS = [
  {
    id: "watch-later",
    label: "Watch Later",
    href: "/playlist?list=WL",
    iconPath: ICON_PATHS.watchLater,
  },
  {
    id: "history",
    label: "History",
    href: "/feed/history",
    iconPath: ICON_PATHS.history,
  },
];

function createIconShape(pathD) {
  const svgns = "http://www.w3.org/2000/svg";

  const shape = document.createElement("span");
  shape.className = "yt-icon-shape style-scope yt-icon ytSpecIconShapeHost";

  const container = document.createElement("div");
  container.style.cssText =
    "width: 100%; height: 100%; display: block; fill: currentcolor;";

  const svg = document.createElementNS(svgns, "svg");
  svg.setAttribute("xmlns", svgns);
  svg.setAttribute("height", "24");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "24");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText =
    "pointer-events: none; display: inherit; width: 100%; height: 100%;";

  const path = document.createElementNS(svgns, "path");
  path.setAttribute("d", pathD);

  svg.appendChild(path);
  container.appendChild(svg);
  shape.appendChild(container);

  return shape;
}

function findHomeEntry(items) {
  const homeEndpoint = items.querySelector(SELECTORS.homeEntry);
  if (homeEndpoint) {
    return homeEndpoint.closest(SELECTORS.entry);
  }

  return items.querySelector(SELECTORS.entry);
}

function buildShortcutEntry(baseEntry, shortcut) {
  const entry = baseEntry.cloneNode(true);
  entry.setAttribute(ENTRY_ATTR, shortcut.id);
  entry.removeAttribute("is-active");

  return entry;
}

function applyShortcutEntryState(entry, shortcut) {
  entry.removeAttribute("is-active");

  const endpoint = entry.querySelector("a#endpoint");
  if (!endpoint) {
    return;
  }

  endpoint.setAttribute("aria-selected", "false");
  endpoint.setAttribute("aria-label", shortcut.label);
  endpoint.setAttribute("title", shortcut.label);
  endpoint.setAttribute("href", shortcut.href);
  endpoint.href = shortcut.href;

  const title = entry.querySelector("span.title");
  if (title) {
    title.textContent = shortcut.label;
  }

  const tooltip = entry.querySelector("tp-yt-paper-tooltip #tooltip");
  if (tooltip) {
    tooltip.textContent = shortcut.label;
  }

  const allyButton = entry.querySelector("#ally-menu-button");
  if (allyButton) {
    allyButton.setAttribute("aria-label", shortcut.label);
  }
  if (allyButton?.parentElement) {
    allyButton.parentElement.setAttribute("hidden", "");
  }

  const icon = entry.querySelector("yt-icon#icon");
  if (icon) {
    const currentPath = icon.querySelector("path")?.getAttribute("d");
    if (currentPath !== shortcut.iconPath) {
      icon.replaceChildren(createIconShape(shortcut.iconPath));
    }
  }
}

function ensureShortcuts() {
  const miniGuide = document.querySelector(SELECTORS.miniGuide);
  if (!miniGuide) {
    return;
  }

  const items = miniGuide.querySelector(SELECTORS.items);
  if (!items) {
    return;
  }

  const homeEntry = findHomeEntry(items);
  if (!homeEntry) {
    return;
  }

  let insertionPoint = homeEntry;

  SHORTCUTS.forEach((shortcut) => {
    const selector = `${SELECTORS.entry}[${ENTRY_ATTR}="${shortcut.id}"]`;
    let entry = items.querySelector(selector);

    if (!entry) {
      entry = buildShortcutEntry(homeEntry, shortcut);
      logger(`Created sidebar shortcut: ${shortcut.label}`);
    }

    if (insertionPoint.nextElementSibling !== entry) {
      items.insertBefore(entry, insertionPoint.nextElementSibling);
    }

    applyShortcutEntryState(entry, shortcut);
    insertionPoint = entry;
  });
}

let rafId = null;

function scheduleEnsureShortcuts() {
  if (rafId !== null) {
    return;
  }

  rafId = requestAnimationFrame(() => {
    rafId = null;
    ensureShortcuts();
  });
}

(function init() {
  "use strict";

  scheduleEnsureShortcuts();

  const observer = new MutationObserver(() => {
    scheduleEnsureShortcuts();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  window.addEventListener("yt-navigate-finish", scheduleEnsureShortcuts, true);
  window.addEventListener("popstate", scheduleEnsureShortcuts, true);
})();
