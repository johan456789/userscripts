// ==UserScript==
// @name         Google Maps Language Selector
// @namespace    http://tampermonkey.net/
// @version      1.1.2
// @description  Adds a language selector button to Google Maps.
// @author       You
// @match        https://www.google.com/maps*
// @match        https://www.google.*/maps*
// @match        https://maps.google.com/*
// @match        https://maps.google.*/
// @grant        none
// @run-at       document-end
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @require      https://github.com/johan456789/userscripts/raw/main/utils/wait-for-element.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/google-maps-language-selector.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/google-maps-language-selector.js
// @license      MIT
// ==/UserScript==

(function () {
  "use strict";

  const logger = Logger("[Google-Maps-Language-Selector]");
  if (window.__googleMapsLangSelectorInitialized) {
    return;
  }
  window.__googleMapsLangSelectorInitialized = true;
  logger("Script started.");

  // Users can configure which language codes to show in the dropdown.
  // Use language codes for the 'hl' param. Display names come from LANGUAGE_CODE_TO_NAME.
  const ENABLED_LANGUAGES = ["zh-TW", "en"];

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

  const CONTAINER_SELECTOR = "#gb div.gb_Ad";
  // Only Tc0rEd Zf54rc are required for the white squircle background. Center icon via inline flex styles.
  const BUTTON_WRAPPER_HTML =
    '<div class="gb_z gb_td gb_Pf gb_0"><button class="Tc0rEd Zf54rc" style="display:flex;align-items:center;justify-content:center"><span class="google-symbols" style="font-size: 18px; line-height: 1;"></span></button></div>';

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

  function createButtonElement() {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = BUTTON_WRAPPER_HTML;
    const element = wrapper.firstElementChild;
    // Make wrapper a positioning context so the dropdown can overlay without shifting layout
    if (element && element.style) {
      element.style.position = "relative";
    }
    const button = element.querySelector("button");
    if (button) {
      button.type = "button";
      button.title = "Switch language";
    }

    // Create a native <select> that we will open programmatically.
    // Keep it visually hidden and absolutely positioned so it does not affect layout.
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Choose language");
    select.style.position = "absolute";
    select.style.top = "0";
    select.style.left = "0";
    select.style.opacity = "0";
    select.style.pointerEvents = "none";
    select.style.zIndex = "2147483647";

    // Placeholder option so no language is selected by default when no hl param is present
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.hidden = false;
    placeholder.disabled = true;
    placeholder.selected = true;
    placeholder.textContent = "Select language";
    select.appendChild(placeholder);

    // Populate options from ENABLED_LANGUAGES using LANGUAGE_CODE_TO_NAME
    ENABLED_LANGUAGES.forEach((code) => {
      const display = LANGUAGE_CODE_TO_NAME[code] || code;
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = display;
      select.appendChild(opt);
    });

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

    // Open the dropdown on button click without moving the button.
    if (button) {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        try {
          // Preselect option based on current URL 'hl' param; default to placeholder if absent/invalid
          const currentHl = getCurrentHlParam();
          if (currentHl && ENABLED_LANGUAGES.includes(currentHl)) {
            select.value = currentHl;
          } else {
            select.value = "";
          }
          // Place the select over the button to avoid layout shift
          const rect = button.getBoundingClientRect();
          const parentRect = element.getBoundingClientRect();
          const GAP_PX = 8; // small visual gap between button and list
          const topWithinParent = rect.top - parentRect.top;
          const left = rect.left - parentRect.left;
          // Anchor the picker just below the button
          select.style.top = topWithinParent + rect.height + GAP_PX + "px";
          select.style.left = left + "px";
          select.style.minWidth = rect.width + "px";

          // Enable interactions
          select.style.pointerEvents = "auto";
          select.style.opacity = "0";

          // Prefer native showPicker if available to show options only
          if (typeof select.showPicker === "function") {
            // Ensure it's not display:none so showPicker works
            select.showPicker();
            // After opening, immediately disable pointer events; browser keeps the picker open
            setTimeout(() => {
              select.style.pointerEvents = "none";
            }, 0);
          } else {
            // Fallback: display a sized list positioned under the button
            select.size = Math.min(ENABLED_LANGUAGES.length, 10);
            select.style.opacity = "1";
            select.style.pointerEvents = "auto";
            // Position list just below the button (same gap)
            select.style.top = topWithinParent + rect.height + GAP_PX + "px";
            // Hide it again when it loses focus
            const hide = () => {
              select.removeEventListener("blur", hide);
              select.style.opacity = "0";
              select.style.pointerEvents = "none";
              select.removeAttribute("size");
            };
            select.addEventListener("blur", hide);
            select.focus();
          }
        } catch (e) {
          logger.error("Failed to open language dropdown", e);
        }
      });
    }

    // Handle selection
    select.addEventListener("change", () => {
      const code = select.value;
      if (code) {
        navigateWithLanguage(code);
      }
    });

    // Insert the select into our element wrapper next to the button
    element.appendChild(select);
    return element;
  }

  waitForElement(
    CONTAINER_SELECTOR,
    (container) => {
      logger("Container found:", container);
      const buttonEl = createButtonElement();
      if (!buttonEl) {
        logger.error("Failed to create button element.");
        return;
      }

      const firstItem = container.firstElementChild;
      if (firstItem && firstItem.nextSibling) {
        container.insertBefore(buttonEl, firstItem.nextSibling);
      } else if (firstItem) {
        container.appendChild(buttonEl);
      } else {
        container.appendChild(buttonEl);
      }
      logger("Language selector inserted after the first item.");
    },
    10000
  );
})();
