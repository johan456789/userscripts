// ==UserScript==
// @name         Google Maps Language Selector
// @namespace    http://tampermonkey.net/
// @version      1.4.0
// @description  Adds a language selector button to Google Maps.
// @author       You
// @match        https://www.google.com/maps*
// @match        https://www.google.*/maps*
// @match        https://maps.google.com/*
// @match        https://maps.google.*/
// @grant        none
// @run-at       document-start
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @require      https://github.com/johan456789/userscripts/raw/main/utils/wait-for-element.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/google-maps-language-selector.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/google-maps-language-selector.js
// @license      MIT
// ==/UserScript==

(function () {
  "use strict";

  // Users can configure which language codes to show in the dropdown.
  // Use language codes for the 'hl' param. Display names come from LANGUAGE_CODE_TO_NAME.
  const ENABLED_LANGUAGES = ["zh-TW", "en"];
  const STORAGE_KEY = "google-maps-language-selector:hl";

  // Early redirect (runs at document-start, before first paint): apply the
  // persisted hl immediately so Maps loads once, in the right language, with
  // no flash and no post-render full refresh. location.replace avoids an
  // extra history entry. Only localStorage + location are touched here, so
  // this is safe before DOM exists.
  try {
    const earlyUrl = new URL(window.location.href);
    if (!earlyUrl.searchParams.get("hl")) {
      const earlyStored = window.localStorage.getItem(STORAGE_KEY);
      if (earlyStored && ENABLED_LANGUAGES.includes(earlyStored)) {
        earlyUrl.searchParams.set("hl", earlyStored);
        window.location.replace(earlyUrl.toString());
        return;
      }
    }
  } catch (e) {
    // Storage/URL unavailable – fall through to normal init below, which
    // re-checks before the button is built.
  }

  const logger = Logger("[Google-Maps-Language-Selector]");
  if (window.__googleMapsLangSelectorInitialized) {
    return;
  }
  window.__googleMapsLangSelectorInitialized = true;
  logger("Script started.");

  // Map of Google service 'hl' codes to display names (as in the table).
  const LANGUAGE_CODE_TO_NAME = {
    af: "\u202AAfrikaans\u202C",
    az: "\u202Aazərbaycan\u202C",
    id: "\u202ABahasa Indonesia\u202C",
    ms: "\u202ABahasa Melayu\u202C",
    bs: "\u202Abosanski\u202C",
    ca: "\u202Acatalà\u202C",
    cs: "\u202AČeština\u202C",
    da: "\u202ADansk\u202C",
    de: "\u202ADeutsch (Deutschland)\u202C",
    et: "\u202Aeesti\u202C",
    en: "\u202AEnglish (United States)\u202C",
    es: "\u202AEspañol (España)\u202C",
    "es-419": "\u202AEspañol (Latinoamérica)\u202C",
    eu: "\u202Aeuskara\u202C",
    fil: "\u202AFilipino\u202C",
    fr: "\u202AFrançais (France)\u202C",
    gl: "\u202Agalego\u202C",
    hr: "\u202AHrvatski\u202C",
    zu: "\u202AisiZulu\u202C",
    is: "\u202Aíslenska\u202C",
    it: "\u202AItaliano\u202C",
    sw: "\u202AKiswahili\u202C",
    lv: "\u202Alatviešu\u202C",
    lt: "\u202Alietuvių\u202C",
    hu: "\u202Amagyar\u202C",
    nl: "\u202ANederlands\u202C",
    no: "\u202Anorsk\u202C",
    uz: "\u202Aoʻzbekcha\u202C",
    pl: "\u202Apolski\u202C",
    "pt-BR": "\u202APortuguês (Brasil)\u202C",
    "pt-PT": "\u202APortuguês (Portugal)\u202C",
    ro: "\u202Aromână\u202C",
    sq: "\u202Ashqip\u202C",
    sk: "\u202ASlovenčina\u202C",
    sl: "\u202Aslovenščina\u202C",
    fi: "\u202ASuomi\u202C",
    sv: "\u202ASvenska\u202C",
    vi: "\u202ATiếng Việt\u202C",
    tr: "\u202ATürkçe\u202C",
    el: "\u202AΕλληνικά\u202C",
    bg: "\u202Aбългарски\u202C",
    ky: "\u202Aкыргызча\u202C",
    kk: "\u202Aқазақ тілі\u202C",
    mk: "\u202Aмакедонски\u202C",
    mn: "\u202Aмонгол\u202C",
    ru: "\u202AРусский\u202C",
    sr: "\u202Aсрпски (ћирилица)\u202C",
    uk: "\u202AУкраїнська\u202C",
    ka: "\u202Aქართული\u202C",
    hy: "\u202Aհայերեն\u202C",
    iw: "\u202Aעברית\u202C",
    ur: "\u202Aاردو\u202C",
    ar: "\u202Aالعربية\u202C",
    fa: "\u202Aفارسی\u202C",
    am: "\u202Aአማርኛ\u202C",
    ne: "\u202Aनेपाली\u202C",
    hi: "\u202Aहिन्दी\u202C",
    mr: "\u202Aमराठी\u202C",
    bn: "\u202Aবাংলা\u202C",
    pa: "\u202Aਪੰਜਾਬੀ\u202C",
    gu: "\u202Aગુજરાતી\u202C",
    ta: "\u202Aதமிழ்\u202C",
    te: "\u202Aతెలుగు\u202C",
    kn: "\u202Aಕನ್ನಡ\u202C",
    ml: "\u202Aമലയാളം\u202C",
    si: "\u202Aසිංහල\u202C",
    th: "\u202Aไทย\u202C",
    lo: "\u202Aລາວ\u202C",
    my: "\u202Aဗမာ\u202C",
    km: "\u202Aខ្មែរ\u202C",
    ko: "\u202A한국어\u202C",
    ja: "\u202A日本語\u202C",
    "zh-CN": "\u202A简体中文\u202C",
    "zh-TW": "\u202A繁體中文\u202C",
  };

  const CONTAINER_SELECTOR = "#gb [data-ogsr-up], #gb > div";
  const BUTTON_ID = "google-maps-language-selector-button";
  // Wrapper is layout only; the <select> built below is the trigger.
  // NOTE: no Google internal classes anywhere – Google's JS upgrades elements
  // bearing its own classes and wipes their children.
  // Icon: official Google Symbols "translate" ligature (renders as 文A),
  // exactly like Google's own header icons. Font by the Maps page itself.
  const BUTTON_WRAPPER_HTML =
    '<div id="google-maps-language-selector-button"></div>';

  function getCurrentHlParam() {
    try {
      const url = new URL(window.location.href);
      const values = url.searchParams.getAll("hl");
      if (!values || values.length === 0) return null;
      const last = values[values.length - 1];
      return last || null;
    } catch (e) {
      logger.error("Failed to read hl param from URL", e);
      return null;
    }
  }

  // Persisted choice (localStorage, no GM grant needed). URL `hl` is the
  // source of truth when present; storage carries it across sessions that
  // start without `hl`. STORAGE_KEY is defined at the top for the early
  // redirect.
  function getStoredHl() {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      return value && ENABLED_LANGUAGES.includes(value) ? value : null;
    } catch (e) {
      logger.error("Failed to read stored language", e);
      return null;
    }
  }

  function setStoredHl(code) {
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch (e) {
      logger.error("Failed to store language", e);
    }
  }

  function createButtonElement() {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = BUTTON_WRAPPER_HTML;
    const element = wrapper.firstElementChild;
    if (element && element.style) {
      element.style.position = "relative";
      element.style.display = "flex";
      element.style.alignItems = "center";
      element.style.justifyContent = "center";
      element.style.flex = "0 0 auto";
      element.style.minWidth = "40px";
      element.style.minHeight = "40px";
      element.style.marginLeft = "8px";
      element.style.zIndex = "2147483646";
    }
    function navigateWithLanguage(code) {
      // No need to check existing 'hl' parameter; Google uses the last one.
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("hl", code);
        logger("Navigating to", url.toString());
        window.location.href = url.toString();
      } catch (error) {
        logger.error(
          "URL construction failed, falling back to manual query update.",
          error
        );
        try {
          let href = window.location.href;
          const hashIndex = href.indexOf("#");
          const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
          href = hashIndex >= 0 ? href.slice(0, hashIndex) : href;

          const qIndex = href.indexOf("?");
          const base = qIndex >= 0 ? href.slice(0, qIndex) : href;
          let query = qIndex >= 0 ? href.slice(qIndex + 1) : "";

          if (query) {
            query = query
              .split("&")
              .filter((pair) => pair && !pair.startsWith("hl="))
              .join("&");
          }

          const hlPart = "hl=" + encodeURIComponent(code);
          query = query ? query + "&" + hlPart : hlPart;
          window.location.href = base + "?" + query + hash;
        } catch (e2) {
          // If everything fails, last resort: append (may duplicate)
          const separator = window.location.href.includes("?") ? "&" : "?";
          window.location.href =
            window.location.href + separator + "hl=" + encodeURIComponent(code);
        }
      }
    }

    // Native customizable <select> (appearance: base-select). Supporting
    // browsers get the styled circle trigger + anchored picker; the rest get
    // a plain classic select (progressive enhancement, no custom menu).
    // NOTE: in classic rendering the inner <button> is ignored by the browser.
    ensureBaseSelectStyles();
    const select = document.createElement("select");
    select.id = BUTTON_ID + "-select";
    select.setAttribute("aria-label", "Choose language");
    select.title = "Switch language";
    // Select button: static official icon only (no <selectedcontent>).
    const trigger = document.createElement("button");
    const icon = document.createElement("span");
    icon.className = "google-symbols";
    icon.setAttribute("aria-hidden", "true");
    icon.style.cssText =
      "font-size:20px;line-height:1;color:#5f6368;user-select:none";
    icon.textContent = "translate";
    trigger.appendChild(icon);
    select.appendChild(trigger);
    // Hidden placeholder: selected when no language is in effect, so no
    // language option shows a tick. Never visible in the trigger (static
    // icon) nor in the picker list (hidden).
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.hidden = true;
    placeholder.textContent = "Choose language";
    select.appendChild(placeholder);
    ENABLED_LANGUAGES.forEach((code) => {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = LANGUAGE_CODE_TO_NAME[code] || code;
      select.appendChild(opt);
    });
    // Resolve effective language: URL wins and is persisted; otherwise apply
    // the persisted choice (reloads once with hl); otherwise no tick.
    const urlHl = getCurrentHlParam();
    if (urlHl && ENABLED_LANGUAGES.includes(urlHl)) {
      setStoredHl(urlHl);
      select.value = urlHl;
    } else if (!urlHl) {
      const storedHl = getStoredHl();
      if (storedHl) {
        navigateWithLanguage(storedHl);
      } else {
        select.value = "";
      }
    } else {
      select.value = "";
    }
    select.addEventListener("change", () => {
      if (select.value) {
        setStoredHl(select.value);
        navigateWithLanguage(select.value);
      }
    });
    element.appendChild(select);
    return element;
  }

  function ensureBaseSelectStyles() {
    if (document.querySelector("style[data-gmls-base-select]")) return;
    const style = document.createElement("style");
    style.setAttribute("data-gmls-base-select", "");
    // Classic rendering (unsupported browsers): plain functional select.
    // Custom circle trigger + picker only where base-select is supported.
    const id = `#${BUTTON_ID}-select`;
    style.textContent = `
      ${id} {
        height: 40px;
        max-width: 220px;
        margin: 0;
        cursor: pointer;
        font-family: Roboto, Arial, sans-serif;
        font-size: 14px;
        color: #202124;
      }
      @supports (appearance: base-select) {
        ${id}, ${id}::picker(select) {
          appearance: base-select;
        }
        ${id} {
          width: 40px;
          padding: 0;
          border: none;
          background: transparent;
          cursor: pointer;
        }
        ${id} > button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border: none;
          padding: 0;
          margin: 0;
          border-radius: 20px;
          background: #fff;
          box-shadow: 0 1px 2px rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15);
          cursor: pointer;
        }
        ${id}::picker-icon {
          display: none;
        }
        ${id}::picker(select) {
          top: calc(anchor(bottom) + 8px);
          left: auto;
          right: 8px;
          min-width: 180px;
          max-width: min(280px, calc(100vw - 16px));
          max-height: min(60vh, 400px);
          overflow-y: auto;
          background: #fff;
          border: 1px solid #dadce0;
          border-radius: 8px;
          box-shadow: 0 1px 2px rgba(60, 64, 67, 0.3), 0 2px 6px 2px rgba(60, 64, 67, 0.15);
          padding: 4px 0;
          font-family: Roboto, Arial, sans-serif;
        }
        ${id} option {
          padding: 10px 16px;
          font-size: 14px;
          line-height: 20px;
          color: #202124;
        }
        ${id} option:hover, ${id} option:focus {
          background: #f1f3f4;
        }
        ${id} option:checked {
          background: #e8f0fe;
          font-weight: 500;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function insertButton(container, buttonEl) {
    const profileButton =
      container.querySelector('a[aria-label*="Google Account"]') ||
      container.querySelector('a[href*="SignOutOptions"]') ||
      container.querySelector("img.gbii")?.closest("a");

    if (profileButton) {
      let insertionTarget = profileButton;
      while (insertionTarget.parentElement && insertionTarget.parentElement !== container) {
        insertionTarget = insertionTarget.parentElement;
      }
      insertionTarget.insertAdjacentElement("afterend", buttonEl);
      logger("Language selector inserted after the profile button.");
      return;
    }

    container.appendChild(buttonEl);
    logger("Language selector inserted in the account controls.");
  }

  // waitForElement observes document.body, which may not exist yet at
  // document-start. Defer until it does.
  function startWhenBodyReady() {
    if (document.body) {
      waitForElement(
        CONTAINER_SELECTOR,
        (container) => {
          logger("Container found:", container);
          if (document.getElementById(BUTTON_ID)) {
            logger("Language selector already inserted.");
            return;
          }
          const buttonEl = createButtonElement();
          if (!buttonEl) {
            logger.error("Failed to create button element.");
            return;
          }

          insertButton(container, buttonEl);
        },
        10000
      );
    } else {
      document.addEventListener("DOMContentLoaded", startWhenBodyReady, {
        once: true,
      });
    }
  }
  startWhenBodyReady();
})();
