/**
 * Protocol Proxy Service Exports
 * - proxy call to lemon-protocol-api service.
 *
 * 
 * @see lemon-protocol-api/api/protocol-api.js
 * 
 * author: Tony Sung <tony@lemoncloud.io>
 * date : 2018-07-03
 *
 * Copyright (C) 2018 LemonCloud Co Ltd. - All Rights Reserved.
 */
module.exports = (function (_$, name) {
	"use strict";
	name = name || 'PR';

	const $U = _$.U;                                // re-use global instance (utils).
	const $_ = _$._;                             	// re-use global instance (_ lodash).

	if (!$U) throw new Error('$U is required!');
	if (!$_) throw new Error('$_ is required!');

	const NS = $U.NS(name, 'yellow');				// NAMESPACE TO BE PRINTED.
	const queryString = require('query-string');
	const URL = require('url');

	//! load common functions
	const _log = _$.log;
	const _inf = _$.inf;
	const _err = _$.err;

	//! prepare instance.
	const thiz = {};

	//! item functions.
    thiz.do_execute       		= do_execute_protocol;
	thiz.do_post_execute  		= do_post_execute_protocol;
	thiz.do_notify        		= do_notify_protocol;
	thiz.do_post_notify   		= do_post_notify_protocol;
    
	//! register service.
	_$(name, thiz);

	/** ****************************************************************************************************************
	 *  Internal Proxy Function
	 ** ****************************************************************************************************************/
    const PROXY = {type:''};
	const $proxy = function(){
		const NAME = 'X'+name;           // service name.
        const $SVC = _$(NAME);
        if ($SVC) return $SVC;

        //! make instance.
        const httpProxy = _$.httpProxy;
        if (!httpProxy) throw new Error('httpProxy is required!');
        const ENDPOINT = $U.env('PROTOCOL_PROXY_API');
        if (!ENDPOINT) throw new Error('env:PROTOCOL_PROXY_API is required!');

        const aa = ENDPOINT.split('/');     // split 'http://localhost:8092/protocol'
        PROXY.type = aa.pop();
        PROXY.host = aa.join('/');
        _log(NS, 'proxy:'+name+' config. host=', PROXY.host,', type=', PROXY.type);
        return httpProxy(_$, NAME, PROXY.host);		// re-use proxy by name
    }

	/**
	 * Prepare URL string.
	 */
	const chain_prepare_url = (url, body, callback)=>{
		if (!url) return Promise.reject(new Error('url is required!'));
		const url_str = url && typeof url === 'object' ? build_url(url) : url;
		const that = {url: url_str};
		if (body !== undefined) that.body = body;						// data body to post.
		if (callback !== undefined) that.callback = callback;			// callback url (ONLY for SNS)
		return Promise.resolve(that)
	}

	/**
	 * Validate URL.
	 * 
	 * @param url (string/object)
	 */
	const chain_validate_url = (that)=>{
		//! parse URL string if required!.
		const $url = ((url)=>{
			if (typeof url == 'object') return url;
			else if (typeof url == 'string') return URL.parse(url, false);
			else throw new Error('Unknown data-type of url. type:'+(typeof url));
		})(that.url||'');
		// parse url
		const protocol = $url.protocol || '';
		const service = $url.hostname || '';

		//1-1. FALSE: protocol is not lemon:
		if(protocol != 'lemon:') return Promise.reject(new Error('protocol should be lemon:. but '+protocol));

		//1-2. FALSE: service not exist
		if(!service) return Promise.reject(new Error('.service is required!'));

		//! returns.
		return that;
	}

	/** ****************************************************************************************************************
	 *  Main Implementation.
	 ** ****************************************************************************************************************/
    /**
     * Synchronized Call to URL.
     * - 동기화 실행으로, 내부적으로 Http/Lambda 호출로 Promise() 된 실행 결과를 얻을 수 있음.
     * 
     * example:
     * - do_execute('lemon://imweb-pools/goods/0/next-id') => GET 'lemon-imweb-pools-api/goods/0/next-id'
     * - do_execute('lemon://imweb-pools/goods/0/next-id#') => POST 'lemon-imweb-pools-api/goods/0/next-id'
     * 
     * @param {string|object} url 
     */
    function do_execute_protocol(url){
        _log(NS, `do_execute_protocol()....`);
        if (!url) return Promise.reject(new Error('url is required!'));
        // // validate url
		// if (!chain_validate_url(url)) return Promise.reject(url);
		// // force url to be 'string' type before sending it
        // const url_str = typeof url === 'object' ? build_url(url) : url;
        // http-proxy.do_get (TYPE, ID, CMD, $param, $body)
		// return $proxy().do_get(PROXY.type, '!', 'execute', {url:url_str});
		return chain_prepare_url(url)
		.then(chain_validate_url)
		.then(_ => {
			const url = _.url||'';
			return $proxy().do_get(PROXY.type, '!', 'execute', {url});
		})
    }

	/**
     * Synchronized Call to URL for post
     * - 동기화 실행으로, 내부적으로 Http/Lambda 호출로 Promise() 된 실행 결과를 얻을 수 있음.
     * 
     * @param {string|object} url 
     * @param {string|object} body 
     * @returns {Promised}
     */
    function do_post_execute_protocol(url, body){
        _log(NS, `do_post_execute_protocol()....`);
        if (!url) return Promise.reject(new Error('url is required!'));

        // // validate url
		// if (!chain_validate_url(url)) return Promise.reject(url);
		// // force url to be 'string' type before sending it
        // const url_str = typeof url === 'object' ? build_url(url) : url;
        // // http-proxy.do_get (TYPE, ID, CMD, $param, $body)
		// return $proxy().do_post(PROXY.type, '!', 'execute', {url:url_str}, body);
		return chain_prepare_url(url, body)
		.then(chain_validate_url)
		.then(_ => {
			const url = _.url||'';
			const body = _._body||'';
			return $proxy().do_post(PROXY.type, '!', 'execute', {url}, body);
		})
	}
	
    /**
     * Asynchronized Call to URL.
     * - 비동기식 실행으로, 내부적으로 SNS를 활용하기도 한다.
     * 
     * @param {string|object} url 
     * @returns {Promised}
     */
    function do_notify_protocol(url){
        _log(NS, `do_notify_protocol()....`);
        if (!url) return Promise.reject(new Error('url is required!'));
		
		// // validate url
		// if (!chain_validate_url(url)) return Promise.reject(url);
		// // force url to be 'string' type before sending it
		// const url_str = typeof url === 'object' ? build_url(url) : url;
        // // http-proxy.do_get (TYPE, ID, CMD, $param, $body)
		// return $proxy().do_get(PROXY.type, '!', 'notify', {url:url_str});
		return chain_prepare_url(url, body)
		.then(chain_validate_url)
		.then(_ => {
			const url = _.url||'';
			return $proxy().do_get(PROXY.type, '!', 'notify', {url});
		})
	}
	
	/**
     * Asynchronized Call to URL for post
     * - 비동기식 실행으로, 내부적으로 SNS를 활용하기도 한다.
     * 
     * @param {string|object} url 
     * @param {string|object} body 
     * @param {string|object} callback		SNS Notification 실행후, 결과 처리를 받기 위해서 추가됨 @181125
     * @returns {Promised}
     */
    function do_post_notify_protocol(url, body, callback){
        _log(NS, `do_post_notify_protocol()....`);
        if (!url) return Promise.reject(new Error('url is required!'));
		
		// // validate url
		// if (!chain_validate_url(url)) return Promise.reject(url);
		// // force url to be 'string' type before sending it
		// const url_str = typeof url === 'object' ? build_url(url) : url;
        // // http-proxy.do_post (TYPE, ID, CMD, $param, $body)
		// return $proxy().do_post(PROXY.type, '!', 'notify', {url:url_str}, body);
		return chain_prepare_url(url, body, callback)
		.then(chain_validate_url)
		.then(_ => {
			const url = _.url||'';
			const body = _.body||'';
			const callback = _.callback||'';
			return $proxy().do_post(PROXY.type, '!', 'notify', {url}, body);				//! original code.
			// ! 기존의 호환성 유지를 위해서, 변경된 규칙은 body에 {url, body, callback} 구조체로 보낸다.
			// return $proxy().do_post(PROXY.type, '!', 'notify', '', _);					//! support callback @181125.
		})
    }

	/**
	 * 프로토콜 형식 다음과 같음.
	 * `lemon://<sid?>@<service-name>/<type>/<id?>/<cmd?>?<param>#<body>`
	 * 
	 * sid           : site/session-id 로 서비스를 실행할 계정
	 * service-name  : 실행할 서비스의 이름 (예: `messages` => `lemon-messages-api`)
	 * type          : 서비스내 API의 이름 (예: `user`)
	 * id            : 선택) 서비스 API의 ID 값.
	 * cmd           : 선택) 서비스 API의 CMD 값.
	 * param         : QueryString 형태의 전달 파라미터.
	 * body          : QueryString (또는 json 형식) 형태의 body 파라미터. (json 일때는 '{[,]}'으로 감쌈) 
	 */
	function build_url($url){
		$url = $url||{};
		const PROTOCOL  = "lemon://";
		const sid 		= $url.sid || $url.SID;
        const service 	= $url.service || $url.SERVICE;
		const type 		= $url.type || $url.TYPE;
		const id 		= $url.id || $url.ID;
		const cmd 		= $url.cmd || $url.CMD;
		const $param 	= $url.param || $url.$param || $url.PARAM;
		const param 	= typeof $param === 'object'? queryString.stringify($param) : $param;
		const $body 	= $url.body || $url.$body || $url.BODY;
		const body 		= typeof $body === 'object'? queryString.stringify($body) : $body;

		//! as URL string.
		const url = PROTOCOL									// Madatory => lemon://
				+ (sid   ? encodeURIComponent(sid) +'@' :'') 	// Optional => sid@
				+ service 										// Madatory => service
				+ (type  ? "/"+encodeURIComponent(type) :'/')	// Partial Madatory => /type
				+ (id    ? "/"+encodeURIComponent(id) :'') 		// Optional	=> /id
				+ (cmd   ? "/"+encodeURIComponent(cmd) :'') 	// Optional => /cmd
				+ (param  ?"?"+param:'') 						// Optional => ?param
				+ (body  ? "#"+body:'');						// Optional => #body

		return url;
	}

	//! returns.
	return thiz;
});

