// ==UserScript==
// @name         Youtube exit full screen corner
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Adds an invisible bottom-right click area to send ESC and exit fullscreen
// @author       You
// @match        https://www.youtube.com/*
// @match        https://www.youtube-nocookie.com/*
// @run-at       document-start
// @grant        none
// @license      MIT
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/yt-exit-full-screen-corner.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/yt-exit-full-screen-corner.js
// ==/UserScript==

const logger = Logger("[yt-exit-full-screen-corner]");

(function () {
  "use strict";

  logger("Script started");

  const CLICK_AREA_ID = "yt-esc-corner";
  const CLICK_AREA_SIZE_PX = 64; // width/height of the click target for robustness

  function dispatchEscape() {
    try {
      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
    } catch (e) {
      // ignore
    }

    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }

  function ensureClickArea(container) {
    if (!container) return;

    // Ensure positioning so the absolute child anchors correctly.
    const computedPos = getComputedStyle(container).position;
    if (computedPos === "static") {
      container.style.position = "relative";
    }

    let area = container.querySelector(`#${CLICK_AREA_ID}`);
    if (area) return;

    area = document.createElement("div");
    area.id = CLICK_AREA_ID;
    area.style.position = "absolute";
    area.style.width = `${CLICK_AREA_SIZE_PX}px`;
    area.style.height = `${CLICK_AREA_SIZE_PX}px`;
    area.style.right = "0";
    area.style.bottom = "0";
    area.style.opacity = "0"; // invisible but clickable
    area.style.pointerEvents = "auto";
    area.style.zIndex = "2147483647"; // make sure it's on top
    area.addEventListener("click", (e) => {
      e.stopPropagation();
      dispatchEscape();
    });

    container.appendChild(area);
    logger("Added invisible ESC click area");
  }

  function tryAttach() {
    const container = document.querySelector("#player-container");
    if (container) {
      ensureClickArea(container);
      return true;
    }
    return false;
  }

  // Initial attempt ASAP
  tryAttach();

  // Observe DOM changes to handle SPA navigations and late mounts
  const observer = new MutationObserver(() => {
    tryAttach();
  });
  observer.observe(document.documentElement || document, {
    childList: true,
    subtree: true,
  });
})();


