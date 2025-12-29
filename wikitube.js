// ==UserScript==
// @name         Wikitube - YouTube on Wikipedia & Baidu Baike
// @name:zh-CN   Wikitube - YouTube on 维基百科 & 百度百科
// @name:zh-TW   Wikitube - YouTube on 維基百科 & 百度百科
// @namespace    thyu
// @version      3.7.7
// @description  Adds relevant YouTube videos to Wikipedia & 百度百科
// @description:zh-cn  Adds relevant YouTube videos to 维基百科 & 百度百科
// @description:zh-TW  Adds relevant YouTube videos to 維基百科 & 百度百科
// @include      http*://*.wikipedia.org/*
// @include      http*://www.wikiwand.com/*
// @include      http*://baike.baidu.com/item/*
// @require      http://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js
// @author       Mark Dunne | http://markdunne.github.io/ | https://chrome.google.com/webstore/detail/wikitube/aneddidibfifdpbeppmpoackniodpekj
// @developer    vinc, drhouse, thyu
// @icon         https://en.wikipedia.org/static/favicon/wikipedia.ico
// @grant GM_setValue
// @grant GM_getValue
// @updateURL    https://github.com/johan456789/userscripts/raw/main/wikitube.js
// @downloadURL  https://github.com/johan456789/userscripts/raw/main/wikitube.js
// @require      https://github.com/johan456789/userscripts/raw/main/utils/logger.js
// ==/UserScript==

const Wikitube = (() => {
  const logger = Logger("[Wikitube]");
  const CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days

  const state = {
    titleText: "",
    numVideosToLoad: 0,
    numVideosLoaded: 0,
    container: null,
    moreButton: null,
    host: null,
    shadowRoot: null,
    apiKey: "",
  };

  const addGlobalStyle = (css) => {
    const style = document.createElement("style");
    style.type = "text/css";
    style.innerHTML = css;
    if (state && state.shadowRoot) {
      state.shadowRoot.appendChild(style);
      return;
    }
    const head = document.getElementsByTagName("head")[0];
    if (!head) {
      return;
    }
    head.appendChild(style);
  };

  const injectBaseStyles = () => {
    addGlobalStyle(
      "#wikitube_container { overflow-y:hidden; white-space: nowrap; }"
    );
    addGlobalStyle(
      "#wikitube_container div { position: relative; width: auto; height: 200px; margin-right: 5px; display: inline-block; box-shadow: 0 0 5px #888; }"
    );
    addGlobalStyle(
      "#wikitube_container .plusBtn { width: 100px;\ttext-align: center;\tborder-radius: 5px;\tbackground-color: rgb(192, 62, 62);\tbackground-position: center;\tbackground-repeat: no-repeat;\tbackground-size: 64px 64px;\tcursor: pointer;}"
    );
    addGlobalStyle(
      "#wikitube_container .plusBtn:hover { background-color: rgb(192, 92, 92); }"
    );
  };

  const getApiKey = () => {
    let key = GM_getValue("youtubeApiKey", "");
    if (!key) {
      key = prompt(
        "[Wikitube] YouTube API key not set. Please enter your YouTube Data API v3 key:",
        ""
      );
      if (key) {
        GM_setValue("youtubeApiKey", key);
      }
    }
    return key;
  };

  const isAllowedPath = (path) => {
    logger("Processing path:", path);
    const host = window.location.hostname;
    let articleTitle = null;

    const onWikipediaIndex =
      /\.wikipedia\.org$/.test(host) && path === "/w/index.php";
    if (onWikipediaIndex) {
      const params = new URLSearchParams(window.location.search);
      const action = params.get("action");
      if (action && action.toLowerCase() !== "view") {
        return false;
      }
      articleTitle = params.get("title");
      if (!articleTitle) {
        return false;
      }
    } else {
      const prefixes = [
        "/wiki/",
        ...wikipedia_lang_codes.map((lang) => `/${lang}/`),
      ];
      const prefix = prefixes.find((p) => path.startsWith(p));
      if (prefix) {
        articleTitle = path.substring(prefix.length);
      }
    }

    if (!articleTitle) {
      return false;
    }
    const banned_title_prefixes = [
      "Help:",
      "Wikipedia:",
      "User:",
      "Special:",
      "Category:",
      "Template:",
      "Talk:",
      "File:",
    ];
    const banned_titles = ["Main_Page"];
    if (
      banned_title_prefixes.some((prefix) => articleTitle.startsWith(prefix))
    ) {
      return false;
    }
    if (banned_titles.includes(articleTitle)) {
      return false;
    }
    return true;
  };

  function determineContext() {
    if ($("#mw-content-text").length) {
      let titleText = $("#firstHeading > span.mw-page-title-main").text();
      if (!titleText) {
        titleText = $("#firstHeading").contents().first().text();
      }
      return {
        titleText,
        numVideosToLoad: Math.floor($("#bodyContent").width() / 350) + 1,
        insertBefore: "#mw-content-text",
      };
    } else if ($(".main-content").length) {
      return {
        titleText: $(".lemmaWgt-lemmaTitle-title h1")[0].textContent,
        numVideosToLoad:
          Math.floor(
            $(".body-wrapper .content-wrapper .content").width() / 350
          ) + 1,
        insertBefore: ".main-content",
      };
    } else if ($("#fullContent").length) {
      return {
        titleText: $(".firstHeading > span").text(),
        numVideosToLoad: Math.floor(
          $("#article_content_wrapper").width() / 350
        ),
        insertBefore: "#fullContent",
      };
    }
    return null;
  }

  const getCachedResponse = (key) => {
    const cached = GM_getValue(key);
    if (!cached) return null;
    try {
      const obj = JSON.parse(cached);
      if (!obj || !obj.timestamp) {
        return null;
      }
      if (Date.now() - obj.timestamp > CACHE_EXPIRY) {
        if (typeof GM_deleteValue === "function") {
          GM_deleteValue(key);
        }
        return null;
      }
      return obj.data;
    } catch (e) {
      return null;
    }
  };

  const setCachedResponse = (key, data) => {
    const cacheObj = { timestamp: Date.now(), data };
    GM_setValue(key, JSON.stringify(cacheObj));
  };

  const setHorizScroll = () => {
    if (!state.container) return;
    state.container.on("mousewheel DOMMouseScroll", function (e) {
      let delt = null;
      if (e.type === "mousewheel") {
        delt = e.originalEvent.wheelDelta * -1;
      } else if (e.type === "DOMMouseScroll") {
        delt = 40 * e.originalEvent.detail;
      }
      if (delt) {
        e.preventDefault();
        $(this).scrollLeft(delt + $(this).scrollLeft());
      }
    });
  };

  const setupContainer = (insertBeforeSelector) => {
    logger("Setting up container");
    // Create host and shadow root to isolate styles from the page
    state.host = document.createElement("div");
    $(state.host).insertBefore(insertBeforeSelector);
    state.shadowRoot = state.host.attachShadow({ mode: "open" });

    // Build container and UI inside the shadow root
    state.container = $('<div id="wikitube_container"></div>');
    state.moreButton = $(
      '<div class="plusBtn" title="Load more videos!"></div>'
    );
    // Append container into shadow root, then add the button inside container
    state.shadowRoot.appendChild(state.container[0]);
    state.container.append(state.moreButton);

    const plusSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect x="56" y="24" width="16" height="80" rx="8" fill="white"/><rect x="24" y="56" width="80" height="16" rx="8" fill="white"/></svg>';
    const plusSvgURL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      plusSvg
    )}`;
    state.moreButton.css("background-image", `url(${plusSvgURL})`);
    state.moreButton.click(() => {
      loadAndRender();
    });

    // Inject styles into the shadow root and set scroll behavior
    injectBaseStyles();
    setHorizScroll();
    maybeCompensateGlobalInvert();
  };

  const addVideosToPage = (newVideos) => {
    for (const video of newVideos) {
      const wrapper = document.createElement("div");
      wrapper.className = "vinc_yt";
      const iframe = document.createElement("iframe");
      iframe.width = "350";
      iframe.height = "200";
      iframe.setAttribute("frameborder", "0");
      iframe.setAttribute("allowfullscreen", "");
      iframe.src = `//www.youtube.com/embed/${video["id"]["videoId"]}`;
      wrapper.appendChild(iframe);
      state.container[0].insertBefore(wrapper, state.moreButton[0]);
    }
  };

  const maybeCompensateGlobalInvert = () => {
    // Some dark-mode styles globally invert the page using CSS filters on html/body.
    // When that happens, embedded iframes appear inverted inside our shadow root.
    // Detect a global invert and compensate by double-inverting only the iframe when not fullscreen.
    try {
      const htmlFilter =
        window.getComputedStyle(document.documentElement).filter || "";
      const bodyFilter = document.body
        ? window.getComputedStyle(document.body).filter || ""
        : "";
      const hasInvert =
        /invert\(/i.test(htmlFilter) || /invert\(/i.test(bodyFilter);
      if (!hasInvert) return;
      const style = document.createElement("style");
      style.type = "text/css";
      style.textContent =
        "#wikitube_container iframe:not(:fullscreen):not(:-webkit-full-screen){filter: invert(1) hue-rotate(180deg) !important;}";
      if (state.shadowRoot) {
        state.shadowRoot.appendChild(style);
      } else {
        const head = document.getElementsByTagName("head")[0];
        if (head) head.appendChild(style);
      }
    } catch (e) {
      // no-op; best-effort compensation only
    }
  };

  let context = null;

  const loadAndRender = () => {
    const cacheKey = `yt_search_${state.titleText}`;
    const cachedItems = getCachedResponse(cacheKey);

    const processVideos = (videoItems) => {
      logger(
        `Processing ${videoItems.length} videos, currently loaded: ${state.numVideosLoaded}`
      );
      const newVideos = videoItems.slice(
        state.numVideosLoaded,
        state.numVideosLoaded + state.numVideosToLoad
      );
      logger(`Adding ${newVideos.length} new videos to page`);
      state.numVideosLoaded += newVideos.length;
      addVideosToPage(newVideos);
      // Hide the plus button when all available videos are loaded (max 50)
      if (state.moreButton && state.numVideosLoaded >= videoItems.length) {
        state.moreButton.css("display", "none");
      }
    };

    if (cachedItems) {
      logger(`Using cached items (${cacheKey})`);
      processVideos(cachedItems);
      return;
    }

    logger("No cached items found, making API request");
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
      state.titleText
    )}&key=${
      state.apiKey
    }&type=video&videoEmbeddable=true&order=relevance&maxResults=50`; // the max allowed by the API
    logger(`API URL: ${url}`);

    $.getJSON(url, (response) => {
      logger("API response received");
      if (response && response["items"] && response["items"].length > 0) {
        logger(`Caching ${response["items"].length} items`);
        setCachedResponse(cacheKey, response["items"]);
        processVideos(response["items"]);
      } else {
        logger("No items found in API response");
      }
    });
  };

  const init = () => {
    state.apiKey = getApiKey();
    if (!isAllowedPath(window.location.pathname)) {
      return;
    }
    context = determineContext();
    if (!context) {
      logger("No context found");
      return;
    }
    // insert placeholder container
    const { titleText, numVideosToLoad, insertBefore } = context;
    state.titleText = titleText;
    state.numVideosToLoad = numVideosToLoad;
    setupContainer(insertBefore);
    loadAndRender();
  };

  return { init };
})();

$(() => {
  Wikitube.init();
});

// https://github.com/wikimedia/language-data/blob/master/data/langdb.yaml
const wikipedia_lang_codes = [
  "aa",
  "aae",
  "ab",
  "abe",
  "abr",
  "abs",
  "ace",
  "acf",
  "ach",
  "acm",
  "acq",
  "ada",
  "ady",
  "ady-cyrl",
  "ady-latn",
  "aeb",
  "aeb-arab",
  "aeb-latn",
  "af",
  "agq",
  "agr",
  "ahr",
  "aig",
  "aii",
  "ajg",
  "ajp",
  "ajp-arab",
  "ajp-latn",
  "akb",
  "akz",
  "ale",
  "ale-cyrl",
  "aln",
  "als",
  "alt",
  "am",
  "ami",
  "an",
  "ang",
  "ann",
  "anp",
  "apc",
  "apc-arab",
  "apc-latn",
  "apw",
  "ar",
  "arc",
  "arn",
  "aro",
  "arq",
  "ars",
  "ary",
  "ary-arab",
  "ary-latn",
  "arz",
  "as",
  "ase",
  "ast",
  "atj",
  "atv",
  "av",
  "avk",
  "awa",
  "ay",
  "ayh",
  "az",
  "az-arab",
  "az-cyrl",
  "az-latn",
  "azb",
  "azj",
  "ba",
  "ban",
  "ban-bali",
  "bar",
  "bas",
  "bat-smg",
  "bax",
  "bax-bamu",
  "bbc",
  "bbc-batk",
  "bbc-latn",
  "bcc",
  "bci",
  "bcl",
  "bdr",
  "be",
  "be-tarask",
  "be-x-old",
  "bem",
  "bew",
  "bfa",
  "bfq",
  "bft",
  "bfw",
  "bg",
  "bgc",
  "bgc-arab",
  "bgn",
  "bh",
  "bho",
  "bi",
  "bin",
  "bjn",
  "bkm",
  "blc",
  "blk",
  "bm",
  "bn",
  "bnn",
  "bo",
  "bol",
  "bom",
  "bpy",
  "bqi",
  "br",
  "brh",
  "brx",
  "bs",
  "btd",
  "btm",
  "bto",
  "bts",
  "btx",
  "btz",
  "bug",
  "bug-bugi",
  "bug-latn",
  "bum",
  "bwr",
  "bxr",
  "byn",
  "byv",
  "bzj",
  "bzs",
  "ca",
  "cak",
  "cbk",
  "cbk-zam",
  "ccp",
  "cdo",
  "cdo-hani",
  "cdo-hans",
  "cdo-hant",
  "cdo-latn",
  "ce",
  "ceb",
  "ch",
  "chm",
  "chn",
  "cho",
  "chr",
  "chy",
  "ciw",
  "cja",
  "cja-arab",
  "cja-cham",
  "cja-latn",
  "cjk",
  "cjm",
  "cjm-arab",
  "cjm-cham",
  "cjm-latn",
  "cjy",
  "cjy-hans",
  "cjy-hant",
  "ckb",
  "cko",
  "ckt",
  "ckv",
  "cnh",
  "cnr",
  "cnr-cyrl",
  "cnr-latn",
  "co",
  "cop",
  "cps",
  "cpx",
  "cpx-hans",
  "cpx-hant",
  "cpx-latn",
  "cr",
  "cr-cans",
  "cr-latn",
  "crg",
  "crh",
  "crh-cyrl",
  "crh-latn",
  "crh-ro",
  "cs",
  "csb",
  "cu",
  "cv",
  "cy",
  "da",
  "dag",
  "dar",
  "ddn",
  "de",
  "de-at",
  "de-ch",
  "de-formal",
  "dga",
  "dik",
  "din",
  "diq",
  "dlg",
  "doi",
  "dru",
  "dsb",
  "dso",
  "dtp",
  "dty",
  "dua",
  "dv",
  "dyu",
  "dz",
  "ee",
  "efi",
  "egl",
  "ekp",
  "el",
  "elm",
  "eml",
  "en",
  "en-ca",
  "en-gb",
  "en-simple",
  "en-us",
  "eo",
  "es",
  "es-419",
  "es-formal",
  "es-ni",
  "esu",
  "et",
  "eu",
  "ext",
  "eya",
  "fa",
  "fan",
  "fat",
  "fax",
  "ff",
  "fi",
  "fil",
  "fit",
  "fiu-vro",
  "fj",
  "fkv",
  "fo",
  "fon",
  "fr",
  "frc",
  "frp",
  "frr",
  "frs",
  "fuf",
  "fuv",
  "fvr",
  "fy",
  "ga",
  "gaa",
  "gag",
  "gah",
  "gan",
  "gan-hans",
  "gan-hant",
  "gaz",
  "gbm",
  "gbz",
  "gcf",
  "gcr",
  "gd",
  "gez",
  "gju-arab",
  "gju-deva",
  "gl",
  "gld",
  "glk",
  "gn",
  "gom",
  "gom-deva",
  "gom-latn",
  "gor",
  "got",
  "gpe",
  "grc",
  "gsw",
  "gu",
  "guc",
  "gum",
  "gur",
  "guw",
  "gv",
  "ha",
  "ha-arab",
  "ha-latn",
  "hai",
  "hak",
  "hak-hans",
  "hak-hant",
  "hak-latn",
  "hav",
  "haw",
  "he",
  "hi",
  "hif",
  "hif-deva",
  "hif-latn",
  "hil",
  "hke",
  "hne",
  "hno",
  "ho",
  "hoc",
  "hoc-latn",
  "hr",
  "hrx",
  "hsb",
  "hsn",
  "ht",
  "hu",
  "hu-formal",
  "hy",
  "hyw",
  "hz",
  "ia",
  "iba",
  "ibb",
  "id",
  "ie",
  "ig",
  "igb",
  "igl",
  "ii",
  "ik",
  "ike-cans",
  "ike-latn",
  "ilo",
  "inh",
  "io",
  "is",
  "ish",
  "isv",
  "isv-cyrl",
  "isv-latn",
  "it",
  "iu",
  "izh",
  "ja",
  "jac",
  "jam",
  "jbo",
  "jdt",
  "jdt-cyrl",
  "jje",
  "jut",
  "jv",
  "jv-java",
  "ka",
  "kaa",
  "kab",
  "kac",
  "kai",
  "kaj",
  "kam",
  "kbd",
  "kbd-cyrl",
  "kbd-latn",
  "kbp",
  "kcg",
  "kck",
  "kea",
  "ken",
  "kg",
  "kge",
  "kge-arab",
  "kgg",
  "kgp",
  "khk",
  "khw",
  "ki",
  "kip",
  "kiu",
  "kj",
  "kjh",
  "kjp",
  "kk",
  "kk-arab",
  "kk-cn",
  "kk-cyrl",
  "kk-kz",
  "kk-latn",
  "kk-tr",
  "kl",
  "km",
  "kmb",
  "kmr",
  "kn",
  "knc",
  "knn",
  "ko",
  "ko-kp",
  "koi",
  "koy",
  "kr",
  "krc",
  "kri",
  "krj",
  "krl",
  "ks",
  "ks-arab",
  "ks-deva",
  "ksf",
  "ksh",
  "ksw",
  "ku",
  "ku-arab",
  "ku-latn",
  "kum",
  "kus",
  "kv",
  "kw",
  "ky",
  "la",
  "lad",
  "lad-hebr",
  "lad-latn",
  "lag",
  "laj",
  "lb",
  "lbe",
  "ldn",
  "lez",
  "lfn",
  "lg",
  "li",
  "lij",
  "lij-mc",
  "liv",
  "ljp",
  "lki",
  "lkt",
  "lld",
  "lmo",
  "ln",
  "lo",
  "lou",
  "loz",
  "lrc",
  "lt",
  "ltg",
  "lua",
  "lud",
  "lue",
  "luo",
  "lus",
  "lut",
  "luz",
  "lv",
  "lvs",
  "lzh",
  "lzz",
  "mad",
  "mag",
  "mai",
  "mak",
  "mak-bugi",
  "map-bms",
  "maw",
  "mcn",
  "mdf",
  "mdh",
  "mey",
  "mfa",
  "mfe",
  "mg",
  "mh",
  "mhr",
  "mi",
  "mic",
  "min",
  "miq",
  "mk",
  "ml",
  "mn",
  "mn-cyrl",
  "mn-mong",
  "mnc",
  "mnc-latn",
  "mnc-mong",
  "mni",
  "mni-beng",
  "mns",
  "mnw",
  "mo",
  "moe",
  "mos",
  "mr",
  "mrh",
  "mrj",
  "mrt",
  "mrv",
  "ms",
  "ms-arab",
  "msi",
  "mt",
  "mui",
  "mus",
  "mvf",
  "mwl",
  "mwv",
  "mww",
  "mww-latn",
  "my",
  "myv",
  "mzn",
  "na",
  "nah",
  "nan",
  "nan-hani",
  "nan-hans",
  "nan-hant",
  "nan-latn",
  "nan-latn-pehoeji",
  "nan-latn-tailo",
  "nap",
  "naq",
  "nb",
  "nd",
  "nds",
  "nds-nl",
  "ne",
  "new",
  "ng",
  "nia",
  "nit",
  "niu",
  "njo",
  "nl",
  "nl-informal",
  "nmz",
  "nn",
  "nn-hognorsk",
  "no",
  "nod",
  "nod-thai",
  "nog",
  "nov",
  "npi",
  "nqo",
  "nr",
  "nrf-gg",
  "nrf-je",
  "nrm",
  "nso",
  "nup",
  "nus",
  "nv",
  "ny",
  "nyn",
  "nyo",
  "nys",
  "nzi",
  "oc",
  "ojb",
  "oka",
  "olo",
  "om",
  "ood",
  "or",
  "ory",
  "os",
  "osi",
  "ota",
  "ovd",
  "pa",
  "pa-arab",
  "pa-guru",
  "pag",
  "pam",
  "pap",
  "pap-aw",
  "pbb",
  "pbt",
  "pcd",
  "pcm",
  "pdc",
  "pdt",
  "pes",
  "pey",
  "pfl",
  "phr",
  "pi",
  "pih",
  "pis",
  "piu",
  "pjt",
  "pko",
  "pl",
  "plt",
  "pms",
  "pnb",
  "pnt",
  "pov",
  "ppl",
  "prg",
  "prs",
  "ps",
  "pt",
  "pt-br",
  "pwn",
  "pzh",
  "qu",
  "quc",
  "qug",
  "quy",
  "qwh",
  "qxp",
  "rag",
  "raj",
  "rap",
  "rcf",
  "rej",
  "rgn",
  "rhg",
  "rif",
  "rki",
  "rm",
  "rm-puter",
  "rm-rumgr",
  "rm-surmiran",
  "rm-sursilv",
  "rm-sutsilv",
  "rm-vallader",
  "rmc",
  "rmf",
  "rml-cyrl",
  "rmy",
  "rn",
  "ro",
  "roa-rup",
  "roa-tara",
  "rsk",
  "rtm",
  "ru",
  "rue",
  "rup",
  "ruq",
  "ruq-cyrl",
  "ruq-latn",
  "rut",
  "rw",
  "rwr",
  "ryu",
  "sa",
  "sah",
  "sas",
  "sat",
  "saz",
  "sc",
  "scn",
  "sco",
  "sd",
  "sdc",
  "sdh",
  "se",
  "se-fi",
  "se-no",
  "se-se",
  "sei",
  "ses",
  "sg",
  "sgs",
  "sh",
  "sh-cyrl",
  "sh-latn",
  "shi",
  "shi-latn",
  "shi-tfng",
  "shn",
  "shy",
  "shy-latn",
  "si",
  "simple",
  "sjd",
  "sje",
  "sjo",
  "sju",
  "sk",
  "skr",
  "skr-arab",
  "sl",
  "sli",
  "slr",
  "sly",
  "sm",
  "sma",
  "smj",
  "smn",
  "sms",
  "sn",
  "so",
  "son",
  "sq",
  "sr",
  "sr-cyrl",
  "sr-ec",
  "sr-el",
  "sr-latn",
  "srn",
  "sro",
  "srq",
  "ss",
  "st",
  "stq",
  "sty",
  "su",
  "sv",
  "sw",
  "swb",
  "swh",
  "sxu",
  "syc",
  "syl",
  "syl-beng",
  "syl-sylo",
  "szl",
  "szy",
  "ta",
  "taq",
  "taq-latn",
  "taq-tfng",
  "tay",
  "tcy",
  "tdd",
  "te",
  "tet",
  "tg",
  "tg-cyrl",
  "tg-latn",
  "th",
  "thq",
  "thr",
  "ti",
  "tig",
  "tji",
  "tk",
  "tkr",
  "tl",
  "tly",
  "tly-cyrl",
  "tmr",
  "tn",
  "to",
  "toi",
  "tok",
  "tokipona",
  "tpi",
  "tr",
  "trp",
  "tru",
  "trv",
  "trw",
  "ts",
  "tsd",
  "tsg",
  "tt",
  "tt-cyrl",
  "tt-latn",
  "ttj",
  "tum",
  "tw",
  "twd",
  "ty",
  "tyv",
  "tzl",
  "tzm",
  "udm",
  "ug",
  "ug-arab",
  "ug-cyrl",
  "ug-latn",
  "uk",
  "umb",
  "umu",
  "ur",
  "uz",
  "uz-cyrl",
  "uz-latn",
  "uzn",
  "vai",
  "ve",
  "vec",
  "vep",
  "vi",
  "vls",
  "vmf",
  "vmw",
  "vo",
  "vot",
  "vro",
  "wa",
  "wal",
  "war",
  "wls",
  "wlx",
  "wo",
  "wsg",
  "wuu",
  "wuu-hans",
  "wuu-hant",
  "xal",
  "xh",
  "xmf",
  "xmm",
  "xon",
  "xsy",
  "ydd",
  "yi",
  "yo",
  "yoi",
  "yrk",
  "yrl",
  "yua",
  "yue",
  "yue-hans",
  "yue-hant",
  "za",
  "zea",
  "zgh",
  "zgh-latn",
  "zh",
  "zh-cdo",
  "zh-classical",
  "zh-cn",
  "zh-hans",
  "zh-hant",
  "zh-hk",
  "zh-min-nan",
  "zh-mo",
  "zh-my",
  "zh-sg",
  "zh-tw",
  "zh-yue",
  "zmi",
  "zsm",
  "zu",
  "zun",
];
