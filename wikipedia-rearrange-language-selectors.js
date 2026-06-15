// ==UserScript==
// @name           Wikipedia rearrange other languages
// @namespace      none
// @include        http://*.wikipedia.org/wiki/*
// @include        https://*.wikipedia.org/wiki/*
// @include        https://zh.wikipedia.org/*/*
// @description    Rearranges the "other languages" section of Wikipedia
// @version        1.2.8
// @run-at         document-end
// @require        https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL      https://github.com/johan456789/userscripts/raw/main/wikipedia-rearrange-language-selectors.js
// @downloadURL    https://github.com/johan456789/userscripts/raw/main/wikipedia-rearrange-language-selectors.js
// ==/UserScript==

// 2025-06-26 modified from https://greasyfork.org/en/scripts/10731-wikipedia-rearrange-other-languages

(function () {
  "use strict";

  const logger = Logger("[Wikipedia-Rearrange-Languages]");

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  // Configuration
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Set your preferred languages here in order of priority
   * @type {string[]}
   */
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

  /**
   * Setting false will leave other languages in the list
   * @type {boolean}
   */
  const removeOthers = true;

  /**
   * Setting true will only show the first official Wikipedia language group
   * after the custom "Preferred languages" group.
   * @type {boolean}
   */
  const hideOtherLanguageGroups = true;

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////

  const VECTOR_2022_MENU_SELECTOR =
    "body > div.grid.uls-menu.notheme.skin-invert > div.row.uls-language-list.uls-lcd";
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
  const OPEN_RETRY_DELAY_MS = 500;
  const MAX_OPEN_ATTEMPTS = 20;

  init().catch((error) => {
    logger.error("Initialization failed.", error);
  });

  async function init() {
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
    // Locate the list inside the legacy language portlet (id="p-lang").
    const list = portlet.querySelector(".vector-menu-content-list, ul");
    if (!list) {
      return;
    }

    const items = Array.from(list.children).filter((item) =>
      item.matches("li.interlanguage-link")
    );

    // Put preferred languages first, following the order configured in myLangs.
    const preferred = sortPreferredItems(items);

    if (removeOthers && preferred.length === 0) {
      // Remove the "other languages" menu if no preferred language is available.
      portlet.remove();
      return;
    }

    // If removeOthers is false, preserve non-preferred languages after the
    // reordered preferred languages.
    const itemsToShow = removeOthers
      ? preferred
      : preferred.concat(items.filter((item) => !preferred.includes(item)));

    list.replaceChildren(...itemsToShow);
  }

  async function addVector2022Languages(languageButton) {
    const sidebar = document.querySelector(VECTOR_2022_SIDEBAR_SELECTOR);
    if (!sidebar) {
      logger.warn("Vector 2022 sidebar was not found.");
      return;
    }

    injectVector2022Styles();
    document.body.classList.add(VECTOR_2022_BODY_CLASS);

    // The basic interlanguage links already exist in #p-lang-btn. Render the
    // preferred group immediately so the sidebar width is reserved before ULS
    // finishes loading its grouped language menu.
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
      const menu = await openLanguageMenu(languageButton);
      if (!menu) {
        logger.warn("Could not open the Vector 2022 language menu.");
        return;
      }

      const languageGroups = readLanguageGroups(menu);
      languageButton.click();
      await delay(OPEN_RETRY_DELAY_MS);

      if (languageGroups.length === 0) {
        logger.warn(
          "The Vector 2022 language menu contained no usable languages."
        );
        return;
      }

      updateLanguagePortlet(languageGroups);
      logger("Updated Vector 2022 language portlet.");
    } finally {
      // Restore normal ULS behavior after the automated capture is complete.
      document.body.classList.remove(VECTOR_2022_CAPTURING_CLASS);
    }
  }

  async function openLanguageMenu(languageButton) {
    for (let attempt = 1; attempt <= MAX_OPEN_ATTEMPTS; attempt++) {
      const existingMenu = document.querySelector(VECTOR_2022_MENU_SELECTOR);
      if (existingMenu) {
        return existingMenu;
      }

      logger(`Opening language menu (attempt ${attempt}/${MAX_OPEN_ATTEMPTS}).`);
      languageButton.click();

      // The first click can happen before Wikipedia finishes wiring up ULS.
      // Retry until the menu's language list is actually present in the DOM.
      await delay(OPEN_RETRY_DELAY_MS);

      const menu = document.querySelector(VECTOR_2022_MENU_SELECTOR);
      if (menu) {
        return menu;
      }
    }

    return null;
  }

  function readLanguageGroups(menu) {
    const officialGroups = [];

    // Convert the transient ULS menu into plain data. Do not retain or clone
    // nodes that Wikipedia removes when the menu closes.
    for (const section of menu.querySelectorAll(
      ":scope > .uls-lcd-region-section:not(.hide)"
    )) {
      const heading = section.querySelector(".uls-lcd-region-title");
      if (!heading) {
        continue;
      }

      const languages = Array.from(
        section.querySelectorAll(".uls-language-block li.interlanguage-link")
      )
        .map(readLanguage)
        .filter(Boolean);

      if (languages.length > 0) {
        officialGroups.push({
          title: heading.textContent.trim(),
          languages,
        });
      }
    }

    const preferredLanguages = getPreferredLanguages(officialGroups);
    const officialGroupsToShow = hideOtherLanguageGroups
      ? officialGroups.slice(0, 1)
      : officialGroups;

    return preferredLanguages.length > 0
      ? [
          {
            title: "Preferred languages",
            languages: preferredLanguages,
          },
          ...officialGroupsToShow,
        ]
      : officialGroupsToShow;
  }

  function readLanguage(item) {
    const link = item.querySelector("a");
    if (!link) {
      return null;
    }

    return {
      code: item.dataset.code || getLanguageCode(item),
      name: link.textContent.trim(),
      href: link.href,
      title: link.title,
      lang: link.lang,
      dir: link.dir,
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

    // Languages should be the first section in the Vector 2022 end sidebar.
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

      body.${VECTOR_2022_CAPTURING_CLASS} > div.grid.uls-menu {
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
