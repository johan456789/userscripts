// ==UserScript==
// @name         Convert ROC date to ISO 8601
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Converts ROC format post dates (106/09/05) to ISO 8601 (2017-09-05) on supported sites.
// @match        https://scitechvista.nat.gov.tw/Article/*
// @run-at       document-end
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/convert-roc-date.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/convert-roc-date.js
// ==/UserScript==

(function () {
  "use strict";

  const logger = Logger("[Convert-ROC-Date]");

  const ROC_DATE_RE = /^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/;

  const SITES = [
    {
      host: "scitechvista.nat.gov.tw",
      dateSelector: ".DetailContent .kf-date",
    },
    // Add more sites here:
    // { host: "example.gov.tw", dateSelector: ".post-date" },
  ];

  function toIso(rocDate) {
    const match = ROC_DATE_RE.exec(rocDate.trim());
    if (!match) return null;
    const year = Number(match[1]) + 1911;
    const month = String(Number(match[2])).padStart(2, "0");
    const day = String(Number(match[3])).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function convert(site) {
    const el = document.querySelector(site.dateSelector);
    if (!el) {
      logger.warn("Post date element not found:", site.dateSelector);
      return;
    }
    const iso = toIso(el.textContent);
    if (!iso) {
      logger.warn("Not a ROC date:", el.textContent.trim());
      return;
    }
    el.textContent = iso;
    logger("Converted to", iso);
  }

  const site = SITES.find((s) => location.host === s.host);
  if (!site) {
    logger.warn("No site config for", location.host);
    return;
  }
  convert(site);
})();
