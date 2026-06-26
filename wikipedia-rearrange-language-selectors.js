// ==UserScript==
// @name           Wikipedia rearrange other languages
// @namespace      none
// @include        http://*.wikipedia.org/wiki/*
// @include        https://*.wikipedia.org/wiki/*
// @include        https://zh.wikipedia.org/*/*
// @description    Rearranges the "other languages" section of Wikipedia
// @version        1.4.0
// @run-at         document-end
// @require        https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL      https://github.com/johan456789/userscripts/raw/main/wikipedia-rearrange-language-selectors.js
// @downloadURL    https://github.com/johan456789/userscripts/raw/main/wikipedia-rearrange-language-selectors.js
// ==/UserScript==

(function () {
  "use strict";

  const logger = Logger("[Wikipedia-Rearrange-Languages]");

  const myLangs = [
    "en",
    "simple",
    "zh",
    "zh-classical",
    "ja",
    "es",
    "pt",
    "fr",
    "ar",
    "ru",
  ];

  // Legacy sidebar: when true and no preferred langs are found, remove the language portlet entirely
  const removeOthers = true;
  // Vector 2022 sidebar: when true, hide the "Other languages" group (Preferred and Suggested still shown)
  const hideOtherLanguageGroups = true;

  const VECTOR_2022_MENU_SELECTOR = ".uls-rewrite";
  const VECTOR_2022_SIDEBAR_SELECTOR =
    "#content .vector-column-end .vector-sticky-pinned-container";
  const VECTOR_2022_FIRST_SECTION_SELECTOR =
    ":scope > nav.vector-page-tools-landmark, :scope > nav.vector-appearance-landmark";
  const VECTOR_2022_PORTLET_ID = "p-lang-userscript";
  const VECTOR_2022_STYLE_ID = "wikipedia-rearrange-languages-style";
  const VECTOR_2022_BODY_CLASS =
    "wikipedia-rearrange-languages-vector-2022";
  const VECTOR_2022_CAPTURING_CLASS =
    "wikipedia-rearrange-languages-capturing";

  function waitForElement(selector, timeoutMs) {
    const existing = document.querySelector(selector);
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve) => {
      let done = false;
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el && !done) {
          done = true;
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        if (!done) {
          done = true;
          observer.disconnect();
          resolve(null);
        }
      }, timeoutMs);

      const poll = setInterval(() => {
        const el = document.querySelector(selector);
        if (el && !done) {
          done = true;
          observer.disconnect();
          clearInterval(poll);
          resolve(el);
        }
      }, 200);
      setTimeout(() => clearInterval(poll), timeoutMs);
    });
  }

  init().catch((error) => {
    logger.error("Initialization failed.", error);
  });

  async function init() {
    if (document.hidden) {
      await new Promise((resolve) => {
        document.addEventListener("visibilitychange", resolve, { once: true });
      });
    }

    const legacyPortlet = document.querySelector("#p-lang");
    if (legacyPortlet) {
      rearrangeLegacyLanguages(legacyPortlet);
      return;
    }

    const languageButton = document.querySelector("#p-lang-btn-checkbox");
    if (languageButton) {
      await addVector2022Languages(languageButton);
    }
  }

  function rearrangeLegacyLanguages(portlet) {
    const list = portlet.querySelector(".vector-menu-content-list, ul");
    if (!list) {
      return;
    }

    const items = Array.from(list.children).filter((item) =>
      item.matches("li.interlanguage-link")
    );

    const preferred = sortPreferredItems(items);

    if (removeOthers && preferred.length === 0) {
      portlet.remove();
      return;
    }

    const itemsToShow = removeOthers
      ? preferred
      : preferred.concat(items.filter((item) => !preferred.includes(item)));

    list.replaceChildren(...itemsToShow);
  }

  function waitForStableDOM(element, debounceMs, timeoutMs) {
    return new Promise((resolve) => {
      let done = false;
      let timer;

      function finish() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        observer.disconnect();
        resolve();
      }

      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(finish, debounceMs);
      });
      observer.observe(element, { childList: true, subtree: true });

      timer = setTimeout(finish, debounceMs);
      setTimeout(finish, timeoutMs);
    });
  }

  async function addVector2022Languages(languageButton) {
    const sidebar = document.querySelector(VECTOR_2022_SIDEBAR_SELECTOR);
    if (!sidebar) {
      logger.warn("Vector 2022 sidebar was not found.");
      return;
    }

    injectVector2022Styles();
    document.body.classList.add(VECTOR_2022_BODY_CLASS);

    const preferredLanguages = readPreferredLanguagesFromButton(
      languageButton.closest("#p-lang-btn")
    );
    const initialGroups =
      preferredLanguages.length > 0
        ? [
            {
              title: "Preferred languages",
              languages: preferredLanguages,
            },
          ]
        : [];
    insertLanguagePortlet(sidebar, initialGroups);

    document.body.classList.add(VECTOR_2022_CAPTURING_CLASS);

    try {
      let menu;
      for (let attempt = 1; attempt <= 2; attempt++) {
        languageButton.click();
        menu = await waitForElement(VECTOR_2022_MENU_SELECTOR, 500);
        if (menu) break;
      }

      if (!menu) {
        logger.warn("Could not open the Vector 2022 language menu.");
        return;
      }

      await waitForStableDOM(menu, 300, 5000);
      const languageGroups = readLanguageGroups(menu);
      languageButton.click();
      await delay(50);

      if (languageGroups.length === 0) {
        logger.warn(
          "The Vector 2022 language menu contained no usable languages."
        );
        return;
      }

      updateLanguagePortlet(languageGroups);
      logger("Updated Vector 2022 language portlet.");
    } finally {
      document.body.classList.remove(VECTOR_2022_CAPTURING_CLASS);
    }
  }

  function readLanguageGroups(menu) {
    const suggestedLanguages = [];
    const allLanguages = [];

    for (const section of menu.querySelectorAll(".uls-rewrite__section")) {
      const languages = Array.from(
        section.querySelectorAll(
          ".uls-rewrite__language-item.interlanguage-link"
        )
      )
        .map(readLanguage)
        .filter(Boolean);

      if (section.classList.contains("uls-rewrite__section--suggested")) {
        suggestedLanguages.push(...languages);
      } else {
        allLanguages.push(...languages);
      }
    }

    const allByCode = new Map();
    for (const lang of [...suggestedLanguages, ...allLanguages]) {
      if (lang?.code && !allByCode.has(lang.code)) {
        allByCode.set(lang.code, lang);
      }
    }

    const atReadItems = [...document.querySelectorAll(".uls-rewrite__section--all .uls-rewrite__language-item")];
    const atReadCodes = new Set(atReadItems.map(el => (el.className.match(/(?:^|\s)interwiki-([^\s]+)/) || [])[1]));
    const atReadBinary = myLangs.map((code) => (atReadCodes.has(code) ? "1" : "0")).join("");
    logger(`All section AT READ: ${atReadItems.length} total, presence: ${atReadBinary}`);
    const preferredLanguages = myLangs
      .map((code) => allByCode.get(code))
      .filter(Boolean);

    const preferredCodes = new Set(preferredLanguages.map((l) => l.code));

    const remainingSuggested = suggestedLanguages.filter(
      (l) => !preferredCodes.has(l.code)
    );

    const suggestedCodes = new Set(suggestedLanguages.map((l) => l.code));
    const remainingAll = allLanguages.filter(
      (l) => !preferredCodes.has(l.code) && !suggestedCodes.has(l.code)
    );

    const groups = [];
    if (preferredLanguages.length > 0) {
      groups.push({
        title: "Preferred languages",
        languages: preferredLanguages,
      });
    }
    if (remainingSuggested.length > 0) {
      groups.push({
        title: "Suggested languages",
        languages: remainingSuggested,
      });
    }
    if (remainingAll.length > 0 && !hideOtherLanguageGroups) {
      groups.push({
        title: "Other languages",
        languages: remainingAll,
      });
    }

    return groups;
  }

  function readLanguage(item) {
    const link = item.querySelector("a");
    if (!link) {
      return null;
    }

    return {
      code:
        getLanguageCode(item) ||
        item.dataset.languageCode ||
        item.dataset.code,
      name: link.textContent.trim(),
      href: link.href,
      title: link.title,
      lang: link.lang || item.lang,
      dir: link.dir || item.dir,
      hreflang: link.hreflang,
    };
  }

  function readPreferredLanguagesFromButton(portlet) {
    if (!portlet) {
      return [];
    }

    const languages = Array.from(
      portlet.querySelectorAll(
        ".vector-menu-content-list li.interlanguage-link"
      )
    )
      .map(readLanguage)
      .filter(Boolean);
    return getPreferredLanguages([{ languages }]);
  }

  function insertLanguagePortlet(sidebar, groups) {
    const existingPortlet = document.querySelector(
      `#${VECTOR_2022_PORTLET_ID}`
    );
    if (existingPortlet) {
      updateLanguagePortlet(groups);
      return;
    }

    const nav = document.createElement("nav");
    nav.id = VECTOR_2022_PORTLET_ID;
    nav.className = "vector-language-landmark";
    nav.setAttribute("aria-label", "Languages");

    const pinnedContainer = document.createElement("div");
    pinnedContainer.className = "vector-pinned-container";

    const pinnableElement = document.createElement("div");
    pinnableElement.className = "vector-language vector-pinnable-element";

    const header = document.createElement("div");
    header.className =
      "vector-pinnable-header vector-language-pinnable-header vector-pinnable-header-pinned";

    const headerLabel = document.createElement("div");
    headerLabel.className = "vector-pinnable-header-label";
    headerLabel.textContent = "Languages";
    header.appendChild(headerLabel);
    pinnableElement.appendChild(header);

    renderLanguageGroups(pinnableElement, groups);

    pinnedContainer.appendChild(pinnableElement);
    nav.appendChild(pinnedContainer);

    const firstSection = sidebar.querySelector(
      VECTOR_2022_FIRST_SECTION_SELECTOR
    );
    sidebar.insertBefore(nav, firstSection);
  }

  function updateLanguagePortlet(groups) {
    const pinnableElement = document.querySelector(
      `#${VECTOR_2022_PORTLET_ID} .vector-pinnable-element`
    );
    if (!pinnableElement) {
      return;
    }

    renderLanguageGroups(pinnableElement, groups);
  }

  function renderLanguageGroups(pinnableElement, groups) {
    pinnableElement
      .querySelectorAll(":scope > .vector-language-region")
      .forEach((region) => region.remove());

    for (const group of groups) {
      pinnableElement.appendChild(createLanguageGroup(group));
    }
  }

  function createLanguageGroup(group) {
    const portlet = document.createElement("div");
    portlet.className = "vector-menu mw-portlet vector-language-region";

    const heading = document.createElement("div");
    heading.className = "vector-menu-heading";
    heading.textContent = group.title;
    portlet.appendChild(heading);

    const content = document.createElement("div");
    content.className = "vector-menu-content";

    const list = document.createElement("ul");
    list.className = "vector-menu-content-list";

    for (const language of group.languages) {
      const item = document.createElement("li");
      item.className = `interlanguage-link interwiki-${language.code} mw-list-item`;

      const link = document.createElement("a");
      link.textContent = language.name;
      link.href = language.href;
      setOptionalAttribute(link, "title", language.title);
      setOptionalAttribute(link, "lang", language.lang);
      setOptionalAttribute(link, "dir", language.dir);
      setOptionalAttribute(link, "hreflang", language.hreflang);

      item.appendChild(link);
      list.appendChild(item);
    }

    content.appendChild(list);
    portlet.appendChild(content);
    return portlet;
  }

  function sortPreferredItems(items) {
    const byCode = new Map(items.map((item) => [getLanguageCode(item), item]));
    return myLangs.map((code) => byCode.get(code)).filter(Boolean);
  }

  function getPreferredLanguages(groups) {
    const byCode = new Map();
    for (const group of groups) {
      for (const language of group.languages) {
        if (!byCode.has(language.code)) {
          byCode.set(language.code, language);
        }
      }
    }

    return myLangs.map((code) => byCode.get(code)).filter(Boolean);
  }

  function getLanguageCode(item) {
    const match = item.className.match(/(?:^|\s)interwiki-([^\s]+)/);
    return match ? match[1] : "";
  }

  function setOptionalAttribute(element, name, value) {
    if (value) {
      element.setAttribute(name, value);
    }
  }

  function delay(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function injectVector2022Styles() {
    if (document.querySelector(`#${VECTOR_2022_STYLE_ID}`)) {
      return;
    }

    const style = document.createElement("style");
    style.id = VECTOR_2022_STYLE_ID;
    style.textContent = `
      @media (min-width: 1120px) {
        .${VECTOR_2022_BODY_CLASS} .mw-body {
          column-gap: 24px;
        }

        .${VECTOR_2022_BODY_CLASS} .vector-column-end {
          width: 12.25rem;
        }
      }

      @media (min-width: 1680px) {
        .${VECTOR_2022_BODY_CLASS} .vector-column-end {
          width: 15.5rem;
        }
      }

      body.${VECTOR_2022_CAPTURING_CLASS} .uls-rewrite {
        visibility: hidden !important;
      }

      #${VECTOR_2022_PORTLET_ID},
      #${VECTOR_2022_PORTLET_ID} .vector-pinned-container,
      #${VECTOR_2022_PORTLET_ID} .vector-pinnable-element,
      #${VECTOR_2022_PORTLET_ID} .vector-language-region,
      #${VECTOR_2022_PORTLET_ID} .vector-menu-content,
      #${VECTOR_2022_PORTLET_ID} .vector-menu-content-list {
        display: block;
        clear: both;
        width: auto;
      }

      #${VECTOR_2022_PORTLET_ID} .vector-menu-content-list {
        margin: 0;
        padding: 0;
      }

      #${VECTOR_2022_PORTLET_ID} .vector-menu-content-list > .mw-list-item {
        display: block;
        float: none;
        text-align: left;
        width: auto;
      }

      #${VECTOR_2022_PORTLET_ID} .vector-menu-content-list > .mw-list-item > a {
        display: block;
        text-align: left;
      }
    `;
    document.head.appendChild(style);
  }

})();
