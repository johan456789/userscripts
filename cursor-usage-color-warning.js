// ==UserScript==
// @name         Cursor Usage Color Warning
// @namespace    http://tampermonkey.net/
// @version      0.4.1
// @description  Modifies the usage bar color on cursor.com/dashboard based on prorated usage.
// @author       You
// @match        https://www.cursor.com/dashboard
// @match        https://www.cursor.com/*/dashboard
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const SCRIPT_PREFIX = "[Cursor-Usage-Color-Warning]";
    let hasInitialized = false; // Flag to prevent multiple initializations

    function debugPrint(level, message, ...data) {
        const fullMessage = `${SCRIPT_PREFIX} ${message}`;
        if (level === 'error') {
            console.error(fullMessage, ...data);
        } else if (level === 'warn') {
            console.warn(fullMessage, ...data);
        } else {
            console.log(fullMessage, ...data);
        }
    }

    // --- Configuration -- -
    const USAGE_ELEMENT_SELECTOR = ".bg-brand-dashboard-card .flex.items-baseline";
    const USAGE_BAR_SELECTOR = ".bg-brand-dashboard-card .h-1.w-full.flex";
    const RESET_DAY_OF_MONTH = 7; // 7th of the month
    // const RESET_TIMEZONE = "Asia/Shanghai"; // UTC+8

    const COLOR_GREEN = "#10B981"; // Example: Tailwind green-500 / rgb(16, 185, 129)
    const COLOR_RED = "#EF4444"; // Example: Tailwind red-500 / rgb(239, 68, 68)
    const COLOR_YELLOW = "#F59E0B"; // Example: Tailwind amber-500 / rgb(245, 158, 11)
    const DEFAULT_BAR_COLOR_LIGHT = "rgb(129, 161, 193)"; // #81A1C1 from your example (light mode)
    const DEFAULT_BAR_COLOR_DARK = "rgb(129, 161, 193)"; // Assuming same for now, adjust if dark mode has a different default

    // --- Helper Functions ---

    function getUsageData() {
        debugPrint('info', 'Attempting to get usage data...');
        const usageElement = document.querySelector(USAGE_ELEMENT_SELECTOR);
        if (!usageElement) {
            debugPrint('error', 'Usage element not found with selector:', USAGE_ELEMENT_SELECTOR);
            return null;
        }
        debugPrint('info', 'Usage element found:', usageElement);

        const valueSpan = usageElement.children[0];
        const totalSpan = usageElement.children[1];

        if (!valueSpan || !totalSpan) {
            debugPrint('error', 'Usage value or total span not found within usageElement:', usageElement.innerHTML);
            return null;
        }
        debugPrint('info', 'Value span:', valueSpan.textContent, 'Total span:', totalSpan.textContent);

        const currentUsage = parseFloat(valueSpan.textContent.trim());
        const totalQuota = parseFloat(totalSpan.textContent.trim().replace('/', ''));

        if (isNaN(currentUsage) || isNaN(totalQuota) || totalQuota === 0) {
            debugPrint('error', 'Could not parse usage data. Current:', valueSpan.textContent, 'Total:', totalSpan.textContent);
            return null;
        }
        const usagePercentage = currentUsage / totalQuota;
        debugPrint('info', 'Successfully parsed usage data:', { currentUsage, totalQuota, usagePercentage });
        return { currentUsage, totalQuota, usagePercentage };
    }

    function getProratedUsageInfo() {
        debugPrint('info', 'Calculating prorated usage...');
        const now = new Date();
        const nowInUTC8 = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));

        let cycleStartYear = nowInUTC8.getFullYear();
        let cycleStartMonth = nowInUTC8.getMonth(); // 0-indexed month

        if (nowInUTC8.getDate() < RESET_DAY_OF_MONTH) {
            cycleStartMonth -= 1;
            if (cycleStartMonth < 0) {
                cycleStartMonth = 11; // December
                cycleStartYear -= 1;
            }
        }

        // Cycle start is effectively the beginning of RESET_DAY_OF_MONTH in UTC+8
        const cycleStartDateInUTC8 = new Date(cycleStartYear, cycleStartMonth, RESET_DAY_OF_MONTH, 0, 0, 0);
        // Convert this UTC+8 conceptual time to an actual UTC timestamp for calculations
        const cycleStartEpochUTC = Date.UTC(cycleStartYear, cycleStartMonth, RESET_DAY_OF_MONTH, 0, 0, 0) - (8 * 60 * 60 * 1000);
        const cycleStartDateUTC = new Date(cycleStartEpochUTC);

        let cycleEndYear = cycleStartYear;
        let cycleEndMonth = cycleStartMonth + 1;
        if (cycleEndMonth > 11) {
            cycleEndMonth = 0;
            cycleEndYear += 1;
        }
        // Cycle end is effectively the end of (RESET_DAY_OF_MONTH - 1) of the next cycle month in UTC+8
        // which is just before the start of RESET_DAY_OF_MONTH of the next cycle month in UTC+8
        const cycleEndEpochUTC = Date.UTC(cycleEndYear, cycleEndMonth, RESET_DAY_OF_MONTH, 0, 0, 0) - (8 * 60 * 60 * 1000) - 1; // minus 1 millisecond
        const cycleEndDateUTC = new Date(cycleEndEpochUTC);

        const totalTimeInCycle = cycleEndEpochUTC - cycleStartEpochUTC;
        const timePassedInCycle = now.getTime() - cycleStartEpochUTC;

        if (timePassedInCycle < 0) {
            debugPrint('error', 'Time passed is negative. Check cycle date logic.', { now: now.toISOString(), cycleStartUTC: cycleStartDateUTC.toISOString(), cycleEndUTC: cycleEndDateUTC.toISOString(), nowInUTC8_debug: nowInUTC8.toString(), cycleStartDateInUTC8_debug: cycleStartDateInUTC8.toString() });
            return { proratedRatio: 1.0, daysPassed: 0, totalDaysInCycle: 30 }; // Avoid issues
        }
        if (totalTimeInCycle <= 0) {
             debugPrint('error', 'Total time in cycle is not positive. Check cycle date logic.', {cycleStartUTC: cycleStartDateUTC.toISOString(), cycleEndUTC: cycleEndDateUTC.toISOString()});
            return { proratedRatio: 1.0, daysPassed: 0, totalDaysInCycle: 30 };
        }

        const proratedRatio = Math.min(timePassedInCycle / totalTimeInCycle, 1.0);
        const daysPassed = timePassedInCycle / (1000 * 60 * 60 * 24);
        const totalDaysInCycle = totalTimeInCycle / (1000 * 60 * 60 * 24);

        debugPrint('info', 'Prorated calculation details:', {
            currentTimeUTC: now.toISOString(),
            nowInUTC8_toLocaleStr: nowInUTC8.toLocaleString(), // For checking timezone interpretation
            cycleStartDateUTC: cycleStartDateUTC.toISOString(),
            cycleEndDateUTC: cycleEndDateUTC.toISOString(),
            timePassedInCycle_ms: timePassedInCycle,
            totalTimeInCycle_ms: totalTimeInCycle,
            daysPassed: daysPassed.toFixed(2),
            totalDaysInCycle: totalDaysInCycle.toFixed(2),
            proratedRatio: proratedRatio.toFixed(4)
        });

        return { proratedRatio, daysPassed, totalDaysInCycle };
    }

    function updateUsageBarColor() {
        debugPrint('info', 'Attempting to update usage bar color...');
        const usageData = getUsageData();
        if (!usageData) {
            debugPrint('warn', 'No usage data, cannot update bar color.');
            return;
        }

        const { proratedRatio } = getProratedUsageInfo();
        const actualUsageRatio = usageData.usagePercentage;
        debugPrint('info', `Actual usage: ${(actualUsageRatio*100).toFixed(1)}%, Prorated: ${(proratedRatio*100).toFixed(1)}%`);

        const barElementContainer = document.querySelector(USAGE_BAR_SELECTOR);
        if (!barElementContainer) {
            debugPrint('error', 'Usage bar container not found with selector:', USAGE_BAR_SELECTOR);
            return;
        }
        const barElement = barElementContainer.firstChild;
        const backgroundBarElement = barElementContainer.children[1];

        if (!barElement || !(barElement instanceof HTMLElement)) {
            debugPrint('error', 'Actual usage bar element (firstChild of container) not found or not an HTMLElement.', barElementContainer.innerHTML);
            return;
        }
        debugPrint('info', 'Usage bar element found:', barElement);

        const difference = actualUsageRatio - proratedRatio;
        let newColor = "";

        const isDarkMode = document.documentElement.classList.contains('dark');
        const defaultBarColor = isDarkMode ? DEFAULT_BAR_COLOR_DARK : DEFAULT_BAR_COLOR_LIGHT;
        debugPrint('info', `Theme: ${isDarkMode ? 'Dark' : 'Light'}. Default bar color: ${defaultBarColor}`);

        if (difference > 0.10) {
            newColor = COLOR_RED;
            debugPrint('info', `Usage is >10% over prorated (Difference: ${(difference*100).toFixed(1)}%). Setting color to RED: ${COLOR_RED}`);
        } else if (difference > 0.05) {
            newColor = COLOR_YELLOW;
            debugPrint('info', `Usage is >5% over prorated (Difference: ${(difference*100).toFixed(1)}%). Setting color to YELLOW: ${COLOR_YELLOW}`);
        } else {
            // newColor = defaultBarColor;
            newColor = COLOR_GREEN;
            debugPrint('info', `Usage is within 5% of prorated or less (Difference: ${(difference*100).toFixed(1)}%). Setting/Keeping default color: ${defaultBarColor}`);
        }

        if (barElement.style.backgroundColor !== newColor) {
            barElement.style.backgroundColor = newColor;
            debugPrint('info', 'Bar color style updated to:', newColor);
        } else {
            debugPrint('info', 'Bar color is already correct, no change needed.', newColor);
        }

        if (backgroundBarElement && backgroundBarElement instanceof HTMLElement) {
            const newOpacity = (newColor === defaultBarColor) ? '0.1' : '0.2';
            if (backgroundBarElement.style.backgroundColor !== newColor || backgroundBarElement.style.opacity !== newOpacity) {
                backgroundBarElement.style.backgroundColor = newColor;
                backgroundBarElement.style.opacity = newOpacity;
                debugPrint('info', 'Background bar style updated. Color:', newColor, 'Opacity:', newOpacity);
            } else {
                debugPrint('info', 'Background bar style already correct.');
            }
        } else {
            debugPrint('warn', 'Background bar element not found or not an HTMLElement.', backgroundBarElement);
        }
    }

    function observeDOMChanges() {
        debugPrint('info', 'Setting up DOM observer...');
        const commonAncestor = document.querySelector(".bg-brand-dashboard-card");

        if (commonAncestor) {
            const observer = new MutationObserver((mutationsList) => {
                for (const mutation of mutationsList) {
                    let relevantChange = false;
                    if (mutation.type === 'childList' || mutation.type === 'characterData') {
                        const usageEl = document.querySelector(USAGE_ELEMENT_SELECTOR);
                        const barEl = document.querySelector(USAGE_BAR_SELECTOR);
                        if ( (usageEl && (mutation.target.contains(usageEl) || mutation.target === usageEl || usageEl.contains(mutation.target))) ||
                             (barEl && (mutation.target.contains(barEl) || mutation.target === barEl || barEl.contains(mutation.target))) ||
                             (usageEl && mutation.target.nodeType === Node.TEXT_NODE && usageEl.contains(mutation.target.parentElement))
                        ) {
                            relevantChange = true;
                        }
                    }
                    if (relevantChange) {
                         debugPrint('info', 'Relevant DOM change detected via MutationObserver. Re-evaluating usage bar color.', mutation);
                         updateUsageBarColor();
                         return; // Process once per batch of mutations
                    }
                }
            });
            observer.observe(commonAncestor, { childList: true, subtree: true, characterData: true });
            debugPrint('info', 'MutationObserver successfully set up on:', commonAncestor);
        } else {
            debugPrint('warn', 'Could not find common ancestor for MutationObserver. Falling back to interval check for updates.');
            setInterval(() => {
                debugPrint('info', 'Periodic check for updates (fallback interval).');
                updateUsageBarColor();
            }, 5000); // Check every 5 seconds
        }
    }

    function init() {
        if (hasInitialized) {
            debugPrint('info', 'Initialization already attempted/completed. Skipping further init calls.');
            return;
        }
        hasInitialized = true;

        debugPrint('info', `Script v0.4 initializing... Path: ${window.location.pathname}`);

        let attempts = 0;
        const maxAttempts = 30; // 15 seconds (30 * 500ms)
        const intervalId = setInterval(() => { // Store the interval ID
            attempts++;
            debugPrint('info', `Attempting to find elements (attempt ${attempts}/${maxAttempts})...`);
            const usageElement = document.querySelector(USAGE_ELEMENT_SELECTOR);
            const barElementContainer = document.querySelector(USAGE_BAR_SELECTOR);

            if (usageElement && barElementContainer && barElementContainer.firstChild) {
                clearInterval(intervalId); // Use the stored ID
                debugPrint('info', 'Required elements found. Proceeding with script.');
                updateUsageBarColor();
                observeDOMChanges();
            } else {
                if (!usageElement) debugPrint('warn', 'Usage element not yet found.');
                if (!barElementContainer) debugPrint('warn', 'Bar element container not yet found.');
                else if (!barElementContainer.firstChild) debugPrint('warn', 'Bar element container found, but its firstChild (the bar itself) is missing.');

                if (attempts >= maxAttempts) {
                    clearInterval(intervalId); // Use the stored ID
                    debugPrint('error', 'Elements not found after maximum attempts. Script will not run.');
                }
            }
        }, 500);
    }

    debugPrint('info', 'Script execution started (v0.4). Checking document.readyState...', document.readyState);
    if (document.readyState === "complete" || document.readyState === "interactive") {
        debugPrint('info', 'DOM is already complete/interactive. Calling init().');
        init();
    } else {
        debugPrint('info', 'DOM not yet complete. Adding DOMContentLoaded listener.');
        document.addEventListener("DOMContentLoaded", () => {
            debugPrint('info', 'DOMContentLoaded event fired. Calling init().');
            init();
        });
    }

})();