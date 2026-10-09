// ==UserScript==
// @name         Auto Close Center Overlay
// @namespace    http://tampermonkey.net/
// @version      1.8.0
// @description  Auto-closes center overlay/popup modals on supported websites
// @author       You
// @match        https://shopee.tw/*
// @match        https://www.mobile01.com/*
// @match        https://mobile01.com/*
// @match        http://www.mobile01.com/*
// @match        http://mobile01.com/*
// @match        https://medium.com/*
// @match        https://uxdesign.cc/*
// @match        https://*.substack.com/*
// @match        https://*.a16z.news/*
// @match        https://*.udn.com/*
// @match        https://*.mirrormedia.mg/*
// @match        https://*.ltn.com.tw/*
// @match        https://www.techbang.com/*
// @match        https://techbang.com/*
// @run-at       document-start
// @grant        none
// @license      MIT
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/auto-close-center-overlay.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/auto-close-center-overlay.js
// ==/UserScript==

const logger = Logger("[Auto-Close-Overlay]");

/**
 * To add support for a new website, add an entry to this array with:
 *   match       - regex tested against window.location.hostname
 *   selectors   - array of CSS selectors for the close button(s); each is tried in order
 *   persistent  - if true, keeps monitoring to close recurring idle overlays (default false)
 * Selectors may include attribute conditions (e.g. [style*="block"]) so overlays that are
 * pre-rendered hidden and only toggled visible via inline style are only clicked when shown.
 * For overlays appended visible and later hidden via inline style, guard with
 * :not([style*="none"]) so hidden copies are skipped while they fade out.
 * For overlays shown by toggling a class (e.g. .show) on a pre-rendered element, guard with
 * that class and keep "class" in the observer's attributeFilter below.
 */
const SITES = [
  {
    match: /shopee\.tw/,
    selectors: ["#HomePagePopupBannerSection > div > div.e_KtkD.Xg_fY5 > div"],
  },
  {
    match: /mobile01\.com/,
    selectors: ["#idle_content > button"],
    persistent: true,
  },
  {
    match: /(medium\.com|uxdesign\.cc)/,
    selectors: ['button[data-testid="close-button"]'],
  },
  {
    match: /substack\.com/,
    selectors: [
      'div[role="dialog"][aria-label="Subscribe modal"] button[aria-label="close"]',
    ],
  },
  {
    match: /udn\.com/,
    selectors: [
      // Guard with body.idle-open: the section stays in the DOM even when the
      // idle overlay is closed, so without the guard this always matches.
      "body.idle-open > section.udn-idle .btn.close-btn",
      ".udn-privilege-modal.show .udn-privilege-close-button",
    ],
    persistent: true,
  },
  {
    match: /mirrormedia\.mg/,
    selectors: ['section[class*="idle-timeout-modal__Background"] .close'],
    persistent: true,
  },
  {
    match: /(^|\.)ltn\.com\.tw$/,
    selectors: [
      "div.softPush_notification > button.softPush_refuse",
      '#idle-notice[style*="block"] #lightbox-close',
    ],
    persistent: true,
  },
  {
    match: /(^|\.)techbang\.com$/,
    selectors: [
      '#idle-container:not([style*="none"]) #close-btn',
      '#idle-container:not([style*="none"]) #overlay',
    ],
    persistent: true,
  },
];

(function () {
  "use strict";

  const hostname = window.location.hostname;
  const site = SITES.find((s) => s.match.test(hostname));
  if (!site) {
    return;
  }

  const { selectors, persistent = false } = site;

  logger(
    `Monitoring for overlay${persistent ? " (persistent)" : ""}`,
  );

  function clickButton(el, sel) {
    logger(`Clicked close button: ${sel}`);
    el.click();
  }

  function findAndClick() {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        clickButton(el, sel);
        return true;
      }
    }
    return false;
  }

  function matchesAny() {
    return selectors.some((sel) => document.querySelector(sel));
  }

  const foundInitially = findAndClick();
  if (foundInitially && !persistent) return;

  let retryCount = 0;
  const MAX_RETRIES = 20;
  const RETRY_INTERVAL = 100;

  // Persistent sites: a single click can land before the site has bound its
  // own close handler (e.g. UDN re-renders the idle overlay with Vue just
  // before showing it), and no further DOM mutations may follow. Keep
  // retrying for a short window while the overlay is still visible.
  let persistentInterval = null;
  function startPersistentRetries() {
    if (persistentInterval) return;
    let tries = 0;
    persistentInterval = setInterval(() => {
      if (!matchesAny() || tries >= MAX_RETRIES) {
        clearInterval(persistentInterval);
        persistentInterval = null;
        return;
      }
      tries++;
      findAndClick();
    }, RETRY_INTERVAL);
  }

  const observer = new MutationObserver(() => {
    if (!matchesAny()) return;

    if (persistent) {
      findAndClick();
      startPersistentRetries();
      return;
    }

    if (retryCount > 0) return;

    observer.disconnect();

    const interval = setInterval(() => {
      retryCount++;
      if (retryCount > MAX_RETRIES) {
        clearInterval(interval);
        logger("Max retries reached, giving up");
        return;
      }
      if (!matchesAny()) {
        clearInterval(interval);
        return;
      }
      findAndClick();
    }, RETRY_INTERVAL);
  });

  // Observe `document` (not documentElement): at @run-at document-start the
  // <html> element may not exist yet, and observe(documentElement) throws.
  observer.observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class"],
  });
})();
