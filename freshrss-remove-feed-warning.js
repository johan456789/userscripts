// ==UserScript==
// @name         FreshRSS Remove Feed Warning
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Removes the warning icons (::before pseudo-elements) from feed items in FreshRSS sidebar
// @author       You
// @match        https://freshrss.freshrss.orb.local/i/*
// @grant        none
// @run-at       document-start
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/freshrss-remove-feed-warning.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/freshrss-remove-feed-warning.js
// ==/UserScript==

(function () {
  "use strict";

  const logger = Logger("[FreshRSS-Remove-Feed-Warning]");
  const RULE = "#sidebar li span::before { content: none !important; }";

  function findWritableSheet(doc = document) {
    for (const s of Array.from(doc.styleSheets)) {
      try {
        void s.cssRules;
        if (!s.disabled) return s;
      } catch {}
    }
    return null;
  }

  // A) Try to inject via CSSOM (same-origin stylesheet)
  const sheet = findWritableSheet();
  if (sheet) {
    try {
      sheet.insertRule(RULE, sheet.cssRules.length);
      logger("Removed ::before via CSSOM insertRule");
      return;
    } catch (e) {
      logger.warn("insertRule failed:", e);
    }
  } else {
    logger.warn("No writable same-origin stylesheet found.");
  }

  // B) Patch an existing same-origin <link rel="stylesheet"> by replacing its href with a Blob URL
  const link = Array.from(
    document.querySelectorAll('link[rel="stylesheet"]')
  ).find((l) => {
    try {
      return new URL(l.href, location.href).origin === location.origin;
    } catch {
      return false;
    }
  });

  if (link) {
    fetch(link.href, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((css) => {
        const patched = `${css}\n/* override to remove ::before */\n${RULE}\n`;
        const blobURL = URL.createObjectURL(
          new Blob([patched], { type: "text/css" })
        );
        link.href = blobURL;
        logger("Removed ::before by patching same-origin stylesheet");
      })
      .catch((err) => {
        logger.error(
          "Could not patch stylesheet due to CSP or network:",
          err
        );
        logger(
          "If this still fails, use DevTools Sources > Overrides to edit a CSS file locally, or host an override.css on a CSP-allowed origin."
        );
      });
  } else {
    logger.error(
      "No same-origin stylesheet to patch. Use DevTools Overrides or an allowed external CSS."
    );
  }
})();
