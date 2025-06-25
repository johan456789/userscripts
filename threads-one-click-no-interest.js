// ==UserScript==
// @name         Threads One-Click Not Interested
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  Adds a "Not Interested" button to Threads.net posts for one-click action.
// @author       You
// @match        https://www.threads.net/*
// @match        https://www.threads.com/*
// @grant        none
// @require      https://github.com/johan456789/userscripts/raw/main/utils/wait-for-element.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/threads-one-click-no-interest.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/threads-one-click-no-interest.js
// ==/UserScript==

(function() {
    'use strict';

    function logger(message) {
        console.log("[Threads-Not-Interested] " + message);
    }

        logger("Script started");

        function handleNotInterestedClick(e) {
            e.preventDefault();
            e.stopImmediatePropagation();

            logger("Not Interested button clicked");

            // 1. click the overflow button (next sibling)
            const thisContainer = e.currentTarget.closest('.not-interested-button-container');
            if (!thisContainer) {
                logger('Could not determine button container.');
                return;
            }

            const overflowContainer = thisContainer.nextElementSibling;
            if (!overflowContainer) {
                logger('Could not locate overflow button container.');
                return;
            }

            const overflowBtn = overflowContainer.querySelector('div[role="button"]');
            if (!overflowBtn) {
                logger('Could not find overflow button element.');
                return;
            }

            overflowBtn.click();

            // 2. wait for the overflow menu to appear then click "Not interested"
            waitForElement('div[role="menu"] div[role="button"]', (menuItem) => {
                const menu = menuItem.closest('div[role="menu"]');
                if (!menu) {
                    logger('Could not find parent menu.');
                    return;
                }
                const menuItems = menu.querySelectorAll('div[role="button"], span');
                let found = false;
                for (const item of menuItems) {
                    if (item.textContent.trim() === 'Not interested') {
                        logger('Found "Not interested" menu item, clicking.');
                        item.click();
                        found = true;
                        return;
                    }
                }
                if (!found) {
                    logger('Could not find "Not interested" menu item.');
                }
            });
        }

        function addNotInterestedButton(buttonRow) {
            try {
                if (buttonRow.querySelector('.not-interested-button-container')) {
                    // logger("Button already exists for this post.");
                    return; // Button already added
                }
                const overflowButtonContainer = buttonRow.lastElementChild;
                if (!overflowButtonContainer) {
                    logger("Button row is empty, cannot add button.");
                    return;
                }
                logger("Attempting to add button...");
                
                // Clone the overflow button to create our new button
                const newButtonContainer = overflowButtonContainer.cloneNode(true);
                newButtonContainer.classList.add('not-interested-button-container');

                const button = newButtonContainer.querySelector('div[role="button"]');
                if (button) {
                    button.setAttribute('aria-label', 'Not Interested');
                    button.addEventListener('click', handleNotInterestedClick, true);
                } else {
                    logger("Could not find button in new button container.");
                }

                const svg = newButtonContainer.querySelector('svg');
                if (svg) {
                    svg.setAttribute('viewBox', '0 0 20 20');

                    // Remove existing child nodes to avoid Trusted Types violation
                    while (svg.firstChild) svg.removeChild(svg.firstChild);

                    // Build the SVG paths programmatically to comply with Trusted Types
                    const SVG_NS = 'http://www.w3.org/2000/svg';

                    const pathsData = [
                        { d: 'M1.5 1.75L18.5 18.25', stroke: 'currentColor', fill: 'none', extra: { 'stroke-linecap': 'round', 'stroke-width': '1.5' } },
                        { d: 'M3.47414 6.27892C3.20456 6.01727 2.78029 5.99602 2.50117 6.24747C1.41059 7.22999 0.587673 8.33683 0.139959 9.36712C-0.0338603 9.76712 -0.0300002 10.2108 0.129836 10.601C1.24049 13.3126 4.48326 16.75 10.0001 16.75C10.8741 16.75 11.68 16.6639 12.4235 16.5086C13.0002 16.3882 13.1633 15.6831 12.7405 15.2728V15.2728C12.5453 15.0833 12.2667 15.0101 11.9998 15.0626C11.3839 15.1836 10.7188 15.25 10.0001 15.25C5.18515 15.25 2.43521 12.272 1.51791 10.0325C1.50596 10.0033 1.50888 9.98059 1.51568 9.96494C1.85715 9.17913 2.51757 8.26748 3.43478 7.42578C3.76747 7.12048 3.79816 6.59341 3.47414 6.27892V6.27892ZM16.5428 13.7373C16.2272 13.431 16.2465 12.9204 16.5569 12.6088C17.3554 11.8075 17.9704 10.9194 18.4571 10.0897C18.4939 10.0269 18.489 9.95912 18.4597 9.91192C17.0155 7.58585 14.0306 4.75 10.0001 4.75C9.33037 4.75 8.67997 4.82776 8.05567 4.96835C7.78456 5.02941 7.49807 4.95861 7.29866 4.76506V4.76506C6.8837 4.36231 7.03604 3.66842 7.59858 3.53444C8.36334 3.35229 9.16684 3.25 10.0001 3.25C14.7628 3.25 18.1518 6.57225 19.734 9.12072C20.066 9.65543 20.0607 10.3204 19.7509 10.8485C19.206 11.7776 18.4889 12.8103 17.5356 13.7488C17.26 14.0201 16.8203 14.0067 16.5428 13.7373V13.7373Z', fill: 'currentColor' },
                        { d: 'M6.36296 9.08288C6.28918 9.37637 6.25 9.68361 6.25 10C6.25 12.0711 7.92893 13.75 10 13.75C10.3555 13.75 10.6994 13.7005 11.0253 13.6081L6.36296 9.08288ZM13.637 10.9171C13.7108 10.6236 13.75 10.3164 13.75 10C13.75 7.92893 12.0711 6.25 10 6.25C9.6445 6.25 9.30056 6.29947 8.97468 6.39189L13.637 10.9171Z', fill: 'currentColor' }
                    ];

                    pathsData.forEach(({ d, stroke, fill, extra = {} }) => {
                        const p = document.createElementNS(SVG_NS, 'path');
                        p.setAttribute('d', d);
                        if (stroke) p.setAttribute('stroke', stroke);
                        if (fill) p.setAttribute('fill', fill);
                        Object.entries(extra).forEach(([k, v]) => p.setAttribute(k, v));
                        svg.appendChild(p);
                    });

                    let title = svg.querySelector('title');
                    if (!title) {
                        title = document.createElementNS(SVG_NS, 'title');
                        svg.prepend(title);
                    }
                    title.textContent = 'Not Interested';
                } else {
                    logger("Could not find svg in new button container.");
                }

                // Insert the new button before the original overflow button
                buttonRow.insertBefore(newButtonContainer, overflowButtonContainer);

                logger("Button added successfully.");
            } catch (err) {
                console.error('[Threads-Not-Interested] Error in addNotInterestedButton:', err);
            }
        }

        function processPosts() {
            // logger("Processing posts...");
            // find the bar with the buttons inside
            const buttonRows = document.querySelectorAll('div.x6s0dn4.xamitd3.x40hh3e.x78zum5.x1q0g3np.x1xdureb.x1fc57z9.x1hm9lzh.xvijh9v');
            // logger(`Found ${buttonRows.length} button rows.`);

            // add the not interested button to each button row
            for (const row of buttonRows) {
                addNotInterestedButton(row);
            }
        }

        function init() {
            logger("Initializing script...");
            const observer = new MutationObserver((mutations) => {
                // logger("MutationObserver fired.");
                for (const mutation of mutations) {
                    if (mutation.addedNodes.length) {
                        processPosts();
                        break;
                    }
                }
            });

            logger("Waiting for main content area 'div[role=\"main\"]'...");
            waitForElement('div[role="region"]', (mainContent) => {
                logger("Main content area found, starting observer.");
                processPosts(); // Initial run
                observer.observe(mainContent, {
                    childList: true,
                    subtree: true
                });
            });
        }

    init();
})();
