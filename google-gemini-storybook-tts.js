// ==UserScript==
// @name         Google Gemini Storybook TTS
// @namespace    http://tampermonkey.net/
// @version      0.3.2
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
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/google-gemini-storybook-tts.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/google-gemini-storybook-tts.js
// ==/UserScript==

const logger = Logger("[gemini-storybook-tts]");

(function () {
  "use strict";

  logger("Script started");

  // Unique id/class markers to avoid duplicate insertions
  const BUTTON_CONTAINER_CLASS = "userscript-tts-button-container";
  const BUTTON_ID = "userscript-tts-play-btn";

  // Global state for audio playback
  let currentAudio = null;
  let currentButton = null;
  let currentAudioUrl = null;

  const PLAY_ICON_SVG =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" aria-hidden="true"><!--Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M187.2 100.9C174.8 94.1 159.8 94.4 147.6 101.6C135.4 108.8 128 121.9 128 136L128 504C128 518.1 135.5 531.2 147.6 538.4C159.7 545.6 174.8 545.9 187.2 539.1L523.2 355.1C536 348.1 544 334.6 544 320C544 305.4 536 291.9 523.2 284.9L187.2 100.9z" fill="currentColor"></path></svg>`;
  const PAUSE_ICON_SVG =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" aria-hidden="true"><!--Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M176 96C149.5 96 128 117.5 128 144L128 496C128 522.5 149.5 544 176 544L240 544C266.5 544 288 522.5 288 496L288 144C288 117.5 266.5 96 240 96L176 96zM400 96C373.5 96 352 117.5 352 144L352 496C352 522.5 373.5 544 400 544L464 544C490.5 544 512 522.5 512 496L512 144C512 117.5 490.5 96 464 96L400 96z" fill="currentColor"></path></svg>`;
  const SPINNER_ICON_SVG =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" aria-hidden="true"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M272 112C272 85.5 293.5 64 320 64C346.5 64 368 85.5 368 112C368 138.5 346.5 160 320 160C293.5 160 272 138.5 272 112zM272 528C272 501.5 293.5 480 320 480C346.5 480 368 501.5 368 528C368 554.5 346.5 576 320 576C293.5 576 272 554.5 272 528zM112 272C138.5 272 160 293.5 160 320C160 346.5 138.5 368 112 368C85.5 368 64 346.5 64 320C64 293.5 85.5 272 112 272zM480 320C480 293.5 501.5 272 528 272C554.5 272 576 293.5 576 320C576 346.5 554.5 368 528 368C501.5 368 480 346.5 480 320zM139 433.1C157.8 414.3 188.1 414.3 206.9 433.1C225.7 451.9 225.7 482.2 206.9 501C188.1 519.8 157.8 519.8 139 501C120.2 482.2 120.2 451.9 139 433.1zM139 139C157.8 120.2 188.1 120.2 206.9 139C225.7 157.8 225.7 188.1 206.9 206.9C188.1 225.7 157.8 225.7 139 206.9C120.2 188.1 120.2 157.8 139 139zM501 433.1C519.8 451.9 519.8 482.2 501 501C482.2 519.8 451.9 519.8 433.1 501C414.3 482.2 414.3 451.9 433.1 433.1C451.9 414.3 482.2 414.3 501 433.1z" fill="currentColor"/></svg>`;

  // To avoid "This document requires 'TrustedHTML' assignment" errors.
  // https://stackoverflow.com/a/69309927/6306190
  const dangerouslyEscapeHTMLPolicy = trustedTypes.createPolicy("forceInner", {
    createHTML: (to_escape) => to_escape
  });

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

  async function requestTTS(text, options = {}) {
    const { onBeforeNetwork } = options;
    const cached = await getCachedTTSItem(text);
    if (cached?.audioBlob) {
      return cached.audioBlob;
    }

    onBeforeNetwork?.();

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

  function setButtonState(button, state) {
    if (!button) return;
    const label = button.__ttsLabel;
    const icon = button.__ttsIcon;
    if (!label || !icon) return;

    const setButtonDisabled = (disabled) => {
      button.disabled = disabled;
      button.style.pointerEvents = disabled ? "none" : "";
      button.style.cursor = disabled ? "wait" : "pointer";
      button.style.opacity = disabled ? "0.8" : "";
    };

    if (state === "pause") {
      label.textContent = "Pause";
      icon.innerHTML = dangerouslyEscapeHTMLPolicy.createHTML(PAUSE_ICON_SVG);
      button.dataset.ttsState = "pause";
      setButtonDisabled(false);
      return;
    }

    if (state === "loading") {
      label.textContent = "Loading...";
      icon.innerHTML = dangerouslyEscapeHTMLPolicy.createHTML(SPINNER_ICON_SVG);
      button.dataset.ttsState = "loading";
      setButtonDisabled(true);
      return;
    }

    label.textContent = "Listen";
    icon.innerHTML = dangerouslyEscapeHTMLPolicy.createHTML(PLAY_ICON_SVG);
    button.dataset.ttsState = "listen";
    setButtonDisabled(false);
  }

  const setButtonToPause = (button) => setButtonState(button, "pause");
  const setButtonToListen = (button) => setButtonState(button, "listen");
  const setButtonToLoading = (button) => setButtonState(button, "loading");

  function cleanupCurrentPlayback(resetButton = true) {
    if (currentAudio) {
      if (currentAudio.__handleEnded) {
        currentAudio.removeEventListener("ended", currentAudio.__handleEnded);
        currentAudio.__handleEnded = null;
      }
      if (currentAudio.__handleError) {
        currentAudio.removeEventListener("error", currentAudio.__handleError);
        currentAudio.__handleError = null;
      }
      currentAudio.pause();
      currentAudio = null;
    }

    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      currentAudioUrl = null;
    }

    if (resetButton) {
      if (currentButton) {
        setButtonToListen(currentButton);
      }
      currentButton = null;
    }
  }

  async function startPlayback(button, storyTextEl) {
    const storyText = storyTextEl.textContent?.trim();
    if (!storyText) {
      logger.warn("No story text found to convert to speech.");
      return;
    }

    cleanupCurrentPlayback();
    currentButton = button;

    const audioBlob = await requestTTS(storyText, {
      onBeforeNetwork: () => {
        setButtonToLoading(button);
      },
    });

    if (!audioBlob) {
      setButtonToListen(button);
      if (currentButton === button) {
        currentButton = null;
      }
      return;
    }

    const url = URL.createObjectURL(audioBlob);
    const audio = new Audio(url);

    currentAudio = audio;
    currentAudioUrl = url;
    currentButton = button;

    const handleEnded = () => {
      if (currentAudio !== audio) {
        audio.removeEventListener("ended", handleEnded);
        return;
      }
      cleanupCurrentPlayback();
    };
    const handleError = (err) => {
      if (currentAudio !== audio) {
        audio.removeEventListener("error", handleError);
        return;
      }
      logger.error("Audio playback error", err);
      cleanupCurrentPlayback();
    };

    audio.__handleEnded = handleEnded;
    audio.__handleError = handleError;
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    try {
      await audio.play();
      setButtonToPause(button);
    } catch (err) {
      logger.error("Audio playback failed", err);
      cleanupCurrentPlayback();
    }
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

    const iconContainer = document.createElement("span"); // Wrapper for easy icon swapping
    iconContainer.style.display = "flex"; // Fix alignment
    iconContainer.innerHTML = dangerouslyEscapeHTMLPolicy.createHTML(PLAY_ICON_SVG);

    const label = document.createElement("span");
    label.textContent = "Listen";

    button.__ttsIcon = iconContainer;
    button.__ttsLabel = label;

    button.appendChild(iconContainer);
    button.appendChild(label);
    setButtonToListen(button);

    // Real TTS request
    button.addEventListener("click", async (e) => {
      e.stopPropagation();

      if (button.dataset.ttsState === "loading") {
        return;
      }

      // If clicking the currently active button
      if (currentButton === button && currentAudio) {
        if (currentAudio.paused) {
          try {
            await currentAudio.play();
            setButtonToPause(button);
          } catch (err) {
            logger.error("Resume failed", err);
            setButtonToListen(button); // Revert on error
          }
        } else {
          currentAudio.pause();
          setButtonToListen(button);
        }
        return;
      }

      await startPlayback(button, storyTextEl);
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

