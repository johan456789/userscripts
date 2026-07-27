// ==UserScript==
// @name         YouTube PiP toggle button
// @namespace    http://tampermonkey.net/
// @version      1.0.0
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
    svg.style.transform = "scale(1.3333333)";

    const outer = document.createElementNS(SVG_NS, "rect");
    outer.setAttribute("x", "2");
    outer.setAttribute("y", "4");
    outer.setAttribute("width", "20");
    outer.setAttribute("height", "16");
    outer.setAttribute("rx", "2");
    outer.setAttribute("ry", "2");
    outer.setAttribute("fill", "none");
    outer.setAttribute("stroke", "#ffffff");
    outer.setAttribute("stroke-width", "1.6");
    outer.setAttribute("stroke-linejoin", "round");

    const inner = document.createElementNS(SVG_NS, "rect");
    inner.setAttribute("x", "13");
    inner.setAttribute("y", "13");
    inner.setAttribute("width", "7");
    inner.setAttribute("height", "5");
    inner.setAttribute("rx", "0.6");
    inner.setAttribute("ry", "0.6");
    inner.setAttribute("fill", "#ffffff");

    svg.appendChild(outer);
    svg.appendChild(inner);
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
