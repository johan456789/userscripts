// ==UserScript==
// @name         Wikitube - YouTube on Wikipedia & Baidu Baike
// @name:zh-CN   Wikitube - YouTube on 维基百科 & 百度百科
// @name:zh-TW   Wikitube - YouTube on 維基百科 & 百度百科
// @namespace    thyu
// @version      3.6.7
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

$(document).ready(function () {
    const logger = Logger('[Wikitube]');

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
        logger('Processing path:', path);
        const host = window.location.hostname;
        let articleTitle = null;

		// get article title
        const onWikipediaIndex = /\.wikipedia\.org$/.test(host) && path === '/w/index.php';
        if (onWikipediaIndex) {
            articleTitle = new URLSearchParams(window.location.search).get('title');
            if (!articleTitle) {
                return false;
            }
        } else {
            const prefixes = ['/wiki/', ...wikipedia_lang_codes.map(lang => '/' + lang + '/')];
            for (const prefix of prefixes) {
                if (path.startsWith(prefix)) {
                    articleTitle = path.substring(prefix.length);
                    break;
                }
            }
        }

		// validate article title
		if (!articleTitle) {
			return false;
		} else {
			// pages of wikipedia which should disable Wikitube
			const banned_title_prefixes = [
				'Help:',
				'Wikipedia:',
				'User:',
				'Special:'
			];
			const banned_titles = [
				'Main_Page',
			];
            for (let i = 0; i < banned_title_prefixes.length; i++) {
                if (articleTitle.startsWith(banned_title_prefixes[i])) {
                    return false;
                }
            }
            for (let i = 0; i < banned_titles.length; i++) {
                if (articleTitle === banned_titles[i]) {
                    return false;
                }
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
			logger('Test response:', response);
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

// https://github.com/wikimedia/language-data/blob/master/data/langdb.yaml
const wikipedia_lang_codes = [
	'aa', 'aae', 'ab', 'abe', 'abr', 'abs', 'ace', 'acf', 'ach', 'acm',
	'acq', 'ada', 'ady', 'ady-cyrl', 'ady-latn', 'aeb', 'aeb-arab',
	'aeb-latn', 'af', 'agq', 'agr', 'ahr', 'aig', 'aii', 'ajg', 'ajp',
	'ajp-arab', 'ajp-latn', 'akb', 'akz', 'ale', 'ale-cyrl', 'aln',
	'als', 'alt', 'am', 'ami', 'an', 'ang', 'ann', 'anp', 'apc',
	'apc-arab', 'apc-latn', 'apw', 'ar', 'arc', 'arn', 'aro', 'arq',
	'ars', 'ary', 'ary-arab', 'ary-latn', 'arz', 'as', 'ase', 'ast',
	'atj', 'atv', 'av', 'avk', 'awa', 'ay', 'ayh', 'az', 'az-arab',
	'az-cyrl', 'az-latn', 'azb', 'azj', 'ba', 'ban', 'ban-bali',
	'bar', 'bas', 'bat-smg', 'bax', 'bax-bamu', 'bbc', 'bbc-batk',
	'bbc-latn', 'bcc', 'bci', 'bcl', 'bdr', 'be', 'be-tarask',
	'be-x-old', 'bem', 'bew', 'bfa', 'bfq', 'bft', 'bfw', 'bg',
	'bgc', 'bgc-arab', 'bgn', 'bh', 'bho', 'bi', 'bin', 'bjn', 'bkm',
	'blc', 'blk', 'bm', 'bn', 'bnn', 'bo', 'bol', 'bom', 'bpy',
	'bqi', 'br', 'brh', 'brx', 'bs', 'btd', 'btm', 'bto', 'bts',
	'btx', 'btz', 'bug', 'bug-bugi', 'bug-latn', 'bum', 'bwr', 'bxr',
	'byn', 'byv', 'bzj', 'bzs', 'ca', 'cak', 'cbk', 'cbk-zam', 'ccp',
	'cdo', 'cdo-hani', 'cdo-hans', 'cdo-hant', 'cdo-latn', 'ce',
	'ceb', 'ch', 'chm', 'chn', 'cho', 'chr', 'chy', 'ciw', 'cja',
	'cja-arab', 'cja-cham', 'cja-latn', 'cjk', 'cjm', 'cjm-arab',
	'cjm-cham', 'cjm-latn', 'cjy', 'cjy-hans', 'cjy-hant', 'ckb',
	'cko', 'ckt', 'ckv', 'cnh', 'cnr', 'cnr-cyrl', 'cnr-latn', 'co',
	'cop', 'cps', 'cpx', 'cpx-hans', 'cpx-hant', 'cpx-latn', 'cr',
	'cr-cans', 'cr-latn', 'crg', 'crh', 'crh-cyrl', 'crh-latn',
	'crh-ro', 'cs', 'csb', 'cu', 'cv', 'cy', 'da', 'dag', 'dar',
	'ddn', 'de', 'de-at', 'de-ch', 'de-formal', 'dga', 'dik', 'din',
	'diq', 'dlg', 'doi', 'dru', 'dsb', 'dso', 'dtp', 'dty', 'dua',
	'dv', 'dyu', 'dz', 'ee', 'efi', 'egl', 'ekp', 'el', 'elm', 'eml',
	'en', 'en-ca', 'en-gb', 'en-simple', 'en-us', 'eo', 'es',
	'es-419', 'es-formal', 'es-ni', 'esu', 'et', 'eu', 'ext', 'eya',
	'fa', 'fan', 'fat', 'fax', 'ff', 'fi', 'fil', 'fit', 'fiu-vro',
	'fj', 'fkv', 'fo', 'fon', 'fr', 'frc', 'frp', 'frr', 'frs', 'fuf',
	'fuv', 'fvr', 'fy', 'ga', 'gaa', 'gag', 'gah', 'gan', 'gan-hans',
	'gan-hant', 'gaz', 'gbm', 'gbz', 'gcf', 'gcr', 'gd', 'gez',
	'gju-arab', 'gju-deva', 'gl', 'gld', 'glk', 'gn', 'gom',
	'gom-deva', 'gom-latn', 'gor', 'got', 'gpe', 'grc', 'gsw', 'gu',
	'guc', 'gum', 'gur', 'guw', 'gv', 'ha', 'ha-arab', 'ha-latn',
	'hai', 'hak', 'hak-hans', 'hak-hant', 'hak-latn', 'hav', 'haw',
	'he', 'hi', 'hif', 'hif-deva', 'hif-latn', 'hil', 'hke', 'hne',
	'hno', 'ho', 'hoc', 'hoc-latn', 'hr', 'hrx', 'hsb', 'hsn', 'ht',
	'hu', 'hu-formal', 'hy', 'hyw', 'hz', 'ia', 'iba', 'ibb', 'id',
	'ie', 'ig', 'igb', 'igl', 'ii', 'ik', 'ike-cans', 'ike-latn',
	'ilo', 'inh', 'io', 'is', 'ish', 'isv', 'isv-cyrl', 'isv-latn',
	'it', 'iu', 'izh', 'ja', 'jac', 'jam', 'jbo', 'jdt', 'jdt-cyrl',
	'jje', 'jut', 'jv', 'jv-java', 'ka', 'kaa', 'kab', 'kac', 'kai',
	'kaj', 'kam', 'kbd', 'kbd-cyrl', 'kbd-latn', 'kbp', 'kcg', 'kck',
	'kea', 'ken', 'kg', 'kge', 'kge-arab', 'kgg', 'kgp', 'khk', 'khw',
	'ki', 'kip', 'kiu', 'kj', 'kjh', 'kjp', 'kk', 'kk-arab', 'kk-cn',
	'kk-cyrl', 'kk-kz', 'kk-latn', 'kk-tr', 'kl', 'km', 'kmb', 'kmr',
	'kn', 'knc', 'knn', 'ko', 'ko-kp', 'koi', 'koy', 'kr', 'krc',
	'kri', 'krj', 'krl', 'ks', 'ks-arab', 'ks-deva', 'ksf', 'ksh',
	'ksw', 'ku', 'ku-arab', 'ku-latn', 'kum', 'kus', 'kv', 'kw', 'ky',
	'la', 'lad', 'lad-hebr', 'lad-latn', 'lag', 'laj', 'lb', 'lbe',
	'ldn', 'lez', 'lfn', 'lg', 'li', 'lij', 'lij-mc', 'liv', 'ljp',
	'lki', 'lkt', 'lld', 'lmo', 'ln', 'lo', 'lou', 'loz', 'lrc', 'lt',
	'ltg', 'lua', 'lud', 'lue', 'luo', 'lus', 'lut', 'luz', 'lv', 'lvs',
	'lzh', 'lzz', 'mad', 'mag', 'mai', 'mak', 'mak-bugi', 'map-bms',
	'maw', 'mcn', 'mdf', 'mdh', 'mey', 'mfa', 'mfe', 'mg', 'mh',
	'mhr', 'mi', 'mic', 'min', 'miq', 'mk', 'ml', 'mn', 'mn-cyrl',
	'mn-mong', 'mnc', 'mnc-latn', 'mnc-mong', 'mni', 'mni-beng',
	'mns', 'mnw', 'mo', 'moe', 'mos', 'mr', 'mrh', 'mrj', 'mrt',
	'mrv', 'ms', 'ms-arab', 'msi', 'mt', 'mui', 'mus', 'mvf', 'mwl',
	'mwv', 'mww', 'mww-latn', 'my', 'myv', 'mzn', 'na', 'nah', 'nan',
	'nan-hani', 'nan-hans', 'nan-hant', 'nan-latn', 'nan-latn-pehoeji',
	'nan-latn-tailo', 'nap', 'naq', 'nb', 'nd', 'nds', 'nds-nl', 'ne',
	'new', 'ng', 'nia', 'nit', 'niu', 'njo', 'nl', 'nl-informal',
	'nmz', 'nn', 'nn-hognorsk', 'no', 'nod', 'nod-thai', 'nog', 'nov',
	'npi', 'nqo', 'nr', 'nrf-gg', 'nrf-je', 'nrm', 'nso', 'nup', 'nus',
	'nv', 'ny', 'nyn', 'nyo', 'nys', 'nzi', 'oc', 'ojb', 'oka', 'olo',
	'om', 'ood', 'or', 'ory', 'os', 'osi', 'ota', 'ovd', 'pa', 'pa-arab',
	'pa-guru', 'pag', 'pam', 'pap', 'pap-aw', 'pbb', 'pbt', 'pcd',
	'pcm', 'pdc', 'pdt', 'pes', 'pey', 'pfl', 'phr', 'pi', 'pih', 'pis',
	'piu', 'pjt', 'pko', 'pl', 'plt', 'pms', 'pnb', 'pnt', 'pov', 'ppl',
	'prg', 'prs', 'ps', 'pt', 'pt-br', 'pwn', 'pzh', 'qu', 'quc', 'qug',
	'quy', 'qwh', 'qxp', 'rag', 'raj', 'rap', 'rcf', 'rej', 'rgn',
	'rhg', 'rif', 'rki', 'rm', 'rm-puter', 'rm-rumgr', 'rm-surmiran',
	'rm-sursilv', 'rm-sutsilv', 'rm-vallader', 'rmc', 'rmf', 'rml-cyrl',
	'rmy', 'rn', 'ro', 'roa-rup', 'roa-tara', 'rsk', 'rtm', 'ru', 'rue',
	'rup', 'ruq', 'ruq-cyrl', 'ruq-latn', 'rut', 'rw', 'rwr', 'ryu',
	'sa', 'sah', 'sas', 'sat', 'saz', 'sc', 'scn', 'sco', 'sd', 'sdc',
	'sdh', 'se', 'se-fi', 'se-no', 'se-se', 'sei', 'ses', 'sg', 'sgs',
	'sh', 'sh-cyrl', 'sh-latn', 'shi', 'shi-latn', 'shi-tfng', 'shn',
	'shy', 'shy-latn', 'si', 'simple', 'sjd', 'sje', 'sjo', 'sju', 'sk',
	'skr', 'skr-arab', 'sl', 'sli', 'slr', 'sly', 'sm', 'sma', 'smj',
	'smn', 'sms', 'sn', 'so', 'son', 'sq', 'sr', 'sr-cyrl', 'sr-ec',
	'sr-el', 'sr-latn', 'srn', 'sro', 'srq', 'ss', 'st', 'stq', 'sty',
	'su', 'sv', 'sw', 'swb', 'swh', 'sxu', 'syc', 'syl', 'syl-beng',
	'syl-sylo', 'szl', 'szy', 'ta', 'taq', 'taq-latn', 'taq-tfng',
	'tay', 'tcy', 'tdd', 'te', 'tet', 'tg', 'tg-cyrl', 'tg-latn',
	'th', 'thq', 'thr', 'ti', 'tig', 'tji', 'tk', 'tkr', 'tl', 'tly',
	'tly-cyrl', 'tmr', 'tn', 'to', 'toi', 'tok', 'tokipona', 'tpi',
	'tr', 'trp', 'tru', 'trv', 'trw', 'ts', 'tsd', 'tsg', 'tt',
	'tt-cyrl', 'tt-latn', 'ttj', 'tum', 'tw', 'twd', 'ty', 'tyv',
	'tzl', 'tzm', 'udm', 'ug', 'ug-arab', 'ug-cyrl', 'ug-latn', 'uk',
	'umb', 'umu', 'ur', 'uz', 'uz-cyrl', 'uz-latn', 'uzn', 'vai',
	've', 'vec', 'vep', 'vi', 'vls', 'vmf', 'vmw', 'vo', 'vot', 'vro',
	'wa', 'wal', 'war', 'wls', 'wlx', 'wo', 'wsg', 'wuu', 'wuu-hans',
	'wuu-hant', 'xal', 'xh', 'xmf', 'xmm', 'xon', 'xsy', 'ydd', 'yi',
	'yo', 'yoi', 'yrk', 'yrl', 'yua', 'yue', 'yue-hans', 'yue-hant',
	'za', 'zea', 'zgh', 'zgh-latn', 'zh', 'zh-cdo', 'zh-classical',
	'zh-cn', 'zh-hans', 'zh-hant', 'zh-hk', 'zh-min-nan', 'zh-mo',
	'zh-my', 'zh-sg', 'zh-tw', 'zh-yue', 'zmi', 'zsm', 'zu', 'zun'
 ];
