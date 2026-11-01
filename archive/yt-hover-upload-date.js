// ==UserScript==
// @name         Youtube hover upload date
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Shows the YYYY-MM-DD upload date when hovering a relative date (e.g. "2d ago") on YouTube
// @author       You
// @match        https://www.youtube.com/*
// @run-at       document-idle
// @grant        none
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/yt-hover-upload-date.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/yt-hover-upload-date.js
// ==/UserScript==

const logger = Logger("[yt-hover-upload-date]");

(function () {
  "use strict";

  const HOVER_DELAY_MS = 250;
  const RELATIVE_DATE_RE = /^(?:(?:Streamed|Premiered)\s+)?\d+\s*[a-z]+\s+ago$/i;
  const VIDEO_LINK_SELECTOR = 'a[href*="/watch?v="], a[href*="/shorts/"]';
  const VIDEO_ID_RE = /(?:[?&]v=|\/shorts\/)([\w-]{11})/;
  const MAX_ANCESTOR_DEPTH = 12;

  /** videoId -> Promise<string | null> (YYYY-MM-DD) */
  const dateCache = new Map();

  let tooltip = null;
  let hoverTimer = null;
  let currentTarget = null;

  function getTooltip() {
    if (tooltip) return tooltip;
    tooltip = document.createElement("div");
    Object.assign(tooltip.style, {
      position: "fixed",
      zIndex: "99999",
      padding: "4px 8px",
      borderRadius: "4px",
      background: "rgba(97, 97, 97, 0.95)",
      color: "#fff",
      font: "500 12px Roboto, Arial, sans-serif",
      pointerEvents: "none",
      display: "none",
      whiteSpace: "nowrap",
    });
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function showTooltip(target, text) {
    const tip = getTooltip();
    tip.textContent = text;
    tip.style.display = "block";
    const rect = target.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const left = Math.min(
      Math.max(4, rect.left),
      window.innerWidth - tipRect.width - 4
    );
    const above = rect.top - tipRect.height - 6;
    const top = above >= 4 ? above : rect.bottom + 6;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  function hideTooltip() {
    if (tooltip) tooltip.style.display = "none";
  }

  /** Finds the video id of the card the relative date belongs to. */
  function findVideoId(el) {
    let node = el;
    for (let i = 0; node && i < MAX_ANCESTOR_DEPTH; i++) {
      if (node.tagName && node.tagName.toLowerCase().startsWith("ytd-comment")) {
        return null;
      }
      const link = node.querySelector && node.querySelector(VIDEO_LINK_SELECTOR);
      if (link) {
        const match = VIDEO_ID_RE.exec(link.getAttribute("href") || "");
        return match ? match[1] : null;
      }
      node = node.parentElement;
    }
    return null;
  }

  async function fetchUploadDate(videoId) {
    try {
      const ytcfg = window.ytcfg;
      const context = (ytcfg && ytcfg.get("INNERTUBE_CONTEXT")) || {
        client: {
          clientName: "WEB",
          clientVersion:
            (ytcfg && ytcfg.get("INNERTUBE_CLIENT_VERSION")) || "2.20240101.00.00",
        },
      };
      const res = await fetch("/youtubei/v1/player?prettyPrint=false", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, videoId }),
      });
      if (!res.ok) {
        logger.warn(`InnerTube player request failed: ${res.status}`);
        return null;
      }
      const data = await res.json();
      const micro = data.microformat && data.microformat.playerMicroformatRenderer;
      const raw = micro && (micro.publishDate || micro.uploadDate);
      const match = raw && /^(\d{4}-\d{2}-\d{2})/.exec(raw);
      return match ? match[1] : null;
    } catch (err) {
      logger.error(`Failed to fetch date for ${videoId}`, err);
      return null;
    }
  }

  function getUploadDate(videoId) {
    if (!dateCache.has(videoId)) {
      const promise = fetchUploadDate(videoId).then((date) => {
        if (!date) dateCache.delete(videoId); // allow retry later
        return date;
      });
      dateCache.set(videoId, promise);
    }
    return dateCache.get(videoId);
  }

  function isRelativeDate(el) {
    return (
      el.nodeType === Node.ELEMENT_NODE &&
      el.children.length === 0 &&
      RELATIVE_DATE_RE.test((el.textContent || "").trim())
    );
  }

  function onMouseOver(event) {
    const target = event.target;
    if (target === currentTarget || !isRelativeDate(target)) return;

    clearTimeout(hoverTimer);
    currentTarget = target;
    hoverTimer = setTimeout(async () => {
      const videoId = findVideoId(target);
      if (!videoId) return;
      const date = await getUploadDate(videoId);
      if (date && currentTarget === target) {
        showTooltip(target, date);
      }
    }, HOVER_DELAY_MS);
  }

  function onMouseOut(event) {
    if (event.target !== currentTarget) return;
    clearTimeout(hoverTimer);
    currentTarget = null;
    hideTooltip();
  }

  document.addEventListener("mouseover", onMouseOver, true);
  document.addEventListener("mouseout", onMouseOut, true);
  window.addEventListener("scroll", hideTooltip, true);

  logger("Script started");
})();
