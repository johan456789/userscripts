// ==UserScript==
// @name         Auto Close Center Overlay
// @namespace    http://tampermonkey.net/
// @version      1.3.0
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
// @match        https://*.udn.com/*
// @match        https://*.mirrormedia.mg/*
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
    selectors: ["body > section.udn-idle .btn.close-btn"],
    persistent: true,
  },
  {
    match: /mirrormedia\.mg/,
    selectors: ['section[class*="idle-timeout-modal__Background"] .close'],
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

  const foundInitially = findAndClick();
  if (foundInitially && !persistent) return;

  let retryCount = 0;
  const MAX_RETRIES = 20;
  const RETRY_INTERVAL = 100;

  const observer = new MutationObserver(() => {
    if (!document.querySelector(selectors[0])) return;

    if (persistent) {
      findAndClick();
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
      if (!document.querySelector(selectors[0])) {
        clearInterval(interval);
        return;
      }
      findAndClick();
    }, RETRY_INTERVAL);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
