// ==UserScript==
// @name      Youtube button to delete a video from a playlist
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Adds a button to directly remove videos from the playlist on YouTube
// @author       You
// @match        https://www.youtube.com/*
// @grant        none
// @license      MIT
// ==/UserScript==

// this script is edited from https://update.greasyfork.org/scripts/499379/Youtube%20button%20to%20delete%20a%20video%20from%20a%20playlist.user.js
// 2025-03-21 feat: only show the trashcan button when the playlist is editable
// 2025-03-22 feat: use reverse engineered api to fetch account menu data. and use ui as fallback method
// 2025-03-22 fix: bug when visiting playlist url from non-playlist url the script won't run


function logger(message) {
    console.log("[YT-playlist] " + message);
}


async function getSApiSidHash() {
    function sha1(str) {
        return window.crypto.subtle.digest("SHA-1", new TextEncoder("utf-8").encode(str)).then(buf => {
            return Array.prototype.map.call(new Uint8Array(buf), x => (('00' + x.toString(16)).slice(-2))).join('');
        });
    }

    function getCookie(name) {
        return document.cookie
            .split("; ")
            .find(row => row.startsWith(name + "="))
            ?.split("=")[1];
    }

    // Get the required values.
    const DATASYNC_ID = ytcfg.data_.DATASYNC_ID.split('||')[0];
    const TIMESTAMP = Math.floor(new Date().getTime() / 1E3);
    const SAPISID = getCookie('SAPISID');
    const ORIGIN = "https://www.youtube.com";

    // Concatenate the values and calculate the SHA-1 hash.
    const inputString = [DATASYNC_ID, TIMESTAMP, SAPISID, ORIGIN].join(" ");
    const digest = await sha1(inputString);

    return `${TIMESTAMP}_${digest}_u`;
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
            console.log(`Error: Element '${selector}' not found within ${timeout}ms.`);
            observer.disconnect(); // Ensure we stop observing
        }
    }, timeout);
}

async function fetchAccountMenuData() {
    try {
        const SAPISIDHASH = await getSApiSidHash();
        const response = await fetch("https://www.youtube.com/youtubei/v1/account/account_menu?prettyPrint=false", {
            method: "POST",
            headers: {
                "accept": "*/*",
                "accept-language": "en-US,en;q=0.9,zh-TW;q=0.8,zh;q=0.7",
                "content-type": "application/json",
                // Note: Authorization header might need to be dynamically obtained in a real userscript
                // For this example, I'll leave it as provided, but it may not work directly due to SAPISIDHASH expiration
                "authorization": `SAPISIDHASH ${SAPISIDHASH}`,
                "x-goog-authuser": "0",
                "x-origin": "https://www.youtube.com",
                "x-youtube-bootstrap-logged-in": "true",
                "x-youtube-client-name": "1",
                "x-youtube-client-version": "2.20250319.01.00"
            },
            body: JSON.stringify({
                "context": {
                    "client": {
                        "hl": "en",
                        "gl": "TW",
                        "clientName": "WEB",
                        "clientVersion": "2.20250319.01.00"
                    },
                    "user": {
                        "lockedSafetyMode": false
                    },
                    "request": {
                        "useSsl": true
                    }
                }
            }),
            credentials: "include",
            mode: "cors"
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching account menu data:', error);
        throw error;
    }
}

async function getCurrentUserName() {
    console.log('getting current user name');

    // use reverse engineered api
    try {
        const profileName = await new Promise(async (resolve) => {
            try {
                const data = await fetchAccountMenuData();
                // Extract the username from the response
                const name = data?.actions?.[0]?.openPopupAction?.popup?.multiPageMenuRenderer?.header?.activeAccountHeaderRenderer?.accountName?.simpleText || 'Unknown User';
                console.log(`username: ${name}`);
                resolve(name);
            } catch (error) {
                resolve('Unknown User'); // Fallback on error
            }
        });
        return profileName || 'Unknown User'; // Fallback if name is empty
    } catch (error) {
        console.log('failed to fetch account menu data via reverse engineered api. trying ui interaction now...');
    }

    // if that failed, try using ui
    try {
        waitForElement('#avatar-btn', (element) => {
            element.click();
            element.click();
        });
        const profileName = await new Promise((resolve) => {
            waitForElement('#account-name', (element) => {
                const name = element.textContent.trim(); // Clean up whitespace
                console.log(`username: ${name}`);
                resolve(name); // Pass the name back via the Promise
            });
        });
        return profileName || 'Unknown User'; // Fallback if name is empty
    } catch (error) {
        console.error('Error getting username:', error);
        return 'Unknown User'; // Fallback on timeout or error
    }
}

async function checkPlaylistEditable() {
    try {
        console.log('running checkPlaylistEditable');
        // Case 1: Check if URL contains list=WL (Watch Later playlist) or list=ll (liked video)
        if (window.location.search.includes('list=WL') || window.location.search.includes('list=LL')) {
            return true;
        }

        const currentUserName = await getCurrentUserName();
        console.log(`inside checkPlaylistEditable, currentUserName: ${currentUserName}`);

        // Define the avatar stack selector
        const avatarStackSelector = "#page-header > yt-page-header-renderer > yt-page-header-view-model > div.page-header-view-model-wiz__page-header-content > div.page-header-view-model-wiz__page-header-headline > div > yt-content-metadata-view-model > div:nth-child(1) > yt-avatar-stack-view-model > span";

        // Wait for the avatar stack to appear
        try {
            const avatarStack = await new Promise((resolve) => {
                waitForElement(avatarStackSelector, (element) => resolve(element));
            });
        } catch (e) {
            console.log(`Error: ${e}`)
        }

        if (!avatarStack) {
            console.log('Avatar stack element not found!');
            return false; // No avatar stack, assume not editable
        }

        // Case 2: Single owner playlist (avatarStack contains <a>)
        const linkElement = avatarStack.querySelector('a');
        if (linkElement) {
            const linkText = linkElement.textContent;
            console.log(`linktext: ${linkText}; currentUserName: ${currentUserName}; match: ${linkText.includes(currentUserName)}`)
            return linkText.includes(currentUserName); // Check if username is in the string
        }

        // Case 3: Multiple collaborators (avatarStack has no <a>)
        // e.g. https://www.youtube.com/playlist?list=PLOU2XLYxmsIK0r_D-zWcmJ1plIcDNnRkK
        //
        //
        /* TODO: reverse engineer api to eliminate the need of button clicks
        // These might be the relevant parameters:
        //     const url = "https://www.youtube.com/youtubei/v1/get_panel?prettyPrint=false";
        //     const playlistId = new URL(window.location.href).searchParams.get("list");
        //     const panelId = 'PAplaylist_collaborate';
        //     const sapisidHash = await getSApiSidHash();
        //     const visitorData = ytcfg.data_.INNERTUBE_CONTEXT.client.visitorData;
        */

        avatarStack.click(); // Reveal the collaborator list

        const nameElementSelector = '.ytContentListItemViewModelTitle span.yt-core-attributed-string';
        const nameElement = await new Promise((resolve) => {
            waitForElement(nameElementSelector, (element) => resolve(element));
        });

        if (!nameElement) {
            console.log('Collaborator names not found!');
            document.body.click(); // Attempt to close popup
            return false;
        }

        // Get all collaborator names
        const managerNames = Array.from(document.querySelectorAll(nameElementSelector))
            .map(span => span.textContent.trim());

        // Close the popup
        const closeBtnSelector = '#visibility-button > ytd-button-renderer > yt-button-shape > button > yt-touch-feedback-shape > div';
        const closeBtn = await new Promise((resolve) => {
            waitForElement(closeBtnSelector, (element) => resolve(element));
        });
        if (closeBtn) {
            closeBtn.click();
        } else {
            document.body.click(); // Fallback to close popup
        }

        return managerNames.includes(currentUserName); // Check if user is a collaborator

    } catch (error) {
        console.error('Error checking playlist editability:', error);
        return false; // Default to false on error
    }
}

function addRemoveButton(video) {
    console.log('Adding remove button');
    if (!video.querySelector('.remove-button')) {
        const button = document.createElement('button');
        button.classList.add('remove-button');

        const trashIcon = document.createElement('span');
        trashIcon.textContent = '🗑️'; // Unicode character for trash can

        button.appendChild(trashIcon);

        button.addEventListener('click', async () => {
            const menuButton = video.querySelector('#button');
            menuButton.click();

            await new Promise(resolve => setTimeout(resolve, 20)); // wait for a short time

            const removeButton = document.querySelector('#items > ytd-menu-service-item-renderer:nth-child(3) > tp-yt-paper-item');
            let removed = false;

            if (removeButton) {
                removeButton.click();
                removed = true;
            }

            if (!removed) {
                alert('It was not possible to delete the video. Please try again.');
            }
        });

        video.querySelector('#meta').appendChild(button);
    }
}

function addRemoveButtons() {
    console.log('Adding remove buttons to all existing videos');
    const videoContainers = document.querySelectorAll('ytd-playlist-video-renderer');
    console.log('Found', videoContainers.length, 'videos');
    videoContainers.forEach(addRemoveButton);
}


(function () {
    'use strict';

    console.log('Script started');

    const style = document.createElement('style');
    style.textContent = `
        .remove-button {
            display: flex;
            align-items: center;
            border: none;
            background: transparent;
            color: #909090;
            cursor: pointer;
            margin-top: 5px;
            padding: 0;
            transition: color 0.3s, filter 0.3s, transform 0.3s;
            font-size: 20px; /* Установите размер текста для иконки */
        }

        .remove-button:hover {
            color: #b0b0b0; /* Светлее цвет для эффекта наводки */
            filter: brightness(1.3); /* Сделать кнопку немного светлее */
        }

        .remove-button:active {
            transform: scale(0.82); /* Уменьшение кнопки при нажатии */
        }
    `;
    document.head.append(style);

    function init() {
        console.log('Initializing script');

        let lastUrl = window.location.href;
        let observer = null;

        function setupDeleteButtons() {
            // Stop any existing observer
            if (observer) observer.disconnect();

            checkPlaylistEditable().then(editable => {
                console.log(`this video is editable: ${editable}`);
                const isEditable = editable;
                if (isEditable) {
                    addRemoveButtons(); // Add buttons to existing videos

                    // Set up observer for newly loaded videos
                    observer = new MutationObserver(mutations => {
                        console.log(`in observer: isEditable is ${isEditable}`);
                        if (isEditable) {
                            mutations.forEach(mutation => {
                                mutation.addedNodes.forEach(node => {
                                    if (node.nodeType === 1 && node.matches('ytd-playlist-video-renderer')) {
                                        addRemoveButton(node);
                                    }
                                });
                            });
                        }
                    });
                    observer.observe(document.body, { childList: true, subtree: true });
                }
            });
        }

        // Initial run
        setupDeleteButtons();

        // Monitor URL changes
        setInterval(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                console.log('URL changed, re-checking playlist editability');
                setupDeleteButtons();
            }
        }, 100); // check periodically

        // window.addEventListener('yt-navigate-finish', addRemoveButtons);
    }

    init();
})();
