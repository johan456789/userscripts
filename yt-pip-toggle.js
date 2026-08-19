// ==UserScript==
// @name         YouTube PiP toggle button
// @namespace    http://tampermonkey.net/
// @version      1.1.0
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

  function buildPipIcon() {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "24");
    svg.setAttribute("height", "24");
    svg.style.display = "block";
    svg.style.margin = "auto";
    svg.style.transform = "scale(1.1)";

    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute(
      "d",
      "M21 3a2 2 0 012 2v14a2 2 0 01-2 2H3a2 2 0 01-2-2v-6h2v6h18V5H11V3h10Zm-19.707.293a1 1 0 000 1.414L5.586 9H3a1 1 0 000 2h6V5a1 1 0 00-2 0v2.586L2.707 3.293a1 1 0 00-1.414 0ZM19 11h-7a1 1 0 00-1 1v5a1 1 0 001 1h7a1 1 0 001-1v-5a1 1 0 00-1-1Zm-6 5v-3h5v3h-5Z"
    );
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
      updateButtonTitle(button);
    }
  }

  function updateButtonTitle(button) {
    if (!button) return;
    const inPip = document.pictureInPictureElement;
    const title = inPip ? "Exit Picture-in-Picture" : "Picture-in-Picture";
    button.setAttribute("title", title);
    button.setAttribute("aria-label", title);
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
    button.appendChild(buildPipIcon());
    updateButtonTitle(button);

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
    updateButtonTitle(document.getElementById(BUTTON_ID));
  });
  document.addEventListener("enterpictureinpicture", () => {
    updateButtonTitle(document.getElementById(BUTTON_ID));
  });
})();
