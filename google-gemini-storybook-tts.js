// ==UserScript==
// @name         Google Gemini Storybook TTS
// @namespace    http://tampermonkey.net/
// @version      0.2.6
// @description  Adds a play button above Gemini Storybook text to read current page with TTS
// @author       You
// @match        https://gemini.google.com/gem/storybook
// @match        https://gemini.google.com/gem/storybook/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      api.elevenlabs.io
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @require      https://github.com/johan456789/userscripts/raw/main/utils/debounce.js
// @require      https://cdn.jsdelivr.net/npm/idb-keyval@6.2.2/dist/umd.js
// ==/UserScript==

const logger = Logger("[gemini-storybook-tts]");

(function () {
  "use strict";

  logger("Script started");

  // Unique id/class markers to avoid duplicate insertions
  const BUTTON_CONTAINER_CLASS = "userscript-tts-button-container";
  const BUTTON_ID = "userscript-tts-play-btn";

  // Selector to locate all story text paragraphs (including hidden ones)
  // .hide is dynamically added/removed on the container; filtering happens later
  const STORY_TEXT_SELECTOR =
    "storybook > div > div.ng-star-inserted > storybook-page > div p.story-text";
  // Selector to locate the current story text paragraph (not hidden)
  const CURRENT_STORY_TEXT_SELECTOR =
    "storybook > div > div.ng-star-inserted:not(.hide) > storybook-page.right > div:not(.underneath) p.story-text";

  // Simple IndexedDB cache via idb-keyval (loaded via @require)
  const idb = typeof idbKeyval !== "undefined" ? idbKeyval : null;
  const idbGet = idb?.get?.bind(idb);
  const idbSet = idb?.set?.bind(idb);

  async function getCachedTTSItem(text) {
    if (!idbGet) return null;
    try {
      const item = await idbGet(text);
      if (item && item.audioBlob) {
        logger("Cache hit for TTS audio");
        return item;
      }
      logger("Cache miss for TTS audio");
      return null;
    } catch (err) {
      logger.warn("Cache get failed", err);
      return null;
    }
  }

  async function cacheTTSItem(text, audioBlob) {
    if (!idbSet) return;
    try {
      const item = { audioBlob, creationDate: Date.now() };
      await idbSet(text, item);
    } catch (err) {
      logger.warn("Cache set failed", err);
    }
  }

  function getElevenLabsApiKeyOrPrompt() {
    const ELEVEN_LABS_STORAGE_KEY = "gemini_storybook_tts_elevenlabs_api_key";
    let elevenLabsApiKey = GM_getValue(ELEVEN_LABS_STORAGE_KEY, "");

    if (!elevenLabsApiKey) {
      const userInput = prompt(
        "[gemini-storybook-tts] ElevenLabs API key not set. Please enter your ElevenLabs API key:",
        ""
      );
      if (userInput) {
        const trimmed = userInput.trim();
        if (trimmed) {
          elevenLabsApiKey = trimmed;
          GM_setValue(ELEVEN_LABS_STORAGE_KEY, elevenLabsApiKey);
          logger("Saved ElevenLabs API key");
        }
      }
    }
    if (!elevenLabsApiKey) {
      logger.warn("ElevenLabs API key missing. Aborting TTS request.");
      return null;
    }
    return elevenLabsApiKey;
  }

  async function requestTTS(text) {
    const cached = await getCachedTTSItem(text);
    if (cached?.audioBlob) {
      return cached.audioBlob;
    }

    const apiKey = getElevenLabsApiKeyOrPrompt();
    if (!apiKey) {
      logger.warn("ElevenLabs API key missing. Aborting TTS request.");
      return null;
    }
    const voiceId = "g10k86KeEUyBqW9lcKYg";
    const outputFormat = "mp3_44100_128";
    const modelId = "eleven_flash_v2_5"; // or eleven_multilingual_v2
    const languageCode = "es";
    const voiceSettings = {
      speed: 0.8,
    };

    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=${outputFormat}`;
    const payload = {
      text: text,
      model_id: modelId,
      language_code: languageCode,
      voice_settings: voiceSettings,
    };

    try {
      const { buffer, headers } = await new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "POST",
          url: endpoint,
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          data: JSON.stringify(payload),
          responseType: "arraybuffer",
          timeout: 15000,
          onload: (res) => {
            if (res.status >= 200 && res.status < 300 && res.response) {
              resolve({ buffer: res.response, headers: res.responseHeaders });
            } else {
              reject(
                new Error(
                  `TTS request failed with status ${res.status}: ${res.responseText}`
                )
              );
            }
          },
          onerror: (res) => {
            reject(new Error(`TTS request error: ${res?.status || "unknown"}`));
          },
          ontimeout: () => {
            reject(new Error("TTS request timed out"));
          },
        });
      });

      const contentTypeMatch = /content-type:\s*([^\n]+)/i.exec(headers || "");
      const blob = new Blob([buffer], {
        type: contentTypeMatch?.[1]?.trim() || "audio/mpeg",
      });
      cacheTTSItem(text, blob);
      return blob;
    } catch (err) {
      logger.error("TTS network error", err);
      return null;
    }
  }

  async function playTTS(audioBlob) {
    const url = URL.createObjectURL(audioBlob);
    const audio = new Audio(url);
    audio.addEventListener("ended", () => URL.revokeObjectURL(url));
    try {
      await audio.play();
    } catch (err) {
      logger.error("Audio playback failed", err);
    }
  }

  /**
   * Prevent left-clicks within a container while preserving hover/cursor behavior.
   * Optionally allow clicks within an exception element.
   * Uses capture phase to stop site handlers.
   * @param {HTMLElement} container
   * @param {HTMLElement|null} exceptionEl
   */
  function blockLeftClicks(container, exceptionEl) {
    if (!container || container.dataset.clickBlocked === "1") return;
    const handler = (e) => {
      if (e.button !== 0) return; // only left click
      const target = e.target;
      if (
        exceptionEl &&
        (target === exceptionEl || exceptionEl.contains(target))
      ) {
        return; // allow button to work
      }
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
    };
    container.addEventListener("click", handler, true);
    container.dataset.clickBlocked = "1";
  }

  /**
   * Finds the current visible story text element. Validates count as requested.
   * - If more than one, logs an error and uses the last one
   * - If zero, logs error and returns null
   * @returns {HTMLParagraphElement|null}
   */
  function findCurrentStoryText() {
    const nodes = document.querySelectorAll(CURRENT_STORY_TEXT_SELECTOR);
    if (nodes.length === 0) {
      logger.error("No story text found. Aborting insertion.");
      return null;
    }
    if (nodes.length > 1) {
      logger.warn(`Found ${nodes.length} story texts. Using the last one.`);
    }
    if (nodes.length !== 1) {
      logger(`Story text count: ${nodes.length}`);
    }
    const el = nodes[nodes.length - 1];
    if (!(el instanceof HTMLElement)) return null;
    return el;
  }

  /**
   * Creates the inline SVG play icon element.
   * @returns {SVGElement}
   */
  function createPlayIcon() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 640 640");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("aria-hidden", "true");

    const comment = document.createComment(
      "Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc."
    );
    svg.appendChild(comment);

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", "M187.2 100.9C174.8 94.1 159.8 94.4 147.6 101.6C135.4 108.8 128 121.9 128 136L128 504C128 518.1 135.5 531.2 147.6 538.4C159.7 545.6 174.8 545.9 187.2 539.1L523.2 355.1C536 348.1 544 334.6 544 320C544 305.4 536 291.9 523.2 284.9L187.2 100.9z");
    path.setAttribute("fill", "currentColor");

    svg.appendChild(path);
    return svg;
  }

  /**
   * Creates or updates the button container above the story text.
   * - Copies the parent container of the `p.story-text` as the base style
   * - Inserts a single button with an inline SVG icon and text "Listen"
   * - Avoids duplicates by checking for existing marker class
   * @param {HTMLElement} storyTextEl
   */
  function ensureButtonAboveStory(storyTextEl) {
    const paragraphContainer = storyTextEl.parentElement;
    if (!paragraphContainer) return;

    // If we've already inserted for this particular story text container, bail
    const existing = paragraphContainer.previousElementSibling;
    if (existing && existing.classList.contains(BUTTON_CONTAINER_CLASS)) {
      return; // Already inserted for this page
    }

    // Clone the parent container to match spacing and width
    const buttonContainer = paragraphContainer.cloneNode(false);
    buttonContainer.classList.add(BUTTON_CONTAINER_CLASS);

    // Clean out any residual classes that may affect layout undesirably
    buttonContainer.classList.remove("reached-end");

    // Build the button
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    // Basic styles to resemble Gemini button
    button.style.display = "inline-flex";
    button.style.alignItems = "center";
    button.style.gap = "8px";
    button.style.padding = "8px 14px";
    button.style.borderRadius = "10px";
    button.style.border = "none";
    button.style.background = "#0B57D0";
    button.style.color = "#fff";
    button.style.cursor = "pointer";
    button.style.fontWeight = "600";
    button.style.margin = "8px 0";

    const icon = createPlayIcon();
    const label = document.createElement("span");
    label.textContent = "Listen";

    button.appendChild(icon);
    button.appendChild(label);

    // Real TTS request
    button.addEventListener("click", async (e) => {
      e.stopPropagation();
      const storyText = storyTextEl.textContent?.trim();
      if (!storyText) {
        logger.warn("No story text found to convert to speech.");
        return;
      }
      const audioBlob = await requestTTS(storyText);
      if (!audioBlob) {
        return;
      }
      await playTTS(audioBlob);
    });

    buttonContainer.appendChild(button);

    // Insert immediately above the story text parent
    paragraphContainer.parentElement?.insertBefore(
      buttonContainer,
      paragraphContainer
    );
    logger("Inserted TTS button container above story text");

    // Disable left-clicks within both containers; allow clicks on our button
    blockLeftClicks(buttonContainer, button);
    blockLeftClicks(paragraphContainer, null);
  }

  /**
   * Core routine: find story text and ensure button exists for the current page.
   */
  function runOnce() {
    const allStoryTextEls = Array.from(
      document.querySelectorAll(STORY_TEXT_SELECTOR)
    );

    allStoryTextEls.forEach((el) => {
      ensureButtonAboveStory(el);
    });
  }

  const debouncedRunOnce = debounce(runOnce, 200);

  // Initial run after DOM is ready
  runOnce();

  // Observe page changes to re-insert when the visible page flips
  const observer = new MutationObserver(() => {
    debouncedRunOnce();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
  });
})();
