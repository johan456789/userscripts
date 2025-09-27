// ==UserScript==
// @name         Bilibili Disable Next/Prev Shortcuts
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Disable the [ and ] playlist navigation shortcuts on Bilibili while preserving Video Speed Controller shortcuts.
// @author       You
// @match        https://www.bilibili.com/*
// @run-at       document-start
// @license      MIT
// @noframes
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/bilibili-disable-next-prev-shortcuts.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/bilibili-disable-next-prev-shortcuts.js
// ==/UserScript==

const logger = Logger("[Bilibili-Disable-Next-Prev-Shortcuts]");
logger("Userscript started.");

(function () {
  "use strict";

  const KEYS_TO_HANDLE = new Set(["[", "]"]);

  function isEditableElement(element) {
    if (!element) return false;
    const tag = (element.tagName || "").toLowerCase();
    if (tag === "input") {
      const type = (element.type || "").toLowerCase();
      return (
        type !== "button" &&
        type !== "checkbox" &&
        type !== "radio" &&
        type !== "range" &&
        type !== "color"
      );
    }
    return tag === "textarea" || element.isContentEditable === true;
  }

  function clickMappedButton(key) {
    const controller = document.querySelector("vsc-controller");
    if (!controller) {
      logger("vsc-controller element not found; cannot forward shortcut.");
      return;
    }

    const shadowRoot = controller.shadowRoot;
    if (!shadowRoot) {
      logger("vsc-controller.shadowRoot not available yet.");
      return;
    }

    const controls = shadowRoot.querySelector("#controls");
    if (!controls) {
      logger("#controls not found inside vsc-controller shadow root.");
      return;
    }

    const action = key === "[" ? "slower" : "faster";
    const button = controls.querySelector(`button[data-action="${action}"]`);

    if (button) {
      button.click();
      logger(
        `Clicked mapped button for key "${key}" -> data-action="${action}"`
      );
    } else {
      logger(
        `Mapped button not found for key "${key}" -> data-action="${action}"`
      );
    }
  }

  function onKeyDown(e) {
    if (!KEYS_TO_HANDLE.has(e.key)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isEditableElement(e.target)) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    clickMappedButton(e.key);
  }

  document.addEventListener("keydown", onKeyDown, true);
  // Do not handle keypress/keyup to avoid duplicate clicks
})();
