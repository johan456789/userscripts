// ==UserScript==
// @name         Google Gemini Storybook TTS
// @namespace    http://tampermonkey.net/
// @version      0.5.1
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

"use strict";

const logger = Logger("[gemini-storybook-tts]");

const CONFIG = {
  classes: {
    playerContainer: "userscript-tts-player-container",
    word: "tts-word",
    wordPlaying: "playing",
  },
  selectors: {
    storyText:
      "storybook > div > div.ng-star-inserted > storybook-page > div p.story-text",
    currentStoryText:
      "storybook > div > div.ng-star-inserted:not(.hide) > storybook-page.right > div:not(.underneath) p.story-text",
  },
  cache: {
    version: "v2",
    ttlMs: 30 * 24 * 60 * 60 * 1000,
    evictIntervalMs: 6 * 60 * 60 * 1000,
  },
  tts: {
    apiKeyStorageKey: "gemini_storybook_tts_elevenlabs_api_key",
    endpointType: "tts_with_timestamps",
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    outputFormat: "mp3_44100_128",
    modelId: "eleven_flash_v2_5",
    languageCode: "es",
    voiceSettings: { speed: 0.8 },
  },
  svg: {
    play:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" aria-hidden="true"><!--Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M187.2 100.9C174.8 94.1 159.8 94.4 147.6 101.6C135.4 108.8 128 121.9 128 136L128 504C128 518.1 135.5 531.2 147.6 538.4C159.7 545.6 174.8 545.9 187.2 539.1L523.2 355.1C536 348.1 544 334.6 544 320C544 305.4 536 291.9 523.2 284.9L187.2 100.9z" fill="currentColor"></path></svg>`,
    pause:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" aria-hidden="true"><!--Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M176 96C149.5 96 128 117.5 128 144L128 496C128 522.5 149.5 544 176 544L240 544C266.5 544 288 522.5 288 496L288 144C288 117.5 266.5 96 240 96L176 96zM400 96C373.5 96 352 117.5 352 144L352 496C352 522.5 373.5 544 400 544L464 544C490.5 544 512 522.5 512 496L512 144C512 117.5 490.5 96 464 96L400 96z" fill="currentColor"></path></svg>`,
    spinner:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" aria-hidden="true"><!--!Font Awesome Free v7.1.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M272 112C272 85.5 293.5 64 320 64C346.5 64 368 85.5 368 112C368 138.5 346.5 160 320 160C293.5 160 272 138.5 272 112zM272 528C272 501.5 293.5 480 320 480C346.5 480 368 501.5 368 528C368 554.5 346.5 576 320 576C293.5 576 272 554.5 272 528zM112 272C138.5 272 160 293.5 160 320C160 346.5 138.5 368 112 368C85.5 368 64 346.5 64 320C64 293.5 85.5 272 112 272zM480 320C480 293.5 501.5 272 528 272C554.5 272 576 293.5 576 320C576 346.5 554.5 368 528 368C501.5 368 480 346.5 480 320zM139 433.1C157.8 414.3 188.1 414.3 206.9 433.1C225.7 451.9 225.7 482.2 206.9 501C188.1 519.8 157.8 519.8 139 501C120.2 482.2 120.2 451.9 139 433.1zM139 139C157.8 120.2 188.1 120.2 206.9 139C225.7 157.8 225.7 188.1 206.9 206.9C188.1 225.7 157.8 225.7 139 206.9C120.2 188.1 120.2 157.8 139 139zM501 433.1C519.8 451.9 519.8 482.2 501 501C482.2 519.8 451.9 519.8 433.1 501C414.3 482.2 414.3 451.9 433.1 433.1C451.9 414.3 482.2 414.3 501 433.1z" fill="currentColor"/></svg>`,
  },
};

const state = {
  currentAudio: null,
  currentPlayer: null,
  currentAudioUrl: null,
};

const htmlPolicy = trustedTypes.createPolicy("forceInner", {
  createHTML: (toEscape) => toEscape,
});

const Cache = (() => {
  const idb = typeof idbKeyval !== "undefined" ? idbKeyval : null;
  const idbStore = idb?.createStore?.("gemini-storybook-tts", "tts-cache");
  const cache = idbStore
    ? createCache({
        get: (key) => idb.get(key, idbStore),
        set: (key, value) => idb.set(key, value, idbStore),
        keys: () => idb.keys(idbStore),
        del: (key) => idb.del(key, idbStore),
        logger,
        ttlMs: CONFIG.cache.ttlMs,
      })
    : null;

  if (!cache) {
    logger.warn("idb-keyval unavailable; cache disabled");
  }

  async function hashString(str) {
    const data = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function buildKey(text) {
    const textHash = await hashString(text);
    return `tts:${CONFIG.cache.version}:${textHash}`;
  }

  async function getItem(text) {
    if (!cache) return null;
    const cacheKey = await buildKey(text);
    return cache.getItem(cacheKey);
  }

  async function setItem(text, entry) {
    if (!cache) return;
    const cacheKey = await buildKey(text);
    await cache.setItem(cacheKey, entry);
  }

  function startEviction() {
    cache?.startEviction({
      initialDelayMs: 1500,
      intervalMs: CONFIG.cache.evictIntervalMs,
    });
  }

  return {
    getItem,
    setItem,
    startEviction,
  };
})();

const TTS = (() => {
  function getApiKeyOrPrompt() {
    let apiKey = GM_getValue(CONFIG.tts.apiKeyStorageKey, "");
    if (!apiKey) {
      const userInput = prompt(
        "[gemini-storybook-tts] ElevenLabs API key not set. Please enter your ElevenLabs API key:",
        ""
      );
      if (userInput) {
        const trimmed = userInput.trim();
        if (trimmed) {
          apiKey = trimmed;
          GM_setValue(CONFIG.tts.apiKeyStorageKey, apiKey);
          logger("Saved ElevenLabs API key");
        }
      }
    }
    if (!apiKey) {
      logger.warn("ElevenLabs API key missing. Aborting TTS request.");
      return null;
    }
    return apiKey;
  }

  function buildRequestPayload(text) {
    return {
      endpoint: `https://api.elevenlabs.io/v1/text-to-speech/${CONFIG.tts.voiceId}/with-timestamps`,
      payload: {
        text,
        model_id: CONFIG.tts.modelId,
        language_code: CONFIG.tts.languageCode,
        output_format: CONFIG.tts.outputFormat,
        voice_settings: CONFIG.tts.voiceSettings,
      },
      cacheParams: {
        endpointType: CONFIG.tts.endpointType,
      },
    };
  }

  function base64ToBlob(base64, contentType = "audio/mpeg") {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: contentType });
  }

  async function request(text, options = {}) {
    const { onBeforeNetwork } = options;
    onBeforeNetwork?.();

    const apiKey = getApiKeyOrPrompt();
    if (!apiKey) return null;

    const { endpoint, payload, cacheParams } = buildRequestPayload(text);

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

      const data = JSON.parse(responseText);
      const { audio_base64, alignment, normalized_alignment } = data;

      if (!audio_base64) {
        throw new Error("No audio data in response");
      }

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

      await Cache.setItem(text, entry);

      return entry;
    } catch (err) {
      logger.error("TTS network error", err);
      return null;
    }
  }

  return {
    request,
  };
})();

const Text = (() => {
  function wrapWordsInSpans(el, lang = "es") {
    if (!el) {
      logger.warn("wrapWordsInSpans: Target element not found.");
      return 0;
    }

    if (el.dataset.wordWrapped === "1") {
      logger("wrapWordsInSpans: Already processed.");
      return el.querySelectorAll("span." + CONFIG.classes.word).length;
    }

    const text = el.textContent ?? "";
    const frag = document.createDocumentFragment();

    if ("Segmenter" in Intl) {
      const seg = new Intl.Segmenter(lang, { granularity: "word" });
      for (const part of seg.segment(text)) {
        if (part.isWordLike) {
          const span = document.createElement("span");
          span.className = CONFIG.classes.word;
          span.textContent = part.segment;
          span.dataset.start = String(part.index);
          span.dataset.end = String(part.index + part.segment.length);
          frag.appendChild(span);
        } else {
          frag.appendChild(document.createTextNode(part.segment));
        }
      }
    } else {
      const tokenRe = /(\p{L}+\p{M}*|\p{N}+|[^\p{L}\p{N}]+)/gu;
      for (const match of text.matchAll(tokenRe)) {
        const tok = match[0];
        const start = match.index ?? 0;
        const end = start + tok.length;
        if (/^\p{L}|\p{N}/u.test(tok)) {
          const span = document.createElement("span");
          span.className = CONFIG.classes.word;
          span.textContent = tok;
          span.dataset.start = String(start);
          span.dataset.end = String(end);
          frag.appendChild(span);
        } else {
          frag.appendChild(document.createTextNode(tok));
        }
      }
    }

    el.textContent = "";
    el.appendChild(frag);
    el.dataset.wordWrapped = "1";

    const wordCount = el.querySelectorAll("span." + CONFIG.classes.word).length;
    logger("Wrapped words:", wordCount);
    return wordCount;
  }

  function upperBound(arr, x) {
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] <= x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  return {
    wrapWordsInSpans,
    upperBound,
  };
})();

const Alignment = (() => {
  function buildWordTimingsFromAlignment(storyTextEl, alignment) {
    if (!storyTextEl || !alignment) return null;
    const chars = alignment.characters;
    const starts = alignment.character_start_times_seconds;
    const ends = alignment.character_end_times_seconds;
    if (!Array.isArray(chars) || !Array.isArray(starts) || !Array.isArray(ends)) {
      logger.warn("Alignment data missing expected arrays.");
      return null;
    }
    if (chars.length !== starts.length || chars.length !== ends.length) {
      logger.warn("Alignment arrays length mismatch.", {
        chars: chars.length,
        starts: starts.length,
        ends: ends.length,
      });
      return null;
    }

    const text = storyTextEl.textContent ?? "";
    if (text.length !== chars.length) {
      logger.warn("Alignment length does not match text length.", {
        textLength: text.length,
        alignmentLength: chars.length,
      });
      return null;
    }

    const spans = Array.from(
      storyTextEl.querySelectorAll("span." + CONFIG.classes.word)
    );
    if (spans.length === 0) return null;

    const wordStarts = [];
    const wordEnds = [];

    for (const span of spans) {
      const startIdx = Number(span.dataset.start);
      const endIdx = Number(span.dataset.end);
      if (!Number.isFinite(startIdx) || !Number.isFinite(endIdx) || endIdx <= startIdx) {
        logger.warn("Invalid word span offsets.", span.textContent);
        return null;
      }
      const startTime = starts[startIdx];
      const endTime = ends[endIdx - 1];
      if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
        logger.warn("Invalid alignment timing for span.", span.textContent);
        return null;
      }
      wordStarts.push(startTime);
      wordEnds.push(endTime);
    }

    return {
      spans,
      starts: wordStarts,
      ends: wordEnds,
      currentIdx: -1,
    };
  }

  function ensureWordData(player, storyTextEl, alignment) {
    if (!player || !storyTextEl || !alignment) return;
    const textKey = storyTextEl.textContent ?? "";
    if (player.wordData && player.wordDataKey === textKey) return;
    const wordData = buildWordTimingsFromAlignment(storyTextEl, alignment);
    if (!wordData) return;
    player.wordData = wordData;
    player.wordDataKey = textKey;
    const initialTime = Number.isFinite(player.lastTime) ? player.lastTime : 0;
    Highlight.at(player, initialTime);
  }

  return {
    buildWordTimingsFromAlignment,
    ensureWordData,
  };
})();

const Highlight = (() => {
  function at(player, timeNow) {
    const data = player?.wordData;
    if (!data || !Number.isFinite(timeNow)) return;
    const { spans, starts, ends } = data;
    if (!spans?.length) return;

    let idx = Text.upperBound(starts, timeNow) - 1;
    if (idx < 0 || idx >= spans.length || timeNow > ends[idx]) {
      idx = -1;
    }

    if (idx !== data.currentIdx) {
      if (data.currentIdx >= 0) {
        spans[data.currentIdx].classList.remove(CONFIG.classes.wordPlaying);
      }
      if (idx >= 0) {
        spans[idx].classList.add(CONFIG.classes.wordPlaying);
      }
      data.currentIdx = idx;
    }
  }

  return {
    at,
  };
})();

const Playback = (() => {
  function setPlayerState(player, stateName) {
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

    if (stateName === "pause") {
      icon.innerHTML = htmlPolicy.createHTML(CONFIG.svg.pause);
      button.dataset.ttsState = "pause";
      setButtonDisabled(false);
      return;
    }

    if (stateName === "loading") {
      icon.innerHTML = htmlPolicy.createHTML(CONFIG.svg.spinner);
      button.dataset.ttsState = "loading";
      setButtonDisabled(true);
      return;
    }

    icon.innerHTML = htmlPolicy.createHTML(CONFIG.svg.play);
    button.dataset.ttsState = "listen";
    setButtonDisabled(false);
  }

  function setPlayerToPause(player) {
    setPlayerState(player, "pause");
  }

  function setPlayerToListen(player) {
    setPlayerState(player, "listen");
  }

  function setPlayerToLoading(player) {
    setPlayerState(player, "loading");
  }

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
    Highlight.at(player, currentTime);
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
    if (state.currentPlayer && state.currentAudio) {
      if (Number.isFinite(state.currentAudio.currentTime)) {
        state.currentPlayer.lastTime = state.currentAudio.currentTime;
      }
      if (Number.isFinite(state.currentAudio.duration)) {
        state.currentPlayer.lastDuration = state.currentAudio.duration;
      }
      setPlayerToListen(state.currentPlayer);
      updateProgressUI(state.currentPlayer);
    }

    if (state.currentAudio) {
      stopProgressRaf(state.currentAudio);
      if (disposeAudio) {
        if (state.currentAudio.__handleEnded) {
          state.currentAudio.removeEventListener(
            "ended",
            state.currentAudio.__handleEnded
          );
          state.currentAudio.__handleEnded = null;
        }
        if (state.currentAudio.__handleError) {
          state.currentAudio.removeEventListener(
            "error",
            state.currentAudio.__handleError
          );
          state.currentAudio.__handleError = null;
        }
        if (state.currentAudio.__handlePlay) {
          state.currentAudio.removeEventListener(
            "play",
            state.currentAudio.__handlePlay
          );
          state.currentAudio.__handlePlay = null;
        }
        if (state.currentAudio.__handlePause) {
          state.currentAudio.removeEventListener(
            "pause",
            state.currentAudio.__handlePause
          );
          state.currentAudio.__handlePause = null;
        }
        if (state.currentAudio.__handleSeeked) {
          state.currentAudio.removeEventListener(
            "seeked",
            state.currentAudio.__handleSeeked
          );
          state.currentAudio.__handleSeeked = null;
        }
        if (state.currentAudio.__handleLoadedMeta) {
          state.currentAudio.removeEventListener(
            "loadedmetadata",
            state.currentAudio.__handleLoadedMeta
          );
          state.currentAudio.__handleLoadedMeta = null;
        }
      }
      state.currentAudio.pause();
    }

    if (disposeAudio && state.currentAudioUrl) {
      URL.revokeObjectURL(state.currentAudioUrl);
      state.currentAudioUrl = null;
    }

    if (state.currentPlayer) {
      if (resetPlayer) {
        resetPlayerUI(state.currentPlayer);
      }
      if (disposeAudio && state.currentPlayer.audioUrl) {
        state.currentPlayer.audioUrl = null;
        state.currentPlayer.audio = null;
      }
    }

    state.currentAudio = null;
    state.currentPlayer = null;
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
    state.currentAudio = audio;
    state.currentAudioUrl = player.audioUrl || null;
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
      if (state.currentAudio !== audio) {
        audio.removeEventListener("ended", handleEnded);
        return;
      }
      stopProgressRaf(audio);
      try {
        audio.currentTime = 0;
      } catch (err) {
        logger.warn("Failed to reset playback position", err);
      }
      setPlayerToListen(player);
      updateProgressUI(player);
    };
    const handleError = (err) => {
      if (state.currentAudio !== audio) {
        audio.removeEventListener("error", handleError);
        return;
      }
      stopProgressRaf(audio);
      logger.error("Audio playback error", err);
      cleanupCurrentPlayback();
    };
    const handlePlay = () => startProgressRaf(player, audio);
    const handlePause = () => stopProgressRaf(audio);
    const handleSeeked = () => updateProgressUI(player);
    const handleLoadedMeta = () => updateProgressUI(player);

    audio.__handleEnded = handleEnded;
    audio.__handleError = handleError;
    audio.__handlePlay = handlePlay;
    audio.__handlePause = handlePause;
    audio.__handleSeeked = handleSeeked;
    audio.__handleLoadedMeta = handleLoadedMeta;

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("seeked", handleSeeked);
    audio.addEventListener("loadedmetadata", handleLoadedMeta);
  }

  function startProgressRaf(player, audio) {
    if (!audio || !player) return;
    if (audio.__progressRafId != null) {
      cancelAnimationFrame(audio.__progressRafId);
      audio.__progressRafId = null;
    }
    const tick = () => {
      if (state.currentAudio !== audio) return;
      updateProgressUI(player);
      audio.__progressRafId = requestAnimationFrame(tick);
    };
    audio.__progressRafId = requestAnimationFrame(tick);
  }

  function stopProgressRaf(audio) {
    if (!audio || audio.__progressRafId == null) return;
    cancelAnimationFrame(audio.__progressRafId);
    audio.__progressRafId = null;
  }

  async function startPlayback(player, storyTextEl) {
    const storyText = storyTextEl.textContent ?? "";
    if (!storyText) {
      logger.warn("No story text found to convert to speech.");
      return;
    }

    cleanupCurrentPlayback({ resetPlayer: false, disposeAudio: false });
    state.currentPlayer = player;

    if (player.audio && player.audioUrl) {
      state.currentAudio = player.audio;
      state.currentAudioUrl = player.audioUrl;
      if (Number.isFinite(player.lastTime)) {
        try {
          state.currentAudio.currentTime = player.lastTime;
        } catch (err) {
          logger.warn("Failed to restore playback position", err);
        }
      }
      if (player.cachedEntry?.alignment) {
        Alignment.ensureWordData(player, storyTextEl, player.cachedEntry.alignment);
      }
      try {
        await state.currentAudio.play();
        setPlayerToPause(player);
        updateProgressUI(player);
      } catch (err) {
        logger.error("Audio playback failed", err);
        cleanupCurrentPlayback();
      }
      return;
    }

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
      if (cachedEntry.alignment) {
        Alignment.ensureWordData(player, storyTextEl, cachedEntry.alignment);
      }
    } else {
      logger("Cache miss for TTS audio");
      const result = await TTS.request(storyText, {
        onBeforeNetwork: () => {
          setPlayerToLoading(player);
        },
      });
      if (!result?.audioBlob) {
        setPlayerToListen(player);
        if (state.currentPlayer === player) {
          state.currentPlayer = null;
        }
        return;
      }
      player.cachedEntry = result;
      audio = attachBlobToPlayer(player, result.audioBlob);
      if (result.alignment) {
        Alignment.ensureWordData(player, storyTextEl, result.alignment);
      }
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

  return {
    setPlayerToListen,
    setPlayerToPause,
    setPlayerToLoading,
    updateProgressUI,
    cleanupCurrentPlayback,
    prepareCachedAudio,
    startPlayback,
  };
})();

const UI = (() => {
  function blockLeftClicks(container, exceptionEl) {
    if (!container || container.dataset.clickBlocked === "1") return;
    const handler = (e) => {
      if (e.button !== 0) return;
      const target = e.target;
      if (exceptionEl && (target === exceptionEl || exceptionEl.contains(target))) {
        return;
      }
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
    };
    container.addEventListener("click", handler, true);
    container.dataset.clickBlocked = "1";
  }

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
      .${CONFIG.classes.word} {
        padding: 0 0.12em;
        border-radius: 0.25em;
        transition: background 70ms linear;
      }
      .${CONFIG.classes.word}.${CONFIG.classes.wordPlaying} {
        background: rgba(255, 230, 0, 0.65);
      }
    `;
    document.head.appendChild(style);
  }

  function ensureButtonAboveStory(storyTextEl) {
    const paragraphContainer = storyTextEl.parentElement;
    if (!paragraphContainer) return;

    Text.wrapWordsInSpans(storyTextEl);

    const existing = paragraphContainer.previousElementSibling;
    if (existing && existing.classList.contains(CONFIG.classes.playerContainer)) {
      return;
    }

    const playerContainer = paragraphContainer.cloneNode(false);
    playerContainer.classList.add(CONFIG.classes.playerContainer);
    playerContainer.classList.remove("reached-end");

    const player = {
      container: playerContainer,
      playButton: null,
      playIcon: null,
      progress: null,
      audio: null,
      audioUrl: null,
      cachedEntry: null,
      cachePromise: null,
      isSeeking: false,
      lastTime: 0,
      lastDuration: 0,
      wordData: null,
      wordDataKey: "",
    };

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
    playIcon.innerHTML = htmlPolicy.createHTML(CONFIG.svg.play);

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
    progress.step = "any";
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
    Playback.setPlayerToListen(player);

    const storyText = storyTextEl.textContent ?? "";
    if (storyText) {
      player.cachePromise = Cache.getItem(storyText).then((cached) => {
        if (cached?.value?.audioBlob) {
          player.cachedEntry = cached.value;
          Playback.prepareCachedAudio(player, cached.value.audioBlob);
          if (cached.value.alignment) {
            Alignment.ensureWordData(player, storyTextEl, cached.value.alignment);
          }
          Playback.updateProgressUI(player);
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

      if (state.currentPlayer === player && state.currentAudio) {
        if (state.currentAudio.paused) {
          try {
            if (player.cachedEntry?.alignment) {
              Alignment.ensureWordData(player, storyTextEl, player.cachedEntry.alignment);
            }
            await state.currentAudio.play();
            Playback.setPlayerToPause(player);
          } catch (err) {
            logger.error("Resume failed", err);
            Playback.setPlayerToListen(player);
          }
        } else {
          state.currentAudio.pause();
          Playback.setPlayerToListen(player);
        }
        return;
      }

      await Playback.startPlayback(player, storyTextEl);
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
    const seekMove = () => {
      if (!progress.disabled) {
        const target = Number(progress.value);
        if (Number.isFinite(target)) {
          Highlight.at(player, target);
        }
      }
    };
    progress.addEventListener("mousedown", seekStart);
    progress.addEventListener("touchstart", seekStart, { passive: true });
    progress.addEventListener("input", seekMove);
    progress.addEventListener("mouseup", seekEnd);
    progress.addEventListener("touchend", seekEnd);
    progress.addEventListener("change", seekEnd);

    paragraphContainer.parentElement?.insertBefore(
      playerContainer,
      paragraphContainer
    );
    logger("Inserted TTS audio player above story text");

    blockLeftClicks(playerContainer, wrapper);
    blockLeftClicks(paragraphContainer, null);
  }

  function findCurrentStoryText() {
    const nodes = document.querySelectorAll(CONFIG.selectors.currentStoryText);
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

  return {
    ensureButtonAboveStory,
    findCurrentStoryText,
  };
})();

const Boot = (() => {
  function runOnce() {
    const allStoryTextEls = Array.from(
      document.querySelectorAll(CONFIG.selectors.storyText)
    );
    allStoryTextEls.forEach((el) => {
      UI.ensureButtonAboveStory(el);
    });
  }

  const debouncedRunOnce = debounce(runOnce, 200);

  function startObservers() {
    const observer = new MutationObserver(() => {
      debouncedRunOnce();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  }

  function init() {
    Cache.startEviction();
    runOnce();
    startObservers();
  }

  return {
    init,
  };
})();

(function () {
  logger("Script started");
  Boot.init();
})();
