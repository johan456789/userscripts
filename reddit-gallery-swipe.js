// ==UserScript==
// @name         Reddit Gallery Swipe
// @namespace    http://tampermonkey.net/
// @version      0.1.7
// @description  Add horizontal swipe support for photo carousels on Reddit mobile
// @include      *://reddit.com/*
// @include      *://*.reddit.com/*
// @match        https://www.reddit.com/*
// @match        https://reddit.com/*
// @match        https://*.reddit.com/*
// @run-at       document-end
// @noframes
// @grant        none
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL    https://github.com/johan456789/userscripts/raw/refs/heads/main/reddit-gallery-swipe.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/refs/heads/main/reddit-gallery-swipe.js
// ==/UserScript==

(function () {
  "use strict";

  const logger = Logger("[Reddit-Gallery-Swipe]");
  const GALLERY_SELECTOR = "gallery-carousel";
  const PROCESSED_ATTR = "data-swipe-enabled";
  const SWIPE_THRESHOLD_PX = 40;
  const SWIPE_THRESHOLD_RATIO = 0.12;
  const MAX_VERTICAL_DEVIATION = 80;
  const RESCAN_INTERVAL_MS = 2000;
  const SWIPE_COOLDOWN_MS = 700;

  logger("Userscript started.");

  function getNavButtons(carousel) {
    // Gallery structure: gallery-carousel (shadow) -> faceplate-carousel -> [slot="prevButton"]/nextButton
    // Buttons are light-DOM children of faceplate-carousel inside gallery-carousel's shadowRoot
    let prevBtn = null;
    let nextBtn = null;

    const shadow = carousel.shadowRoot;
    if (shadow) {
      const faceplate = shadow.querySelector("faceplate-carousel");
      if (faceplate) {
        // Try direct slot query
        prevBtn =
          faceplate.querySelector('[slot="prevButton"] button') ||
          faceplate.querySelector('button[aria-label="Previous page"]');
        nextBtn =
          faceplate.querySelector('[slot="nextButton"] button') ||
          faceplate.querySelector('button[aria-label="Next page"]');

        // Fallback: query inside faceplate shadow (distributed slots)
        if (!prevBtn && faceplate.shadowRoot) {
          prevBtn = faceplate.shadowRoot.querySelector(
            'slot[name="prevButton"]',
          );
          // slot itself is not the button, need assigned elements
          if (prevBtn && prevBtn.assignedElements) {
            const assigned = prevBtn.assignedElements({ flatten: true });
            for (const el of assigned) {
              const btn = el.querySelector
                ? el.querySelector("button")
                : null;
              if (btn) {
                prevBtn = btn;
                break;
              }
              if (el.tagName === "BUTTON") {
                prevBtn = el;
                break;
              }
            }
            if (prevBtn && prevBtn.tagName !== "BUTTON") prevBtn = null;
          }
        }
        if (!nextBtn && faceplate.shadowRoot) {
          nextBtn = faceplate.shadowRoot.querySelector(
            'slot[name="nextButton"]',
          );
          if (nextBtn && nextBtn.assignedElements) {
            const assigned = nextBtn.assignedElements({ flatten: true });
            for (const el of assigned) {
              const btn = el.querySelector
                ? el.querySelector("button")
                : null;
              if (btn) {
                nextBtn = btn;
                break;
              }
              if (el.tagName === "BUTTON") {
                nextBtn = el;
                break;
              }
            }
            if (nextBtn && nextBtn.tagName !== "BUTTON") nextBtn = null;
          }
        }
      }

      // Ultimate fallback: any button with aria-label inside shadow tree
      if (!prevBtn) {
        prevBtn = shadow.querySelector('button[aria-label="Previous page"]');
      }
      if (!nextBtn) {
        nextBtn = shadow.querySelector('button[aria-label="Next page"]');
      }
    }

    // Light DOM fallback (if Reddit moves buttons out of shadow)
    if (!prevBtn) {
      prevBtn = carousel.querySelector(
        '[slot="prevButton"] button, button[aria-label="Previous page"]',
      );
    }
    if (!nextBtn) {
      nextBtn = carousel.querySelector(
        '[slot="nextButton"] button, button[aria-label="Next page"]',
      );
    }

    // Last resort: search entire carousel subtree (shadow-inclusive search)
    if (!prevBtn || !nextBtn) {
      const allButtons = carousel.querySelectorAll
        ? carousel.querySelectorAll("button")
        : [];
      for (const btn of allButtons) {
        const label = btn.getAttribute("aria-label") || "";
        if (!prevBtn && label.includes("Previous")) prevBtn = btn;
        if (!nextBtn && label.includes("Next")) nextBtn = btn;
      }
    }

    return { prevBtn, nextBtn };
  }

  function isButtonDisabled(btn) {
    if (!btn) return true;
    if (btn.hasAttribute("disabled")) return true;
    if (btn.getAttribute("aria-disabled") === "true") return true;
    // Also check parent span disabled state
    return false;
  }

  function getThreshold(carousel) {
    const width = carousel.clientWidth || 380;
    return Math.max(SWIPE_THRESHOLD_PX, width * SWIPE_THRESHOLD_RATIO);
  }

  function attachSwipe(carousel) {
    if (!carousel || carousel.getAttribute(PROCESSED_ATTR) === "true") {
      return;
    }

    // Ensure we have a valid carousel with images
    const ul = carousel.querySelector("ul");
    if (!ul) {
      // Shadow may not have rendered yet, retry later
      return;
    }

    // Also ensure faceplate is ready (buttons exist in shadow)
    const shadow = carousel.shadowRoot;
    const faceplate = shadow ? shadow.querySelector("faceplate-carousel") : null;
    if (!faceplate) {
      return;
    }

    carousel.setAttribute(PROCESSED_ATTR, "true");

    // Allow vertical pan, we handle horizontal - set on all descendants to ensure move events fire
    const setPanY = (el) => {
      try {
        if (el) el.style.touchAction = "pan-y";
      } catch (_) {}
    };
    setPanY(carousel);
    setPanY(ul);
    try {
      const cw = faceplate.shadowRoot
        ? faceplate.shadowRoot.querySelector("#carousel-window")
        : null;
      setPanY(cw);
      const cl = faceplate.shadowRoot
        ? faceplate.shadowRoot.querySelector("#carousel-list")
        : null;
      setPanY(cl);
      const lis = carousel.querySelectorAll("li, img, figure");
      lis.forEach(setPanY);
    } catch (_) {}

    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let currentY = 0;
    let isTracking = false;
    let isHorizontal = false;
    let hasMoved = false;
    let lastSwipeTime = 0;

    function handleStart(clientX, clientY, src) {
      const now = Date.now();
      if (isTracking) {
        logger(`touchstart ${src} ignored: already tracking`);
        return;
      }
      if (now - lastSwipeTime < SWIPE_COOLDOWN_MS) {
        logger(`touchstart ${src} ignored: cooldown ${SWIPE_COOLDOWN_MS - (now - lastSwipeTime)}ms left`);
        return;
      }
      startX = clientX;
      startY = clientY;
      currentX = clientX;
      currentY = clientY;
      isTracking = true;
      isHorizontal = false;
      hasMoved = false;
      logger(`touchstart ${src} at ${Math.round(clientX)},${Math.round(clientY)}`);
    }

    function handleMove(clientX, clientY, e, src) {
      if (!isTracking) return;
      currentX = clientX;
      currentY = clientY;
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;

      if (!hasMoved) {
        if (Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) return;
        hasMoved = true;
        isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
        logger(
          `gesture classified as ${isHorizontal ? "horizontal" : "vertical"} deltaX=${Math.round(deltaX)} deltaY=${Math.round(deltaY)}`,
        );
      }

      if (isHorizontal) {
        if (e) {
          try {
            if (e.cancelable) e.preventDefault();
            // Stop faceplate-carousel's own touch recognizer from handling this gesture
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          } catch (_) {}
        }
      } else {
        if (Math.abs(deltaY) > MAX_VERTICAL_DEVIATION) {
          logger("aborting swipe: vertical scroll");
          isTracking = false;
        }
      }
    }

    function handleEnd(src, rawEvent) {
      if (!isTracking) {
        logger(`touchend ${src} ignored: not tracking (hasMoved=${hasMoved} isHorizontal=${isHorizontal})`);
        return;
      }
      isTracking = false;
      // Cleanup window listeners
      try {
        window.removeEventListener("touchmove", onWindowTouchMove);
        window.removeEventListener("touchend", onWindowTouchEnd);
        window.removeEventListener("touchcancel", onWindowTouchCancel);
        window.removeEventListener("pointermove", onWindowPointerMove);
        window.removeEventListener("pointerup", onWindowPointerUp);
      } catch (_) {}

      // Fix: touchmove may not have fired (see logs: deltaX -264 but hasMoved=false)
      // Classify on end using final delta if move was missed
      if (!hasMoved) {
        const dx = currentX - startX;
        const dy = currentY - startY;
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
          logger(`touchend ${src} hasMoved=${hasMoved} isHorizontal=${isHorizontal} deltaX=${Math.round(dx)} deltaY=${Math.round(dy)} - no movement`);
          logger("swipe ignored: not horizontal or no movement");
          return;
        }
        hasMoved = true;
        isHorizontal = Math.abs(dx) > Math.abs(dy);
        logger(
          `touchend ${src} classified-late as ${isHorizontal ? "horizontal" : "vertical"} deltaX=${Math.round(dx)} deltaY=${Math.round(dy)}`,
        );
      }

      logger(
        `touchend ${src} hasMoved=${hasMoved} isHorizontal=${isHorizontal} deltaX=${Math.round(currentX - startX)} deltaY=${Math.round(currentY - startY)}`,
      );

      if (!isHorizontal) {
        logger("swipe ignored: not horizontal or no movement");
        return;
      }

      // Prevent faceplate's touch recognizer from also handling this horizontal swipe
      if (rawEvent) {
        try {
          if (rawEvent.cancelable) rawEvent.preventDefault();
          rawEvent.stopPropagation();
          if (rawEvent.stopImmediatePropagation) rawEvent.stopImmediatePropagation();
        } catch (_) {}
      }

      const deltaX = currentX - startX;
      const threshold = getThreshold(carousel);

      if (Math.abs(deltaX) < threshold) {
        logger(
          `Swipe ignored: delta ${Math.round(deltaX)}px < threshold ${Math.round(threshold)}px`,
        );
        return;
      }

      const { prevBtn, nextBtn } = getNavButtons(carousel);
      logger(
        `buttons found prev=${!!prevBtn} next=${!!nextBtn} prevDisabled=${isButtonDisabled(prevBtn)} nextDisabled=${isButtonDisabled(nextBtn)}`,
      );

      if (deltaX < 0) {
        if (isButtonDisabled(nextBtn)) {
          logger("Swipe left ignored: next button disabled (last page)");
          return;
        }
        logger("Swipe left -> next");
        nextBtn.click();
      } else {
        if (isButtonDisabled(prevBtn)) {
          logger("Swipe right ignored: prev button disabled (first page)");
          return;
        }
        logger("Swipe right -> prev");
        prevBtn.click();
      }
    }

    // Window-level move/end to guarantee we capture despite target mismatch
    function onWindowTouchMove(e) {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      handleMove(t.clientX, t.clientY, e, "touch-window");
    }
    function onWindowTouchEnd(e) {
      if (e.changedTouches && e.changedTouches.length === 1) {
        const t = e.changedTouches[0];
        currentX = t.clientX;
        currentY = t.clientY;
      }
      handleEnd("touch-window", e);
    }
    function onWindowTouchCancel() {
      logger("touchcancel window");
      isTracking = false;
      hasMoved = false;
      isHorizontal = false;
      try {
        window.removeEventListener("touchmove", onWindowTouchMove);
        window.removeEventListener("touchend", onWindowTouchEnd);
        window.removeEventListener("touchcancel", onWindowTouchCancel);
      } catch (_) {}
    }
    function onWindowPointerMove(e) {
      if (!isTracking) return;
      handleMove(e.clientX, e.clientY, e, `pointer-window-${e.pointerType}`);
    }
    function onWindowPointerUp(e) {
      currentX = e.clientX;
      currentY = e.clientY;
      handleEnd(`pointer-window-${e.pointerType}`, e);
    }

    function onTouchStart(e) {
      // faceplate-carousel has its own touch recognizer; use only this handler
      try {
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      } catch (_) {}
      if (e.touches.length !== 1) {
        logger(`touchstart ignored: touches=${e.touches.length}`);
        return;
      }
      const t = e.touches[0];
      handleStart(t.clientX, t.clientY, "touch");
      // Register window listeners to catch move/end even if not bubbling to original target
      window.addEventListener("touchmove", onWindowTouchMove, { passive: false });
      window.addEventListener("touchend", onWindowTouchEnd, { passive: true });
      window.addEventListener("touchcancel", onWindowTouchCancel, { passive: true });
      window.addEventListener("pointermove", onWindowPointerMove, { passive: true });
      window.addEventListener("pointerup", onWindowPointerUp, { passive: true });
    }

    function onTouchMove(e) {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      handleMove(t.clientX, t.clientY, e, "touch");
    }

    function onTouchEnd(e) {
      if (e.changedTouches && e.changedTouches.length === 1) {
        const t = e.changedTouches[0];
        currentX = t.clientX;
        currentY = t.clientY;
      }
      handleEnd("touch", e);
    }

    function onTouchCancel() {
      logger("touchcancel");
      isTracking = false;
      hasMoved = false;
      isHorizontal = false;
      try {
        window.removeEventListener("touchmove", onWindowTouchMove);
        window.removeEventListener("touchend", onWindowTouchEnd);
        window.removeEventListener("touchcancel", onWindowTouchCancel);
      } catch (_) {}
    }

    // Pointer events fallback (for desktop drag testing and some mobile browsers)
    // Don't ignore touch pointerType - some browsers fire pointer instead of touch
    function onPointerDown(e) {
      if (e.button !== 0) return;
      // If already tracking via touch, ignore duplicate pointer
      if (isTracking) {
        logger(`pointerdown ${e.pointerType} ignored: already tracking`);
        return;
      }
      handleStart(e.clientX, e.clientY, `pointer-${e.pointerType}`);
      window.addEventListener("pointermove", onWindowPointerMove, { passive: true });
      window.addEventListener("pointerup", onWindowPointerUp, { passive: true });
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
    function onPointerMove(e) {
      if (!isTracking) return;
      handleMove(e.clientX, e.clientY, e, `pointer-${e.pointerType}`);
    }
    function onPointerUp(e) {
      if (e.changedTouches) return;
      currentX = e.clientX;
      currentY = e.clientY;
      handleEnd(`pointer-${e.pointerType}`, e);
    }

    // Attach only to carousel host to avoid duplicate bubbling (all slotted touches bubble to host)
    // Keep ul as secondary target for hit testing where host may have zero height on some viewports
    const targets = [carousel];
    // Only add ul if it's not the same element
    if (ul && ul !== carousel) targets.push(ul);

    for (const target of targets) {
      // Use capture to intercept before faceplate's own handlers
      target.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
      target.addEventListener("touchmove", onTouchMove, { passive: false, capture: true });
      target.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
      target.addEventListener("touchcancel", onTouchCancel, { passive: true, capture: true });
      target.addEventListener("pointerdown", onPointerDown, { passive: true, capture: true });
      target.addEventListener("pointermove", onPointerMove, { passive: true, capture: true });
      target.addEventListener("pointerup", onPointerUp, { passive: true, capture: true });
      target.addEventListener("pointercancel", onTouchCancel, { passive: true, capture: true });
    }

    logger(
      `Swipe attached to gallery ${carousel.getAttribute("post-id") || ""} on ${targets.length} targets`,
    );
  }

  function scanDocument() {
    const carousels = document.querySelectorAll(GALLERY_SELECTOR);
    carousels.forEach(attachSwipe);
  }

  function processNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

    if (node.matches && node.matches(GALLERY_SELECTOR)) {
      attachSwipe(node);
    }

    // Check descendants
    const carousels = node.querySelectorAll
      ? node.querySelectorAll(GALLERY_SELECTOR)
      : [];
    carousels.forEach(attachSwipe);

    // Shadow-inclusive: if node is inside a gallery-carousel's shadow, the UL may have been added
    // Also handle shreddit-post that contains gallery-carousel
    if (node.tagName === "SHREDDIT-POST" || node.tagName === "SHREDDIT-ASYNC-LOADER") {
      const nested = node.querySelectorAll
        ? node.querySelectorAll(GALLERY_SELECTOR)
        : [];
      nested.forEach(attachSwipe);
    }
  }

  function start() {
    if (!document.body) {
      logger.warn("document.body not ready; retrying start.");
      window.setTimeout(start, 100);
      return;
    }

    scanDocument();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          processNode(node);
        }
        // Also handle cases where gallery-carousel's UL is added asynchronously
        if (
          mutation.target &&
          mutation.target.nodeType === Node.ELEMENT_NODE &&
          mutation.target.matches &&
          mutation.target.matches(GALLERY_SELECTOR)
        ) {
          attachSwipe(mutation.target);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.setInterval(scanDocument, RESCAN_INTERVAL_MS);
    logger("Observer and rescan loop attached.");
  }

  start();
})();
