// ==UserScript==
// @name         Twitter Reduce Sidebar Clutter
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Move less-used items from sidebar to overflow menu.
// @author       You
// @match        https://*.twitter.com/*
// @match        https://twitter.com/*
// @match        https://x.com/*
// @license      MIT
// @run-at       document-end
// @noframes
// @updateURL    https://github.com/johan456789/userscripts/raw/main/twitter-reduce-sidebar-clutter.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/twitter-reduce-sidebar-clutter.js
// ==/UserScript==

function logger(message) {
    console.log("[Twitter-Reduce-Sidebar-Clutter] " + message);
}
logger("Userscript started.");

const sidebarMenuSelector = '#react-root header nav';
const moreButtonSelector = `${sidebarMenuSelector} > button`;
const overflowMenuSelector = 'div[role="menu"] > div > div > div > div'; // the menu shown when clicking the more button

(function() {
    'use strict';

    const ITEMS_TO_MOVE = [
        'a[href="/i/grok"]',
        'a[href="/jobs"]',
        'a[href="/i/premium_sign_up"]',
        'a[href="/i/verified-orgs-signup"]',
        'a[href="/i/communitynotes"]',
    ];

    function hideSidebarItems() {
        const sidebar = document.querySelector(sidebarMenuSelector);
        if (!sidebar) {
            return;
        }

        ITEMS_TO_MOVE.forEach(selector => {
            const itemToHide = sidebar.querySelector(selector);
            if (itemToHide) {
                if (itemToHide && itemToHide.style.display !== 'none') {
                    logger(`Hiding ${selector} from sidebar`);
                    itemToHide.style.display = 'none';
                }
            }
        });
    }

    function addItemsToOverflowMenu() {
        waitForElement(overflowMenuSelector, (overflowMenuContainer) => {
            logger('Overflow menu found, adding items.');
            
            const templateWrapper = overflowMenuContainer.querySelector('div');
            if (!templateWrapper) {
                logger('Could not find template wrapper in overflow menu.');
                return;
            }
            
            const sidebar = document.querySelector(sidebarMenuSelector);
            if (!sidebar) {
                logger('Sidebar not found, cannot get items to move.');
                return;
            }
    
            // Reverse so they appear in original order at the top
            ITEMS_TO_MOVE.slice().reverse().forEach(selector => {
                const itemToClone = sidebar.querySelector(selector);
                const overflowMenuItem = overflowMenuContainer.querySelector(selector);
                
                // Only add if it's not already there
                if (itemToClone && !overflowMenuItem) {
                    const newWrapper = templateWrapper.cloneNode(true); // Deep clone
                    const anchorToReplace = newWrapper.querySelector('a');
                    
                    if (anchorToReplace) {
                        const newItem = itemToClone.cloneNode(true);
                        newItem.style.display = ''; // Make it visible
                        newWrapper.replaceChild(newItem, anchorToReplace);

                        overflowMenuContainer.insertBefore(newWrapper, overflowMenuContainer.firstChild);
                        logger(`Added ${selector} to overflow menu.`);
                    }
                }
            });
        });
    }

    function waitForElement(selector, callback, timeout = 5000) {
        const observer = new MutationObserver((mutations, obs) => {
            const element = document.querySelector(selector);
            if (element) {
                obs.disconnect(); // Stop observing once the element is found
                isDisconnected = true;
                callback(element);
            }
        });
    
        let isDisconnected = false;
    
        observer.observe(document.body, { childList: true, subtree: true });
    
        setTimeout(() => {
            if (!isDisconnected) {
                logger(`Error: Element '${selector}' not found within ${timeout}ms.`);
                observer.disconnect(); // Ensure we stop observing
            }
        }, timeout);
    }

    waitForElement(moreButtonSelector, (moreButton) => {
        hideSidebarItems(); // Initial hide on load

        moreButton.addEventListener('click', () => {
            addItemsToOverflowMenu();
        });
    });
})();
