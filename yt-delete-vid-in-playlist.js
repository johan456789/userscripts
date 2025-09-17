// ==UserScript==
// @name      Youtube button to delete a video from a playlist
// @namespace    http://tampermonkey.net/
// @version      2.2.6
// @description  Adds a button to directly remove videos from the playlist on YouTube
// @author       You
// @match        https://www.youtube.com/*
// @noframes
// @grant        none
// @license      MIT
// @require      https://github.com/johan456789/userscripts/raw/main/utils/wait-for-element.js
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// @updateURL    https://github.com/johan456789/userscripts/raw/main/yt-delete-vid-in-playlist.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/yt-delete-vid-in-playlist.js
// ==/UserScript==

// this script is edited from https://update.greasyfork.org/scripts/499379/Youtube%20button%20to%20delete%20a%20video%20from%20a%20playlist.user.js

const logger = Logger("[yt-delete-vid-in-playlist]");

async function getSApiSidHash() {
  function sha1(str) {
    return window.crypto.subtle
      .digest("SHA-1", new TextEncoder("utf-8").encode(str))
      .then((buf) => {
        return Array.prototype.map
          .call(new Uint8Array(buf), (x) => ("00" + x.toString(16)).slice(-2))
          .join("");
      });
  }

  function getCookie(name) {
    return document.cookie
      .split("; ")
      .find((row) => row.startsWith(name + "="))
      ?.split("=")[1];
  }

  // Get the required values.
  const DATASYNC_ID = ytcfg.data_.DATASYNC_ID.split("||")[0];
  const TIMESTAMP = Math.floor(new Date().getTime() / 1e3);
  const SAPISID = getCookie("SAPISID");
  const ORIGIN = "https://www.youtube.com";

  // Concatenate the values and calculate the SHA-1 hash.
  const inputString = [DATASYNC_ID, TIMESTAMP, SAPISID, ORIGIN].join(" ");
  const digest = await sha1(inputString);

  return `${TIMESTAMP}_${digest}_u`;
}

async function fetchAccountMenuData() {
  try {
    const SAPISIDHASH = await getSApiSidHash();
    const response = await fetch(
      "https://www.youtube.com/youtubei/v1/account/account_menu?prettyPrint=false",
      {
        method: "POST",
        headers: {
          accept: "*/*",
          "accept-language": "en-US,en;q=0.9,zh-TW;q=0.8,zh;q=0.7",
          "content-type": "application/json",
          // Note: Authorization header might need to be dynamically obtained in a real userscript
          // For this example, I'll leave it as provided, but it may not work directly due to SAPISIDHASH expiration
          authorization: `SAPISIDHASH ${SAPISIDHASH}`,
          "x-goog-authuser": "0",
          "x-origin": "https://www.youtube.com",
          "x-youtube-bootstrap-logged-in": "true",
          "x-youtube-client-name": "1",
          "x-youtube-client-version": "2.20250319.01.00",
        },
        body: JSON.stringify({
          context: {
            client: {
              hl: "en",
              gl: "TW",
              clientName: "WEB",
              clientVersion: "2.20250319.01.00",
            },
            user: {
              lockedSafetyMode: false,
            },
            request: {
              useSsl: true,
            },
          },
        }),
        credentials: "include",
        mode: "cors",
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error("Error fetching account menu data:", error);
    throw error;
  }
}

async function getCurrentUserName() {
  logger("getting current user name");

  // use reverse engineered api
  try {
    const profileName = await new Promise(async (resolve) => {
      try {
        const data = await fetchAccountMenuData();
        // Extract the username from the response
        const name =
          data?.actions?.[0]?.openPopupAction?.popup?.multiPageMenuRenderer
            ?.header?.activeAccountHeaderRenderer?.accountName?.simpleText ||
          "Unknown User";
        logger(`username: ${name}`);
        resolve(name);
      } catch (error) {
        resolve("Unknown User"); // Fallback on error
      }
    });
    return profileName || "Unknown User"; // Fallback if name is empty
  } catch (error) {
    logger(
      "failed to fetch account menu data via reverse engineered api. trying ui interaction now..."
    );
  }

  // if that failed, try using ui
  try {
    waitForElement("#avatar-btn", (element) => {
      element.click();
      element.click();
    });
    const profileName = await new Promise((resolve) => {
      waitForElement("#account-name", (element) => {
        const name = element.textContent.trim(); // Clean up whitespace
        logger(`username: ${name}`);
        resolve(name); // Pass the name back via the Promise
      });
    });
    return profileName || "Unknown User"; // Fallback if name is empty
  } catch (error) {
    logger.error("Error getting username.", error);
    return "Unknown User"; // Fallback on timeout or error
  }
}

async function checkPlaylistEditable() {
  try {
    logger("running checkPlaylistEditable");
    // Check special playlists
    if (window.location.search.includes("list=WL")) {
      // Watch Later playlist
      return true;
    } else if (window.location.search.includes("list=LL")) {
      // Liked videos
      return false; // I don't see why I would remove liked videos so I'm disabling this.
    }

    const currentUserName = await getCurrentUserName();
    logger(`inside checkPlaylistEditable, currentUserName: ${currentUserName}`);

    // Define the avatar stack selector
    const avatarStackSelector =
      "#page-header > yt-page-header-renderer > yt-page-header-view-model > div.page-header-view-model-wiz__page-header-content > div.page-header-view-model-wiz__page-header-headline > div > yt-content-metadata-view-model > div:nth-child(1) > yt-avatar-stack-view-model > span";

    // Wait for the avatar stack to appear
    let avatarStack;
    try {
      avatarStack = await new Promise((resolve) => {
        waitForElement(avatarStackSelector, (element) => resolve(element));
      });
    } catch (e) {
      logger.error("Error:", e);
    }

    if (!avatarStack) {
      logger("Avatar stack element not found!");
      return false; // No avatar stack, assume not editable
    }

    // Case 2: Single owner playlist (avatarStack contains <a>)
    const linkElement = avatarStack.querySelector("a");
    if (linkElement) {
      const linkText = linkElement.textContent;
      logger(
        `linktext: ${linkText}; currentUserName: ${currentUserName}; match: ${linkText.includes(
          currentUserName
        )}`
      );
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

    const nameElementSelector =
      ".ytContentListItemViewModelTitle span.yt-core-attributed-string";
    const nameElement = await new Promise((resolve) => {
      waitForElement(nameElementSelector, (element) => resolve(element));
    });

    if (!nameElement) {
      logger("Collaborator names not found!");
      document.body.click(); // Attempt to close popup
      return false;
    }

    // Get all collaborator names
    const managerNames = Array.from(
      document.querySelectorAll(nameElementSelector)
    ).map((span) => span.textContent.trim());

    // Close the popup
    const closeBtnSelector =
      "#visibility-button > ytd-button-renderer > yt-button-shape > button > yt-touch-feedback-shape > div";
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
    logger.error("Error checking playlist editability:", error);
    return false; // Default to false on error
  }
}

function addRemoveButton(video) {
  logger("Adding remove button");
  if (!video.querySelector(".remove-button")) {
    const button = document.createElement("button");
    button.classList.add("remove-button");

    const trashIcon = document.createElement("span");
    trashIcon.textContent = "🗑️"; // Unicode character for trash can

    button.appendChild(trashIcon);

    button.addEventListener("click", async () => {
      const menuButton = video.querySelector("#button");
      menuButton.click();

      await new Promise((resolve) => setTimeout(resolve, 20)); // wait for a short time

      const actionItems = document.querySelectorAll(
        "#items > ytd-menu-service-item-renderer > tp-yt-paper-item"
      );
      let removed = false;

      if (actionItems) {
        for (const item of actionItems) {
          const text = item.textContent.trim();
          if (text.startsWith("Remove from")) {
            const removeButton = item;
            removeButton.click();
            removed = true;
            break;
          }
        }
      }

      if (!removed) {
        alert("It was not possible to delete the video. Please try again.");
      }
    });

    video.querySelector("#meta").appendChild(button);
  }
}

function addRemoveButtons() {
  logger("Adding remove buttons to all existing videos");
  const videoContainers = document.querySelectorAll(
    "ytd-playlist-video-renderer"
  );
  logger("Found", videoContainers.length, "videos");
  videoContainers.forEach(addRemoveButton);
}

(function () {
  "use strict";

  logger("Script started");

  const style = document.createElement("style");
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
    logger("Initializing script");

    let lastUrl = window.location.href;
    let observer = null;

    function setupDeleteButtons() {
      // Stop any existing observer
      if (observer) observer.disconnect();

      checkPlaylistEditable().then((editable) => {
        logger(`this video is editable: ${editable}`);
        const isEditable = editable;
        if (isEditable) {
          addRemoveButtons(); // Add buttons to existing videos

          // Set up observer for newly loaded videos
          observer = new MutationObserver((mutations) => {
            logger(`in observer: isEditable is ${isEditable}`);
            if (isEditable) {
              mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                  if (
                    node.nodeType === 1 &&
                    node.matches("ytd-playlist-video-renderer")
                  ) {
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
        logger("URL changed, re-checking playlist editability");
        setupDeleteButtons();
      }
    }, 100); // check periodically

    // window.addEventListener('yt-navigate-finish', addRemoveButtons);
  }

  init();
})();
