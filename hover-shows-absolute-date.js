// ==UserScript==
// @name         Hover Shows Absolute Date
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Shows the absolute date and time (YYYY-MM-DD HH:MM) when hovering a relative date (e.g. "2d ago") on supported websites
// @author       You
// @match        https://www.youtube.com/*
// @match        https://github.com/*
// @run-at       document-idle
// @grant        none
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/hover-shows-absolute-date.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/hover-shows-absolute-date.js
// ==/UserScript==

const logger = Logger("[hover-shows-absolute-date]");

(function () {
  "use strict";

  const HOVER_DELAY_MS = 250;

  /**
   * Formats a date string as "YYYY-MM-DD HH:MM" in the local timezone.
   * Date-only strings (no time available) are returned as "YYYY-MM-DD".
   */
  function formatLocalDateTime(value) {
    if (!value) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    const pad = (n) => String(n).padStart(2, "0");
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      ` ${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
  }

  // ---------------------------------------------------------------------------
  // YouTube: the page only has "2d ago", so look the date up via InnerTube.
  // ---------------------------------------------------------------------------
  const YT_RELATIVE_DATE_RE =
    /^(?:(?:Streamed|Premiered)\s+)?\d+\s*[a-z]+\s+ago$/i;
  const YT_VIDEO_LINK_SELECTOR = 'a[href*="/watch?v="], a[href*="/shorts/"]';
  const YT_VIDEO_ID_RE = /(?:[?&]v=|\/shorts\/)([\w-]{11})/;
  const YT_MAX_ANCESTOR_DEPTH = 12;

  /** videoId -> Promise<string | null> (YYYY-MM-DD HH:MM) */
  const ytDateCache = new Map();

  /** Finds the video id of the card the relative date belongs to. */
  function ytFindVideoId(el) {
    let node = el;
    for (let i = 0; node && i < YT_MAX_ANCESTOR_DEPTH; i++) {
      if (node.tagName && node.tagName.toLowerCase().startsWith("ytd-comment")) {
        return null;
      }
      const link = node.querySelector && node.querySelector(YT_VIDEO_LINK_SELECTOR);
      if (link) {
        const match = YT_VIDEO_ID_RE.exec(link.getAttribute("href") || "");
        return match ? match[1] : null;
      }
      node = node.parentElement;
    }
    return null;
  }

  async function ytFetchUploadDate(videoId) {
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
      return formatLocalDateTime(raw);
    } catch (err) {
      logger.error(`Failed to fetch date for ${videoId}`, err);
      return null;
    }
  }

  function ytGetUploadDate(videoId) {
    if (!ytDateCache.has(videoId)) {
      const promise = ytFetchUploadDate(videoId).then((date) => {
        if (!date) ytDateCache.delete(videoId); // allow retry later
        return date;
      });
      ytDateCache.set(videoId, promise);
    }
    return ytDateCache.get(videoId);
  }

  // ---------------------------------------------------------------------------
  // Sites
  // ---------------------------------------------------------------------------
  /**
   * To add support for a new website, add an entry to this array with:
   *   match        - regex tested against window.location.hostname
   *   findTarget   - (el) => the element showing the relative date, or null
   *   getDate      - (target) => "YYYY-MM-DD HH:MM" string (or Promise of one), or null;
   *                  use formatLocalDateTime(), which drops the time if unavailable
   *   suppressTitle - if true, the target's native `title` tooltip is removed
   *                   while hovered so it does not stack with ours
   * Remember to also add an @match line in the header.
   */
  const SITES = [
    {
      match: /(^|\.)youtube\.com$/,
      findTarget: (el) =>
        el.children.length === 0 &&
        YT_RELATIVE_DATE_RE.test((el.textContent || "").trim())
          ? el
          : null,
      getDate: (target) => {
        const videoId = ytFindVideoId(target);
        return videoId ? ytGetUploadDate(videoId) : null;
      },
    },
    {
      match: /^github\.com$/,
      // <relative-time datetime="..."> keeps its text in a shadow root, so
      // events are retargeted to the host element.
      findTarget: (el) => el.closest("relative-time, time-ago"),
      getDate: (target) => formatLocalDateTime(target.getAttribute("datetime")),
      suppressTitle: true,
    },
  ];

  const site = SITES.find((s) => s.match.test(window.location.hostname));
  if (!site) {
    logger(`No handler for ${window.location.hostname}`);
    return;
  }

  // ---------------------------------------------------------------------------
  // Tooltip + hover handling (shared)
  // ---------------------------------------------------------------------------
  let tooltip = null;
  let hoverTimer = null;
  let currentTarget = null;
  let stashedTitle = null;

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

  function stashTitle(target) {
    if (!site.suppressTitle || !target.hasAttribute("title")) return;
    stashedTitle = { target, title: target.getAttribute("title") };
    target.removeAttribute("title");
  }

  function restoreTitle() {
    if (!stashedTitle) return;
    const { target, title } = stashedTitle;
    if (!target.hasAttribute("title")) target.setAttribute("title", title);
    stashedTitle = null;
  }

  function onMouseOver(event) {
    const target = event.target.nodeType === Node.ELEMENT_NODE
      ? site.findTarget(event.target)
      : null;
    if (!target || target === currentTarget) return;

    clearTimeout(hoverTimer);
    restoreTitle();
    currentTarget = target;
    stashTitle(target);
    hoverTimer = setTimeout(async () => {
      const date = await site.getDate(target);
      if (date && currentTarget === target) {
        showTooltip(target, date);
      }
    }, HOVER_DELAY_MS);
  }

  function onMouseOut(event) {
    if (!currentTarget || !currentTarget.contains(event.target)) return;
    if (currentTarget.contains(event.relatedTarget)) return;
    clearTimeout(hoverTimer);
    restoreTitle();
    currentTarget = null;
    hideTooltip();
  }

  document.addEventListener("mouseover", onMouseOver, true);
  document.addEventListener("mouseout", onMouseOut, true);
  window.addEventListener("scroll", hideTooltip, true);

  logger("Script started");
})();
