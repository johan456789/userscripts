// ==UserScript==
// @name         Twitter Reduce Sidebar Clutter
// @namespace    http://tampermonkey.net/
// @version      1.0.4
// @description  Move less-used items from sidebar to overflow menu.
// @author       You
// @match        https://*.twitter.com/*
// @match        https://twitter.com/*
// @match        https://x.com/*
// @license      MIT
// @run-at       document-end
// @noframes
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @require      https://github.com/johan456789/userscripts/raw/main/utils/wait-for-element.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/twitter-reduce-sidebar-clutter.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/twitter-reduce-sidebar-clutter.js
// ==/UserScript==

////////////////////////////////////
// CONFIG
////////////////////////////////////

const USERNAME = ""; // can hardcode username here.

////////////////////////////////////
////////////////////////////////////

const logger = Logger("[Twitter-Reduce-Sidebar-Clutter]");
logger("Userscript started.");

const sidebarMenuSelector = "#react-root header nav";
const moreButtonSelector = `${sidebarMenuSelector} > button`;
const overflowMenuSelector = 'div[role="menu"] > div > div > div > div'; // the menu shown when clicking the more button

(function () {
  "use strict";

  const ITEMS_TO_MOVE = [
    'a[href="/i/grok"]',
    'a[href="/jobs"]',
    'a[href="/i/premium_sign_up"]',
    'a[href="/i/verified-orgs-signup"]',
    'a[href="/i/communitynotes"]',
    'a[href="/i/premium-business"]',
  ];

  function getUsernameFromAccountSwitcher() {
    const accountSwitcherButton = document.querySelector(
      'button[data-testid="SideNav_AccountSwitcher_Button"]'
    );
    if (!accountSwitcherButton) {
      return "";
    }

    const span = accountSwitcherButton.querySelector(
      "div:nth-of-type(2) > div > div:nth-of-type(2) > div > div > div > span"
    );
    const rawText = (span && span.textContent ? span.textContent : "").trim();
    if (!rawText.startsWith("@")) {
      return "";
    }
    return rawText.slice(1).trim();
  }

  function resolveUsername() {
    const configured = typeof USERNAME === "string" ? USERNAME.trim() : "";
    if (configured) {
      return configured;
    }
    return getUsernameFromAccountSwitcher();
  }

  function hideSidebarItems() {
    const sidebar = document.querySelector(sidebarMenuSelector);
    if (!sidebar) {
      return;
    }

    ITEMS_TO_MOVE.forEach((selector) => {
      const itemToHide = sidebar.querySelector(selector);
      if (itemToHide) {
        if (itemToHide && itemToHide.style.display !== "none") {
          logger(`Hiding ${selector} from sidebar`);
          itemToHide.style.display = "none";
        }
      }
    });
  }

  function addItemsToOverflowMenu() {
    waitForElement(overflowMenuSelector, (overflowMenuContainer) => {
      logger("Overflow menu found, adding items.");

      const templateWrapper = overflowMenuContainer.querySelector("div");
      if (!templateWrapper) {
        logger("Could not find template wrapper in overflow menu.");
        return;
      }

      const sidebar = document.querySelector(sidebarMenuSelector);
      if (!sidebar) {
        logger("Sidebar not found, cannot get items to move.");
        return;
      }

      // Reverse so they appear in original order at the top
      ITEMS_TO_MOVE.slice()
        .reverse()
        .forEach((selector) => {
          const itemToClone = sidebar.querySelector(selector);
          const overflowMenuItem =
            overflowMenuContainer.querySelector(selector);

          // Only add if it's not already there
          if (itemToClone && !overflowMenuItem) {
            const newWrapper = templateWrapper.cloneNode(true); // Deep clone
            const anchorToReplace = newWrapper.querySelector("a");

            if (anchorToReplace) {
              const newItem = itemToClone.cloneNode(true);
              newItem.style.display = ""; // Make it visible
              newWrapper.replaceChild(newItem, anchorToReplace);

              overflowMenuContainer.insertBefore(
                newWrapper,
                overflowMenuContainer.firstChild
              );
              logger(`Added ${selector} to overflow menu.`);
            }
          }
        });
    });
  }

  waitForElement(moreButtonSelector, (moreButton) => {
    const username = resolveUsername();
    if (username) {
      const listsSelector = `a[href="/${username}/lists"]`;
      if (!ITEMS_TO_MOVE.includes(listsSelector)) {
        ITEMS_TO_MOVE.push(listsSelector);
        logger(`Prepared to move lists for @${username}.`);
      }
    }

    hideSidebarItems(); // Initial hide on load

    moreButton.addEventListener("click", () => {
      addItemsToOverflowMenu();
    });
  });
})();
