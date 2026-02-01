// ==UserScript==
// @name         Google Gemini Storybook TTS
// @namespace    http://tampermonkey.net/
// @version      0.5.0
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
// @require      https://github.com/johan456789/userscripts/raw/main/utils/cache.js
// @require      https://cdn.jsdelivr.net/npm/idb-keyval@6.2.2/dist/umd.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/google-gemini-storybook-tts.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/google-gemini-storybook-tts.js
// ==/UserScript==

const logger = Logger("[gemini-storybook-tts]");

(function () {
  "use strict";

  logger("Script started");

  // Unique id/class markers to avoid duplicate insertions
  const PLAYER_CONTAINER_CLASS = "userscript-tts-player-container";

  // Global state for audio playback
  let currentAudio = null;
  let currentPlayer = null;
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
  const idbStore = idb?.createStore?.("gemini-storybook-tts", "tts-cache");

  const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  const CACHE_EVICT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
  const cache = idbStore
    ? createCache({
        get: (key) => idb.get(key, idbStore),
        set: (key, value) => idb.set(key, value, idbStore),
        keys: () => idb.keys(idbStore),
        del: (key) => idb.del(key, idbStore),
        logger,
        ttlMs: CACHE_TTL_MS,
      })
    : null;
  if (!cache) {
    logger.warn("idb-keyval unavailable; cache disabled");
  }

  // Cache key versioning - increment when cache schema changes
  const CACHE_VERSION = "v2";

  /**
   * Compute a SHA-256 hash for a string using Web Crypto.
   * @param {string} str
   * @returns {Promise<string>}
   */
  async function hashString(str) {
    const data = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Build a cache key based on text only.
   * Format: tts:v2:{textHash}
   * @param {string} text
   * @returns {Promise<string>}
   */
  async function buildCacheKey(text) {
    const textHash = await hashString(text);
    return `tts:${CACHE_VERSION}:${textHash}`;
  }

  /**
   * Get a cached TTS entry by text.
   * @param {string} text
   * @returns {Promise<{value: {audioBlob: Blob, contentType: string, endpointType: string, alignment: Object|null, normalizedAlignment: Object|null}, creationDate: number}|null>}
   */
  async function getCachedTTSItem(text) {
    if (!cache) return null;
    const cacheKey = await buildCacheKey(text);
    return cache.getItem(cacheKey);
  }

  /**
   * Cache a TTS entry with structured data.
   * @param {string} text
   * @param {Object} entry
   * @param {Blob} entry.audioBlob
   * @param {string} entry.contentType
   * @param {string} entry.endpointType
   * @param {Object|null} entry.alignment
   * @param {Object|null} entry.normalizedAlignment
   */
  async function cacheTTSItem(text, entry) {
    if (!cache) return;
    const cacheKey = await buildCacheKey(text);
    await cache.setItem(cacheKey, entry);
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

  const CURRENT_ENDPOINT_TYPE = "tts_with_timestamps";

  function buildTTSRequestPayload(text) {
    const voiceId = "JBFqnCBsd6RMkjVDRZzb";
    const outputFormat = "mp3_44100_128";
    const modelId = "eleven_flash_v2_5"; // or eleven_multilingual_v2
    const languageCode = "es";
    const endpointType = CURRENT_ENDPOINT_TYPE;
    const voiceSettings = {
      speed: 0.8,
    };

    return {
      // Use with-timestamps endpoint for alignment data
      endpoint: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
      payload: {
        text: text,
        model_id: modelId,
        language_code: languageCode,
        output_format: outputFormat,
        voice_settings: voiceSettings,
      },
      cacheParams: {
        endpointType,
      },
    };
  }

  /**
   * Decode a base64 string to a Blob.
   * @param {string} base64
   * @param {string} contentType
   * @returns {Blob}
   */
  function base64ToBlob(base64, contentType = "audio/mpeg") {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: contentType });
  }

  /**
   * Request TTS from ElevenLabs with timestamps endpoint.
   * Returns a structured entry with audio blob and alignment data.
   * @param {string} text
   * @param {Object} options
   * @param {Function} options.onBeforeNetwork
   * @returns {Promise<{audioBlob: Blob, contentType: string, endpointType: string, alignment: Object|null, normalizedAlignment: Object|null}|null>}
   */
  async function requestTTS(text, options = {}) {
    const { onBeforeNetwork } = options;
    onBeforeNetwork?.();

    const apiKey = getElevenLabsApiKeyOrPrompt();
    if (!apiKey) {
      logger.warn("ElevenLabs API key missing. Aborting TTS request.");
      return null;
    }

    const { endpoint, payload, cacheParams } = buildTTSRequestPayload(text);

    try {
      const responseText = await new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "POST",
          url: endpoint,
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          data: JSON.stringify(payload),
          responseType: "text",
          timeout: 15000,
          onload: (res) => {
            if (res.status >= 200 && res.status < 300 && res.responseText) {
              resolve(res.responseText);
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

      // Parse JSON response from with-timestamps endpoint
      const data = JSON.parse(responseText);
      const { audio_base64, alignment, normalized_alignment } = data;

      if (!audio_base64) {
        throw new Error("No audio data in response");
      }

      // Determine content type from output format
      const contentType = payload.output_format.startsWith("mp3")
        ? "audio/mpeg"
        : payload.output_format.startsWith("pcm")
        ? "audio/pcm"
        : "audio/mpeg";

      const audioBlob = base64ToBlob(audio_base64, contentType);

      const entry = {
        audioBlob,
        contentType,
        endpointType: cacheParams.endpointType,
        alignment: alignment || null,
        normalizedAlignment: normalized_alignment || null,
      };

      // Cache the structured entry
      await cacheTTSItem(text, entry);

      return entry;
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

  function setPlayerState(player, state) {
    if (!player) return;
    const button = player.playButton;
    const icon = player.playIcon;
    if (!button || !icon) return;

    const setButtonDisabled = (disabled) => {
      button.disabled = disabled;
      button.style.pointerEvents = disabled ? "none" : "";
      button.style.cursor = disabled ? "wait" : "pointer";
      button.style.opacity = disabled ? "0.7" : "";
    };

    if (state === "pause") {
      icon.innerHTML = dangerouslyEscapeHTMLPolicy.createHTML(PAUSE_ICON_SVG);
      button.dataset.ttsState = "pause";
      setButtonDisabled(false);
      return;
    }

    if (state === "loading") {
      icon.innerHTML = dangerouslyEscapeHTMLPolicy.createHTML(SPINNER_ICON_SVG);
      button.dataset.ttsState = "loading";
      setButtonDisabled(true);
      return;
    }

    icon.innerHTML = dangerouslyEscapeHTMLPolicy.createHTML(PLAY_ICON_SVG);
    button.dataset.ttsState = "listen";
    setButtonDisabled(false);
  }

  const setPlayerToPause = (player) => setPlayerState(player, "pause");
  const setPlayerToListen = (player) => setPlayerState(player, "listen");
  const setPlayerToLoading = (player) => setPlayerState(player, "loading");

  function updateProgressUI(player) {
    const audio = player?.audio;
    const progress = player?.progress;
    if (!audio || !progress) return;
    const duration = Number.isFinite(audio.duration)
      ? audio.duration
      : player.lastDuration;
    const currentTime = Number.isFinite(audio.currentTime)
      ? audio.currentTime
      : player.lastTime;
    if (Number.isFinite(duration)) {
      player.lastDuration = duration;
    }
    if (!player.isSeeking && Number.isFinite(currentTime)) {
      player.lastTime = currentTime;
    }
    const canSeek = Number.isFinite(duration) && duration > 0;
    progress.disabled = !canSeek;
    progress.max = canSeek ? duration : 0;
    if (!player.isSeeking) {
      progress.value = canSeek && Number.isFinite(player.lastTime)
        ? player.lastTime
        : 0;
    }
  }

  function resetPlayerUI(player) {
    if (!player) return;
    setPlayerToListen(player);
    if (player.progress) {
      player.progress.value = 0;
      player.progress.max = 0;
      player.progress.disabled = true;
    }
  }

  function cleanupCurrentPlayback(options = {}) {
    const { resetPlayer = true, disposeAudio = true } = options;
    if (currentPlayer && currentAudio) {
      if (Number.isFinite(currentAudio.currentTime)) {
        currentPlayer.lastTime = currentAudio.currentTime;
      }
      if (Number.isFinite(currentAudio.duration)) {
        currentPlayer.lastDuration = currentAudio.duration;
      }
      setPlayerToListen(currentPlayer);
      updateProgressUI(currentPlayer);
    }

    if (currentAudio) {
      if (disposeAudio) {
        if (currentAudio.__handleEnded) {
          currentAudio.removeEventListener("ended", currentAudio.__handleEnded);
          currentAudio.__handleEnded = null;
        }
        if (currentAudio.__handleError) {
          currentAudio.removeEventListener("error", currentAudio.__handleError);
          currentAudio.__handleError = null;
        }
        if (currentAudio.__handleTimeUpdate) {
          currentAudio.removeEventListener(
            "timeupdate",
            currentAudio.__handleTimeUpdate
          );
          currentAudio.__handleTimeUpdate = null;
        }
        if (currentAudio.__handleLoadedMeta) {
          currentAudio.removeEventListener(
            "loadedmetadata",
            currentAudio.__handleLoadedMeta
          );
          currentAudio.__handleLoadedMeta = null;
        }
        if (currentAudio.__handleDurationChange) {
          currentAudio.removeEventListener(
            "durationchange",
            currentAudio.__handleDurationChange
          );
          currentAudio.__handleDurationChange = null;
        }
      }
      currentAudio.pause();
    }

    if (disposeAudio && currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      currentAudioUrl = null;
    }

    if (currentPlayer) {
      if (resetPlayer) {
        resetPlayerUI(currentPlayer);
      }
      if (disposeAudio && currentPlayer.audioUrl) {
        currentPlayer.audioUrl = null;
        currentPlayer.audio = null;
      }
    }

    currentAudio = null;
    currentPlayer = null;
  }

  function prepareCachedAudio(player, audioBlob) {
    if (!audioBlob) return null;
    if (player.audio && player.audioUrl) return player.audio;
    const url = URL.createObjectURL(audioBlob);
    player.audioUrl = url;
    const audio = new Audio(url);
    player.audio = audio;
    attachAudioHandlers(player, audio);
    return audio;
  }

  function attachBlobToPlayer(player, audioBlob) {
    const audio = prepareCachedAudio(player, audioBlob);
    currentAudio = audio;
    currentAudioUrl = player.audioUrl || null;
    return audio;
  }

  function attachAudioHandlers(player, audio) {
    if (
      Number.isFinite(player.lastTime) &&
      player.lastTime > 0 &&
      !Number.isFinite(audio.duration)
    ) {
      const applyStoredTime = () => {
        if (
          Number.isFinite(audio.duration) &&
          player.lastTime <= audio.duration
        ) {
          try {
            audio.currentTime = player.lastTime;
          } catch (err) {
            logger.warn("Failed to restore playback position", err);
          }
        }
        audio.removeEventListener("loadedmetadata", applyStoredTime);
      };
      audio.addEventListener("loadedmetadata", applyStoredTime);
    }

    const handleEnded = () => {
      if (currentAudio !== audio) {
        audio.removeEventListener("ended", handleEnded);
        return;
      }
      try {
        audio.currentTime = 0;
      } catch (err) {
        logger.warn("Failed to reset playback position", err);
      }
      setPlayerToListen(player);
      updateProgressUI(player);
    };
    const handleError = (err) => {
      if (currentAudio !== audio) {
        audio.removeEventListener("error", handleError);
        return;
      }
      logger.error("Audio playback error", err);
      cleanupCurrentPlayback();
    };
    const handleTimeUpdate = () => updateProgressUI(player);
    const handleLoadedMeta = () => updateProgressUI(player);
    const handleDurationChange = () => updateProgressUI(player);

    audio.__handleEnded = handleEnded;
    audio.__handleError = handleError;
    audio.__handleTimeUpdate = handleTimeUpdate;
    audio.__handleLoadedMeta = handleLoadedMeta;
    audio.__handleDurationChange = handleDurationChange;

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMeta);
    audio.addEventListener("durationchange", handleDurationChange);
  }

  async function startPlayback(player, storyTextEl) {
    const storyText = storyTextEl.textContent?.trim();
    if (!storyText) {
      logger.warn("No story text found to convert to speech.");
      return;
    }

    cleanupCurrentPlayback({ resetPlayer: false, disposeAudio: false });
    currentPlayer = player;

    if (player.audio && player.audioUrl) {
      currentAudio = player.audio;
      currentAudioUrl = player.audioUrl;
      if (Number.isFinite(player.lastTime)) {
        try {
          currentAudio.currentTime = player.lastTime;
        } catch (err) {
          logger.warn("Failed to restore playback position", err);
        }
      }
      try {
        await currentAudio.play();
        setPlayerToPause(player);
        updateProgressUI(player);
      } catch (err) {
        logger.error("Audio playback failed", err);
        cleanupCurrentPlayback();
      }
      return;
    }

    // Try to get cached entry (structured with audioBlob + alignment)
    let cachedEntry = player.cachedEntry;
    if (!cachedEntry && player.cachePromise) {
      try {
        const cached = await player.cachePromise;
        cachedEntry = cached?.value || null;
        player.cachedEntry = cachedEntry;
      } catch (err) {
        logger.warn("Cache prefetch failed", err);
      }
    }

    let audio = null;
    if (cachedEntry?.audioBlob) {
      logger("Cache hit for TTS audio");
      audio = attachBlobToPlayer(player, cachedEntry.audioBlob);
    } else {
      logger("Cache miss for TTS audio");
      const result = await requestTTS(storyText, {
        onBeforeNetwork: () => {
          setPlayerToLoading(player);
        },
      });
      if (!result?.audioBlob) {
        setPlayerToListen(player);
        if (currentPlayer === player) {
          currentPlayer = null;
        }
        return;
      }
      // Store the structured entry for future use
      player.cachedEntry = result;
      audio = attachBlobToPlayer(player, result.audioBlob);
    }

    try {
      if (Number.isFinite(player.lastTime)) {
        try {
          audio.currentTime = player.lastTime;
        } catch (err) {
          logger.warn("Failed to restore playback position", err);
        }
      }
      await audio.play();
      setPlayerToPause(player);
      updateProgressUI(player);
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
   * Creates or updates the audio player container above the story text.
   * - Copies the parent container of the `p.story-text` as the base style
   * - Inserts a custom player with play/pause and progress bar
   * - Avoids duplicates by checking for existing marker class
   * @param {HTMLElement} storyTextEl
   */
  function ensurePlayerStyles() {
    const STYLE_ID = "userscript-tts-player-style";
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .userscript-tts-player-wrapper {
        transition: box-shadow 0.2s ease;
      }
      .userscript-tts-player-wrapper:hover {
        box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.12);
      }
      .userscript-tts-play-button {
        transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
      }
      .userscript-tts-play-button:hover {
        filter: brightness(0.95);
        box-shadow: 0 0 0 6px rgba(26, 115, 232, 0.18);
      }
      .userscript-tts-play-button:active {
        transform: scale(0.97);
      }
      .userscript-tts-progress {
        transition: filter 0.2s ease;
      }
      .userscript-tts-progress:hover {
        filter: brightness(0.95);
      }
      .userscript-tts-progress::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #1A73E8;
        box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.15);
        transition: box-shadow 0.2s ease, transform 0.2s ease;
      }
      .userscript-tts-progress:hover::-webkit-slider-thumb {
        box-shadow: 0 0 0 6px rgba(26, 115, 232, 0.25);
        transform: scale(1.05);
      }
      .userscript-tts-progress::-moz-range-thumb {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: #1A73E8;
        border: none;
        box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.15);
        transition: box-shadow 0.2s ease, transform 0.2s ease;
      }
      .userscript-tts-progress:hover::-moz-range-thumb {
        box-shadow: 0 0 0 6px rgba(26, 115, 232, 0.25);
        transform: scale(1.05);
      }
    `;
    document.head.appendChild(style);
  }

  function ensureButtonAboveStory(storyTextEl) {
    const paragraphContainer = storyTextEl.parentElement;
    if (!paragraphContainer) return;

    // If we've already inserted for this particular story text container, bail
    const existing = paragraphContainer.previousElementSibling;
    if (existing && existing.classList.contains(PLAYER_CONTAINER_CLASS)) {
      return; // Already inserted for this page
    }

    // Clone the parent container to match spacing and width
    const playerContainer = paragraphContainer.cloneNode(false);
    playerContainer.classList.add(PLAYER_CONTAINER_CLASS);

    // Clean out any residual classes that may affect layout undesirably
    playerContainer.classList.remove("reached-end");

    const player = {
      container: playerContainer,
      playButton: null,
      playIcon: null,
      progress: null,
      audio: null,
      audioUrl: null,
      cachedEntry: null, // Structured entry: { audioBlob, contentType, endpointType, alignment, normalizedAlignment }
      cachePromise: null,
      isSeeking: false,
      lastTime: 0,
      lastDuration: 0,
    };

    // Build the player UI
    ensurePlayerStyles();

    const wrapper = document.createElement("div");
    wrapper.className = "userscript-tts-player-wrapper";
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "12px";
    wrapper.style.padding = "8px 12px";
    wrapper.style.borderRadius = "18px";
    wrapper.style.background = "#F1F3F4";
    wrapper.style.maxWidth = "50%";
    wrapper.style.width = "100%";
    wrapper.style.margin = "8px 0";
    wrapper.style.boxSizing = "border-box";
    wrapper.style.minWidth = "0";

    const playButton = document.createElement("button");
    playButton.className = "userscript-tts-play-button";
    playButton.type = "button";
    playButton.style.display = "inline-flex";
    playButton.style.alignItems = "center";
    playButton.style.justifyContent = "center";
    playButton.style.width = "44px";
    playButton.style.height = "44px";
    playButton.style.borderRadius = "999px";
    playButton.style.border = "none";
    playButton.style.background = "#1A73E8";
    playButton.style.color = "#fff";
    playButton.style.cursor = "pointer";
    playButton.style.flexShrink = "0";

    const playIcon = document.createElement("span");
    playIcon.style.display = "flex";
    playIcon.innerHTML = dangerouslyEscapeHTMLPolicy.createHTML(PLAY_ICON_SVG);

    playButton.appendChild(playIcon);

    const progressWrapper = document.createElement("div");
    progressWrapper.style.display = "flex";
    progressWrapper.style.flex = "1 1 auto";
    progressWrapper.style.alignItems = "center";
    progressWrapper.style.gap = "10px";
    progressWrapper.style.minWidth = "0";

    const progress = document.createElement("input");
    progress.className = "userscript-tts-progress";
    progress.type = "range";
    progress.min = "0";
    progress.max = "0";
    progress.value = "0";
    progress.step = "0.1";
    progress.disabled = true;
    progress.style.flex = "1 1 auto";
    progress.style.width = "100%";
    progress.style.minWidth = "0";
    progress.style.accentColor = "#1A73E8";
    progress.style.height = "4px";
    progress.style.cursor = "pointer";

    progressWrapper.appendChild(progress);

    wrapper.appendChild(playButton);
    wrapper.appendChild(progressWrapper);
    playerContainer.appendChild(wrapper);

    player.playButton = playButton;
    player.playIcon = playIcon;
    player.progress = progress;
    playerContainer.__ttsPlayer = player;
    setPlayerToListen(player);

    // Preload cache info without blocking playback
    const storyText = storyTextEl.textContent?.trim();
    if (storyText) {
      player.cachePromise = getCachedTTSItem(storyText).then((cached) => {
        if (cached?.value?.audioBlob) {
          player.cachedEntry = cached.value;
          prepareCachedAudio(player, cached.value.audioBlob);
          updateProgressUI(player);
        }
        return cached;
      });
    }

    wrapper.addEventListener("click", (e) => {
      e.stopPropagation();
    });

    playButton.addEventListener("click", async (e) => {
      e.stopPropagation();

      if (playButton.dataset.ttsState === "loading") {
        return;
      }

      if (currentPlayer === player && currentAudio) {
        if (currentAudio.paused) {
          try {
            await currentAudio.play();
            setPlayerToPause(player);
          } catch (err) {
            logger.error("Resume failed", err);
            setPlayerToListen(player);
          }
        } else {
          currentAudio.pause();
          setPlayerToListen(player);
        }
        return;
      }

      await startPlayback(player, storyTextEl);
    });

    const seekStart = () => {
      player.isSeeking = true;
    };
    const seekEnd = () => {
      player.isSeeking = false;
      if (player.audio && !progress.disabled) {
        const target = Number(progress.value);
        if (Number.isFinite(target)) {
          player.audio.currentTime = target;
        }
      } else if (!progress.disabled) {
        const target = Number(progress.value);
        if (Number.isFinite(target)) {
          player.lastTime = target;
        }
      }
    };
    progress.addEventListener("mousedown", seekStart);
    progress.addEventListener("touchstart", seekStart, { passive: true });
    progress.addEventListener("mouseup", seekEnd);
    progress.addEventListener("touchend", seekEnd);
    progress.addEventListener("change", seekEnd);

    // Insert immediately above the story text parent
    paragraphContainer.parentElement?.insertBefore(
      playerContainer,
      paragraphContainer
    );
    logger("Inserted TTS audio player above story text");

    // Disable left-clicks within both containers; allow clicks on our player
    blockLeftClicks(playerContainer, wrapper);
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

  // Evict stale cache entries asynchronously on a schedule.
  cache?.startEviction({
    initialDelayMs: 1500, // 1.5 second later
    intervalMs: CACHE_EVICT_INTERVAL_MS, // periodically evict stale cache entries
  });

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
