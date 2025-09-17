// ==UserScript==
// @name         Move Preferred YouTube Subtitle Auto-translate Language Options To Top
// @namespace    Me
// @version      1.1.3
// @license      AGPLv3
// @author       jcunews
// @description  Move preferred YouTube subtitle auto-translate languages to top of the list for quick access, and optionally remove other languages. Users who use non English (US) language in their YouTube setting, must manually edit the script for their chosen language.
// @match        https://www.youtube.com/*
// @grant        none
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @require      https://github.com/johan456789/userscripts/raw/main/utils/wait-for-element.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/refs/heads/main/yt-move-langs-in-auto-translate-menu.js
// @updateURL    https://github.com/johan456789/userscripts/raw/refs/heads/main/yt-move-langs-in-auto-translate-menu.js
// ==/UserScript==

// modified from https://greasyfork.org/en/scripts/404054-move-preferred-youtube-subtitle-auto-translate-language-options-to-top

(() => {
  const logger = Logger("[YT-Move-AutoTranslate]");
  logger("Initialized");

  // *** CONFIGURATION BEGIN ***

  // One or more menu titles for "Auto-translate". If YouTube language is not English (US), title must be specified according to current YouTube language.
  // For English (US) language, the menu title is "Auto-translate". So, if the language is French, the title must be "Traduire automatiquement".
  // Multiple titles can be specified as e.g.: ["Auto-translate", "Traduire automatiquement"]
  const menuTitle = "Auto-translate";

  // One or more auto-translate language(s) to keep. Language names must also be specified according to current YouTube language.
  // For English (US) language, the language name for French is "French". But if the language is French, the language name for French must be "Français".
  // Multiple languages can be specified as e.g.: ["English", "French"]
  const keepLanguage = ["English", "Chinese (Traditional)"];

  // Also remove non preferred languages from the list, aside from moving the preferred languages to the top.
  const removeOtherLanguages = false;

  // *** CONFIGURATION END ***
  logger("Configuration", { menuTitle, keepLanguage, removeOtherLanguages });

  // Wait for settings menu
  waitForElement(
    ".ytp-settings-menu",
    (menuEl) => {
      logger("Settings menu found; attaching observer");

      function processPanel(panelRoot) {
        try {
          const labels = panelRoot.querySelectorAll(
            ".ytp-menuitem > .ytp-menuitem-label"
          );
          const totalCount = labels.length;
          let movedCount = 0;
          let removedCount = 0;
          let insertIndex = 0;
          logger(`Found ${totalCount} languages to process.`);
          labels.forEach((label) => {
            if (keepLanguage.includes(label.textContent)) {
              const item = label.parentNode;
              item.parentNode.insertBefore(
                item,
                item.parentNode.children[insertIndex++]
              );
              movedCount++;
              logger(`Moved preferred language: ${label.textContent}`);
            } else if (removeOtherLanguages) {
              logger(`Removed non-preferred language: ${label.textContent}`);
              label.parentNode.remove();
              removedCount++;
            }
          });
          logger(
            `Processing complete. total=${totalCount}, moved=${movedCount}, removed=${removedCount}`
          );
        } catch (err) {
          logger.error("Processing error", err);
        }
      }

      function getPanelRoot(node) {
        if (!node || !node.querySelector) return null;
        const titleEl = node.querySelector(".ytp-panel-title");
        if (!titleEl) return null;
        if (!menuTitle.includes(titleEl.textContent)) return null;
        return titleEl.closest(".ytp-panel") || null;
      }

      // Immediate pass (handles already-open panel)
      const initialPanel = getPanelRoot(menuEl);
      if (initialPanel) processPanel(initialPanel);

      // Observe future panels
      new MutationObserver((records) => {
        try {
          records.forEach((record) => {
            record.addedNodes.forEach((node) => {
              const panelRoot = getPanelRoot(node);
              if (panelRoot) {
                logger("Auto-translate panel detected");
                processPanel(panelRoot);
              }
            });
          });
        } catch (err) {
          logger.error("Observer error", err);
        }
      }).observe(menuEl, { childList: true, subtree: true });
    },
    10000
  );
})();
