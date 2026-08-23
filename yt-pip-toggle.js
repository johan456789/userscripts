// ==UserScript==
// @name         YouTube PiP toggle button
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Adds a Picture-in-Picture toggle button to the YouTube player controls
// @author       You
// @match        https://www.youtube.com/*
// @match        https://www.youtube-nocookie.com/*
// @run-at       document-end
// @grant        none
// @license      MIT
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/yt-pip-toggle.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/yt-pip-toggle.js
// ==/UserScript==

const logger = Logger("[yt-pip-toggle]");

(function () {
  "use strict";

  logger("Script started");

  const BUTTON_ID = "yt-pip-toggle-button";
  const SVG_NS = "http://www.w3.org/2000/svg";

  const PIP_OUT_ICON_PATH =
    "M21 3a2 2 0 012 2v14a2 2 0 01-2 2H3a2 2 0 01-2-2v-6h2v6h18V5H11V3h10Zm-19.707.293a1 1 0 000 1.414L5.586 9H3a1 1 0 000 2h6V5a1 1 0 00-2 0v2.586L2.707 3.293a1 1 0 00-1.414 0ZM19 11h-7a1 1 0 00-1 1v5a1 1 0 001 1h7a1 1 0 001-1v-5a1 1 0 00-1-1Zm-6 5v-3h5v3h-5Z";

  const PIP_IN_ICON_PATH =
    "M21.20 3.01C21.69 3.06 22.15 3.29 22.48 3.65C22.81 4.02 23.00 4.50 23 5V11H21V5H3V19H13V21H3L2.79 20.99C2.33 20.94 1.91 20.73 1.58 20.41C1.26 20.08 1.05 19.66 1.01 19.20L1 19V5C0.99 4.50 1.18 4.02 1.51 3.65C1.84 3.29 2.30 3.06 2.79 3.01L3 3H21L21.20 3.01ZM12.10 6.00L12 6H5L4.89 6.00C4.65 6.03 4.42 6.14 4.25 6.33C4.09 6.51 3.99 6.75 4 7V12L4.00 12.10C4.02 12.33 4.12 12.54 4.29 12.70C4.45 12.86 4.66 12.97 4.89 12.99L5 13H12L12.10 12.99C12.33 12.97 12.54 12.87 12.70 12.70C12.87 12.54 12.97 12.33 12.99 12.10L13 12V7C13.00 6.75 12.90 6.51 12.74 6.32C12.57 6.14 12.34 6.03 12.10 6.00ZM6 11V8H11V11H6ZM21 13H15V19C15 19.26 15.10 19.51 15.29 19.70C15.48 19.89 15.73 20 16 20C16.26 20 16.51 19.89 16.70 19.70C16.89 19.51 17 19.26 17 19V16.41L21.29 20.70C21.38 20.80 21.49 20.87 21.61 20.93C21.73 20.98 21.87 21.01 22.00 21.01C22.13 21.01 22.26 20.98 22.39 20.93C22.51 20.88 22.62 20.81 22.71 20.71C22.81 20.62 22.88 20.51 22.93 20.39C22.98 20.26 23.01 20.13 23.01 20.00C23.01 19.87 22.98 19.73 22.93 19.61C22.87 19.49 22.80 19.38 22.70 19.29L18.41 15H21C21.26 15 21.51 14.89 21.70 14.70C21.89 14.51 22 14.26 22 14C22 13.73 21.89 13.48 21.70 13.29C21.51 13.10 21.26 13 21 13Z";

  function buildPipIcon(pathData) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "24");
    svg.setAttribute("height", "24");
    svg.style.display = "block";
    svg.style.margin = "auto";
    svg.style.transform = "scale(1.1)";

    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", "#ffffff");
    svg.appendChild(path);
    return svg;
  }

  function isSupported() {
    return (
      typeof document !== "undefined" &&
      document.pictureInPictureEnabled === true &&
      !!HTMLVideoElement.prototype.requestPictureInPicture
    );
  }

  async function togglePip(button) {
    const video = document.querySelector("video");
    if (!video) {
      logger.warn("No <video> element found on the page");
      return;
    }

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        logger("Exited Picture-in-Picture");
      } else {
        await video.requestPictureInPicture();
        logger("Entered Picture-in-Picture");
      }
    } catch (error) {
      logger.error("Failed to toggle Picture-in-Picture:", error);
    } finally {
      syncButtonState(button);
    }
  }

  function syncButtonState(button) {
    if (!button) return;
    const inPip = !!document.pictureInPictureElement;
    const label = inPip ? "Exit Picture-in-Picture" : "Enter Picture-in-Picture";
    button.setAttribute("title", label);
    button.setAttribute("aria-label", label);

    const desiredPath = inPip ? PIP_IN_ICON_PATH : PIP_OUT_ICON_PATH;
    const path = button.querySelector("path");
    if (!path || path.getAttribute("d") !== desiredPath) {
      button.replaceChildren(buildPipIcon(desiredPath));
    }
  }

  function ensureButton() {
    if (document.getElementById(BUTTON_ID)) {
      return;
    }
    const controls = document.getElementsByClassName("ytp-right-controls")[0];
    if (!controls) {
      return;
    }

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.className = "ytp-button";
    button.style.cssFloat = "left";
    button.appendChild(buildPipIcon(PIP_OUT_ICON_PATH));
    syncButtonState(button);

    if (!isSupported()) {
      button.disabled = true;
      button.setAttribute(
        "title",
        "Picture-in-Picture is not supported in this browser"
      );
    }

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      togglePip(button);
    });

    controls.prepend(button);
    logger("Inserted PiP toggle button into ytp-right-controls");
  }

  ensureButton();

  const observer = new MutationObserver(() => {
    ensureButton();
  });
  observer.observe(document.documentElement || document, {
    childList: true,
    subtree: true,
  });

  document.addEventListener("leavepictureinpicture", () => {
    logger("Video left Picture-in-Picture");
    syncButtonState(document.getElementById(BUTTON_ID));
  });
  document.addEventListener("enterpictureinpicture", () => {
    logger("Video entered Picture-in-Picture");
    syncButtonState(document.getElementById(BUTTON_ID));
  });
})();
