// ==UserScript==
// @name         Wikitube - YouTube on Wikipedia & Baidu Baike
// @name:zh-CN   Wikitube - YouTube on 维基百科 & 百度百科
// @name:zh-TW   Wikitube - YouTube on 維基百科 & 百度百科
// @namespace    thyu
// @version      3.6.4
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
// ==/UserScript==

$(document).ready(function () {
    // check api key validity: https://www.googleapis.com/youtube/v3/search?part=snippet&q=YouTube+Data+API&type=video&key=YOUR_API_KEY
    let YOUTUBE_DATA_API_CREDENTIAL = GM_getValue("youtubeApiKey", "");
    
    if (!YOUTUBE_DATA_API_CREDENTIAL) {
        YOUTUBE_DATA_API_CREDENTIAL = prompt(
            '[Wikitube] YouTube API key not set. Please enter your YouTube Data API v3 key:',
            ''
        );
        if (YOUTUBE_DATA_API_CREDENTIAL) {
            GM_setValue("youtubeApiKey", YOUTUBE_DATA_API_CREDENTIAL);
        }
    }

    // pages of wikipedia which should disable Wikitube
    const banned_paths = [
        '/wiki/Main_Page',
		];
    const banned_paths_prefix = [
        '/wiki/Help:',
        '/wiki/Wikipedia:',
        '/wiki/User:',
        '/wiki/Special:'
    ];

	function addGlobalStyle(css) {
		let head, style;
		head = document.getElementsByTagName('head')[0];
		if (!head) { return; }
		style = document.createElement('style');
		style.type = 'text/css';
		style.innerHTML = css;
		head.appendChild(style);
	}

	addGlobalStyle('#wikitube_container { padding-bottom: 30px; overflow-y:hidden; white-space: nowrap; }');
	addGlobalStyle('#wikitube_container div { position: relative; width: auto; height: 200px; margin-right: 5px; display: inline-block; box-shadow: 0 0 5px #888; }');
	addGlobalStyle('#wikitube_container .plusBtn { width: 100px;\ttext-align: center;\tborder-radius: 5px;\tbackground-color: rgb(192, 62, 62);\tbackground-position: center;\tbackground-repeat: no-repeat;\tbackground-size: 64px 64px;\tcursor: pointer;}');
	addGlobalStyle('#wikitube_container .plusBtn:hover { background-color: rgb(192, 92, 92); }');

	const allow_path = function(path){
        console.log(path);
        for (let i = 0; i < banned_paths_prefix.length; i++){
			if(path.startsWith(banned_paths_prefix[i])){
               return false;
            }
        }
		for (let i = 0; i < banned_paths.length; i++) {
            if(path == banned_paths[i]){
				return false;
            }
		}
		return true;
	}

	let title_text;
	let num_videos_to_load;
	let num_videos_loaded = 0;
	const more_videos_button = $('<div class="plusBtn" title="Load more videos!"></div>');
	const container = $('<div id="wikitube_container"></div>');

	const first_load = function(){
        if( $('#mw-content-text').length ){ // wikipedia
            container.insertBefore('#mw-content-text');
        } else if( $('.main-content').length ){ // 百度百科
            container.insertBefore('.main-content');
        } else if ($('#fullContent').length) { // wikiwand
            container.insertBefore('#fullContent');
        }
		container.append(more_videos_button);

		const plusSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect x="56" y="24" width="16" height="80" rx="8" fill="white"/><rect x="24" y="56" width="80" height="16" rx="8" fill="white"/></svg>';
		const plusSvgURL = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(plusSvg);

		more_videos_button.css('background-image', 'url(' + plusSvgURL + ')');

		more_videos_button.click(function(){
			load_new_videos(false);
		});

        $('iframe').ready(function(){
            vinc_set_horiz_scroll();
        });
	}

	// Cache helper functions
	const CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

	function getCachedResponse(key) {
		const cached = GM_getValue(key);
		if (!cached) return null;

		const {timestamp, data} = JSON.parse(cached);
		if (Date.now() - timestamp > CACHE_EXPIRY) {
			GM_deleteValue(key);
			return null;
		}
		return data;
	}

	function setCachedResponse(key, data) {
		const cacheObj = {
			timestamp: Date.now(),
			data: data
		};
		GM_setValue(key, JSON.stringify(cacheObj));
	}

	const load_new_videos = function(is_first_load){
		const cacheKey = 'yt_search_' + title_text;
		const cachedItems = getCachedResponse(cacheKey);

		function processVideos(videoItems) {
			if (is_first_load) {
				first_load();
			}
			let videos = videoItems;
			const new_videos = videos.slice(num_videos_loaded);
			num_videos_loaded += num_videos_to_load;
			add_videos_to_page(new_videos);
		}

		if (cachedItems) {
			processVideos(cachedItems);
			return;
		}

		const url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&q='+title_text+'&key=' + YOUTUBE_DATA_API_CREDENTIAL + '&maxResults='+(num_videos_loaded+num_videos_to_load);
		$.getJSON(url, function(response){
			if(response['items'].length > 0){
				setCachedResponse(cacheKey, response['items']);
				processVideos(response['items']);
			}
		});
	}

	const add_videos_to_page = function(new_videos){
		for (let i = 0; i < new_videos.length; i++) {
			let video = new_videos[i];
			const videoHtml = '<div class="vinc_yt"><iframe width="350" height="200" frameborder="0" allowfullscreen src="//www.youtube.com/embed/'+video['id']['videoId']+'"></iframe></div>';
			more_videos_button.before(videoHtml);
		};
	}

	const test_func = function(){
		let url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&q=memes&key=' + YOUTUBE_DATA_API_CREDENTIAL;
		$.getJSON(url, function(response){
			console.log(response);
		})
	}

    const vinc_set_horiz_scroll = function(){
        $('#wikitube_container').on('mousewheel DOMMouseScroll', function(e){
            let delt = null;

            if (e.type == 'mousewheel') {
                delt = (e.originalEvent.wheelDelta * -1);
            }
            else if (e.type == 'DOMMouseScroll') {
                delt = 40 * e.originalEvent.detail;
            }

            if (delt) {
                e.preventDefault();
                $(this).scrollLeft(delt + $(this).scrollLeft());
            }
        });
    }

    // main code
    if(allow_path(window.location.pathname)){
        if( $('#mw-content-text').length ){ // wikipedia

            // title_text = document.getElementById('firstHeading').innerText;
            title_text = $("#firstHeading")[0].textContent;
            num_videos_to_load = Math.floor($('#bodyContent').width() / 350) + 1; //video width = 350px

            // [REMOVED] append a youtube link icon after title
        } else if( $('.main-content').length ){ // 百度百科
            title_text = $(".lemmaWgt-lemmaTitle-title h1")[0].textContent;
            num_videos_to_load = Math.floor($('.body-wrapper .content-wrapper .content').width() / 350) + 1; //video width = 350px

        } else if ($('#fullContent').length){ // wikiwand
            title_text = $('.firstHeading > span').text();
            num_videos_to_load = Math.floor($('#article_content_wrapper').width() / 350); //video width = 350px
        }
        load_new_videos(true);
    }

});
