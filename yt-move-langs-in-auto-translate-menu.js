// ==UserScript==
// @name         Move Preferred YouTube Subtitle Auto-translate Language Options To Top
// @namespace    Me
// @version      1.1.2
// @license      AGPLv3
// @author       jcunews
// @description  Move preferred YouTube subtitle auto-translate languages to top of the list for quick access, and optionally remove other languages. Users who use non English (US) language in their YouTube setting, must manually edit the script for their chosen language.
// @match        https://www.youtube.com/*
// @grant        none
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/refs/heads/main/yt-move-langs-in-auto-translate-menu.js
// @updateURL    https://github.com/johan456789/userscripts/raw/refs/heads/main/yt-move-langs-in-auto-translate-menu.js
// ==/UserScript==

// modified from https://greasyfork.org/en/scripts/404054-move-preferred-youtube-subtitle-auto-translate-language-options-to-top

(() => {
  const logger = Logger("[YT-Move-AutoTranslate]");
  logger("Initialized");
  let hasLoggedWaiting = false;

  //*** CONFIGURATION BEGIN ***

  //One or more menu titles for "Auto-translate". If YouTube language is not English (US), title must be specified according to current YouTube language.
  //For English (US) language, the menu title is "Auto-translate". So, if the language is French, the title must be "Traduire automatiquement".
  //Multiple titles can be specified as e.g.: ["Auto-translate", "Traduire automatiquement"]
  let menuTitle = "Auto-translate";

  //One or more auto-translate language(s) to keep. Language names must also be specified according to current YouTube language.
  //For English (US) language, the language name for French is "French". But if the language is French, the language name for French must be "Français".
  //Multiple languages can be specified as e.g.: ["English", "French"]
  let keepLanguage = ["English", "Chinese (Traditional)"];

  //Also remove non preffered languages from the list, aside from moving the preferred languages to the top.
  let removeOtherLanguages = false;

  //*** CONFIGURATION END ***
  logger("Configuration", { menuTitle, keepLanguage, removeOtherLanguages });

  (function waitPlayerSettingsMenu(a) {
    if ((a = document.querySelector(".ytp-settings-menu"))) {
      logger("Settings menu found; attaching observer");
      new MutationObserver((recs) => {
        try {
          recs.forEach((rec) => {
            rec.addedNodes.forEach((nd, a) => {
              if (
                nd.querySelector &&
                (a = nd.querySelector(".ytp-panel-title")) &&
                menuTitle.includes(a.textContent)
              ) {
                const titleText = a.textContent;
                logger(`Auto-translate panel detected: "${titleText}"`);
                let movedCount = 0;
                let removedCount = 0;
                a = 0;
                const labels = nd.querySelectorAll(
                  ".ytp-menuitem > .ytp-menuitem-label"
                );
                const totalCount = labels.length;
                logger(`Found ${totalCount} languages to process.`);
                labels.forEach((l) => {
                  if (keepLanguage.includes(l.textContent)) {
                    (l = l.parentNode).parentNode.insertBefore(
                      l,
                      l.parentNode.children[a++]
                    );
                    movedCount++;
                    logger(`Moved preferred language: ${l.textContent}`);
                  } else if (removeOtherLanguages) {
                    logger(`Removed non-preferred language: ${l.textContent}`);
                    l.parentNode.remove();
                    removedCount++;
                  }
                });
                logger(
                  `Processing complete. total=${totalCount}, moved=${movedCount}, removed=${removedCount}`
                );
              }
            });
          });
        } catch (err) {
          logger.error("Observer error", err);
        }
      }).observe(a, { childList: true, subtree: true });
    } else {
      if (!hasLoggedWaiting) {
        logger("Waiting for settings menu...");
        hasLoggedWaiting = true;
      }
      setTimeout(waitPlayerSettingsMenu, 100);
    }
  })();
})();
