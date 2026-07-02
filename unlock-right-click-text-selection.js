// ==UserScript==
// @name         Unlock Right-Click & Text Selection
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Unlock right-click menu and text selection on websites that block them
// @author       You
// @match        https://*.pixnet.net/*
// @match        https://www.granitefirm.com/*
// @match        https://blog.udn.com/*
// @match        https://kgbestate.com/*
// @run-at       document-start
// @grant        none
// @license      MIT
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/unlock-right-click-text-selection.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/unlock-right-click-text-selection.js
// ==/UserScript==

(function () {
  "use strict";

  const logger = Logger("[Unlock-Right-Click]");

  const EVENTS = [
    "contextmenu", "click", "mousedown", "mouseup",
    "selectstart", "copy", "cut", "paste", "dragstart",
    "keydown", "keyup",
  ];
  const liberated = {};
  for (const e of EVENTS) liberated[e] = true;

  // ── 1. Accessor-lock Event.prototype methods ──────────────────────────
  // Getter returns a type-filtered no-op for liberated events; setter is a
  // no-op so the site's periodic `Event.prototype.preventDefault = native`
  // re-assignment is silently ignored.  Installed at document-start, before
  // the site's own scripts run, so the site cannot save a pristine native
  // reference that bypasses the lock.
  const locked = {
    preventDefault: 1,
    stopPropagation: 1,
    stopImmediatePropagation: 1,
  };

  function lockMethod(name) {
    const orig = Event.prototype[name];
    try {
      Object.defineProperty(Event.prototype, name, {
        configurable: true,
        get() {
          return function () {
            if (liberated[this.type]) return;
            return orig.call(this);
          };
        },
        set() {},
      });
    } catch (e) {
      Event.prototype[name] = function () {
        if (liberated[this.type]) return;
        return orig.call(this);
      };
    }
  }

  lockMethod("preventDefault");
  lockMethod("stopPropagation");
  lockMethod("stopImmediatePropagation");

  // ── 2. Guard Object.defineProperty ────────────────────────────────────
  // Prevent the site from re-defining locked methods via defineProperty.
  const _defineProperty = Object.defineProperty;
  try {
    Object.defineProperty = function (obj, prop, desc) {
      if (obj === Event.prototype && prop in locked) return obj;
      return _defineProperty.call(Object, obj, prop, desc);
    };
  } catch (e) {}

  // ── 3. Capture-phase sweep: null inline on* handlers on the event path ─
  function removeInlineHandlerFor(eventType) {
    const onProp = "on" + eventType;
    window.addEventListener(
      eventType,
      function (e) {
        for (let node = e.target; node; node = node.parentNode) {
          try { node[onProp] = null; } catch (_) {}
          try { node.removeAttribute(onProp); } catch (_) {}
        }
      },
      true
    );
    try { window[onProp] = null; } catch (_) {}
    try { document[onProp] = null; } catch (_) {}
    try { if (document.documentElement) document.documentElement[onProp] = null; } catch (_) {}
    try { if (document.body) document.body[onProp] = null; } catch (_) {}
  }

  for (const e of EVENTS) removeInlineHandlerFor(e);

  // ── 4. Protect text selection ─────────────────────────────────────────
  // Neutralize selection-clearing methods so the site can't wipe your
  // selection on mouseup / selectstart.
  try { Selection.prototype.removeAllRanges = function () {}; } catch (e) {}
  try { Selection.prototype.empty = function () {}; } catch (e) {}

  // ── 5. Force user-select via CSS ──────────────────────────────────────
  function injectUserSelectCSS() {
    const style = document.createElement("style");
    style.setAttribute("data-unlock-rc", "true");
    style.textContent = `
      * {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  injectUserSelectCSS();

  // ── 6. Per-element inline user-select + strip html/body handlers ───────
  // These need <body>, so defer until DOM is ready.
  function onDOMReady() {
    for (const e of EVENTS) {
      const onProp = "on" + e;
      try { document.documentElement[onProp] = null; } catch (_) {}
      try { document.documentElement.removeAttribute(onProp); } catch (_) {}
      try { if (document.body) document.body[onProp] = null; } catch (_) {}
      try { if (document.body) document.body.removeAttribute(onProp); } catch (_) {}
    }

    // Per-element inline override beats inline user-select:none !important
    try {
      const all = document.querySelectorAll("*");
      for (let i = 0; i < all.length; i++) {
        all[i].style.setProperty("user-select", "text", "important");
        all[i].style.setProperty("-webkit-user-select", "text", "important");
      }
    } catch (e) {}

    logger("DOM ready — inline handlers stripped, user-select applied");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onDOMReady, { once: true });
  } else {
    onDOMReady();
  }

  logger("v2.0.0 applied (accessor-lock + sweep + selection protection + CSS)");
})();
