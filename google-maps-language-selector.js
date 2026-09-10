// ==UserScript==
// @name         Google Maps Language Selector
// @namespace    http://tampermonkey.net/
// @version      1.2.0
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

  const CONTAINER_SELECTOR = "#gb [data-ogsr-up], #gb > div";
  const BUTTON_ID = "google-maps-language-selector-button";
  // NOTE: do NOT put Google's internal component classes (e.g. Tc0rEd, Zf54rc)
  // on our button. Google's JS upgrades elements bearing its own classes after
  // page load and wipes their children – that is why the icon flashed for a
  // split second after refresh and then vanished. The circle is styled with
  // plain inline CSS so Google leaves it alone.
  // Icon: official Google Symbols "translate" ligature (renders as 文A),
  // exactly like Google's own header icons (e.g. the apps grid next to it).
  // The font is loaded by the Maps page itself, so no custom font/SVG/text.
  const BUTTON_WRAPPER_HTML =
    '<div id="google-maps-language-selector-button"><button type="button" title="Switch language" aria-label="Switch language" style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border:none;padding:0;margin:0;border-radius:20px;background:#fff;box-shadow:0 1px 2px rgba(60,64,67,.3),0 1px 3px 1px rgba(60,64,67,.15);cursor:pointer"><span class="google-symbols" aria-hidden="true" style="font-size:20px;line-height:1;color:#5f6368;user-select:none">translate</span></button></div>';

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
    if (element && element.style) {
      element.style.position = "relative";
      element.style.display = "flex";
      element.style.alignItems = "center";
      element.style.justifyContent = "center";
      element.style.flex = "0 0 auto";
      element.style.width = "40px";
      element.style.height = "40px";
      element.style.marginLeft = "8px";
      element.style.zIndex = "2147483646";
    }
    const button = element.querySelector("button");
    if (button) {
      button.type = "button";
      button.title = "Switch language";
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

    // Build a custom dropdown menu (fixed-position, viewport-aware) instead of
    // native <select> + showPicker. Native pickers are anchored to the select's
    // box and cannot be clamped to the viewport reliably; when the button is at
    // the far right (after the profile avatar) the picker overflows and gets
    // clipped ("Select la..." in the bug report).
    // Semantic list markup: ul[role=menu] > li[role=none] > button[role=menuitem].
    // Real <button> elements give keyboard/AT semantics for free.
    const menu = document.createElement("ul");
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "Choose language");
    menu.id = BUTTON_ID + "-menu";
    menu.style.position = "fixed";
    menu.style.display = "none";
    menu.style.flexDirection = "column";
    menu.style.minWidth = "180px";
    menu.style.maxWidth = "min(280px, calc(100vw - 16px))";
    menu.style.maxHeight = "min(60vh, 400px)";
    menu.style.overflowY = "auto";
    menu.style.background = "#fff";
    menu.style.border = "1px solid #dadce0";
    menu.style.borderRadius = "8px";
    menu.style.boxShadow =
      "0 1px 2px rgba(60,64,67,.3), 0 2px 6px 2px rgba(60,64,67,.15)";
    menu.style.zIndex = "2147483647";
    menu.style.padding = "4px 0";
    menu.style.margin = "0";
    menu.style.listStyle = "none";
    menu.style.fontFamily = "Roboto, Arial, sans-serif";

    function createMenuItem(label, code, opts) {
      const li = document.createElement("li");
      li.setAttribute("role", "none");
      li.style.margin = "0";
      li.style.padding = "0";
      const item = document.createElement("button");
      item.type = "button";
      item.setAttribute("role", "menuitem");
      if (opts && opts.selected) item.setAttribute("aria-current", "true");
      item.dataset.langCode = code || "";
      item.style.display = "block";
      item.style.width = "100%";
      item.style.boxSizing = "border-box";
      item.style.border = "none";
      item.style.background = opts && opts.selected ? "#e8f0fe" : "transparent";
      item.style.padding = "10px 16px";
      item.style.fontSize = "14px";
      item.style.lineHeight = "20px";
      item.style.fontFamily = "inherit";
      item.style.textAlign = "left";
      item.style.cursor = "pointer";
      item.style.whiteSpace = "nowrap";
      item.style.overflow = "hidden";
      item.style.textOverflow = "ellipsis";
      item.style.color = "#202124";
      if (opts && opts.selected) {
        item.style.fontWeight = "500";
      }
      item.addEventListener("mouseenter", () => {
        if (!(opts && opts.selected)) item.style.background = "#f1f3f4";
      });
      item.addEventListener("mouseleave", () => {
        item.style.background = opts && opts.selected ? "#e8f0fe" : "transparent";
      });
      item.addEventListener("click", () => {
        if (code) navigateWithLanguage(code);
      });
      item.textContent = label;
      li.appendChild(item);
      return li;
    }

    function rebuildMenu() {
      menu.innerHTML = "";
      const currentHl = getCurrentHlParam();
      ENABLED_LANGUAGES.forEach((code) => {
        const display = LANGUAGE_CODE_TO_NAME[code] || code;
        const isSelected = currentHl === code;
        menu.appendChild(createMenuItem(display, code, { selected: isSelected }));
      });
    }

    function positionMenu() {
      // Ensure menu is measurable but not visible for sizing
      const prevDisplay = menu.style.display;
      const prevVisibility = menu.style.visibility;
      menu.style.visibility = "hidden";
      menu.style.display = "flex";
      // Force layout
      const menuWidth = menu.offsetWidth;
      const menuHeight = menu.offsetHeight;
      menu.style.display = prevDisplay;
      menu.style.visibility = prevVisibility;

      const rect = button.getBoundingClientRect();
      const GAP = 8;
      const MARGIN = 8;

      // Prefer anchoring the menu's right edge to the button's right edge
      // (button is at the viewport's right side after the profile avatar).
      let left = rect.right - menuWidth;
      // If menu narrower than button, left-align instead to avoid gap
      if (menuWidth < rect.width) left = rect.left;

      // Clamp horizontally inside viewport
      left = Math.max(MARGIN, Math.min(left, window.innerWidth - menuWidth - MARGIN));

      // Vertical: below button if fits, otherwise above
      let top = rect.bottom + GAP;
      if (top + menuHeight > window.innerHeight - MARGIN) {
        const above = rect.top - GAP - menuHeight;
        if (above >= MARGIN) {
          top = above;
        } else {
          // Not enough space either way: clamp and let it scroll
          top = Math.max(MARGIN, window.innerHeight - menuHeight - MARGIN);
        }
      }

      menu.style.left = left + "px";
      menu.style.top = top + "px";
    }

    let menuOpen = false;
    function openMenu() {
      rebuildMenu();
      menu.style.display = "flex";
      positionMenu();
      // Make visible after positioning
      menu.style.visibility = "visible";
      menuOpen = true;
    }
    function closeMenu() {
      menu.style.display = "none";
      menu.style.visibility = "";
      menuOpen = false;
    }

    // Append menu to body (fixed positioning, not clipped by #gb)
    document.body.appendChild(menu);

    if (button) {
      button.setAttribute("aria-haspopup", "menu");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-controls", menu.id);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          if (menuOpen) {
            closeMenu();
            button.setAttribute("aria-expanded", "false");
          } else {
            openMenu();
            button.setAttribute("aria-expanded", "true");
          }
        } catch (e) {
          logger.error("Failed to open language dropdown", e);
        }
      });
    }

    // Auto-dismiss like a native dropdown: any pointerdown outside (capture
    // phase, so map pans/zooms register even though they never fire "click"
    // and Maps may stopPropagation), wheel-zoom, page scroll, tabbing away,
    // or Escape. Resize only repositions since the button is still visible.
    function dismissMenu() {
      if (!menuOpen) return;
      closeMenu();
      if (button) button.setAttribute("aria-expanded", "false");
    }
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (!menuOpen) return;
        if (element.contains(e.target) || menu.contains(e.target)) return;
        dismissMenu();
      },
      true
    );
    document.addEventListener(
      "wheel",
      () => {
        dismissMenu();
      },
      { capture: true, passive: true }
    );
    window.addEventListener(
      "scroll",
      (e) => {
        if (!menuOpen) return;
        // Keep the menu usable when scrolling inside it; dismiss otherwise.
        if (menu.contains(e.target)) return;
        dismissMenu();
      },
      true
    );
    document.addEventListener("focusin", (e) => {
      if (!menuOpen) return;
      if (element.contains(e.target) || menu.contains(e.target)) return;
      dismissMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menuOpen) {
        dismissMenu();
        if (button) button.focus();
      }
    });
    window.addEventListener("resize", () => {
      if (menuOpen) positionMenu();
    });

    // Keep a reference for cleanup / debugging
    element._langMenu = menu;
    return element;
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
})();
