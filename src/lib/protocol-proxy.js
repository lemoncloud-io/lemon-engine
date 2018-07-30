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
    thiz.do_execute       = do_execute_protocol;
	thiz.do_post_execute  = do_post_execute_protocol;
    thiz.do_notify        = do_notify_protocol;
    
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
     * @param {*} url 
     * @returns {*} Result.
     */
    function do_execute_protocol(url){
        _log(NS, `do_execute_protocol()....`);
        if (!url) return Promise.reject('url is required!');

        // validate url
		if (!validate_url(url)) return Promise.reject(url);

		// force url to be 'string' type before sending it
        const url_str = typeof url === 'object' ? build_url(url) : url;
        
        // http-proxy.do_get (TYPE, ID, CMD, $param, $body)
		return $proxy().do_get(PROXY.type, '!', 'execute', {url:url_str});
    }

	/**
     * Synchronized Call to URL for post
     * - 동기화 실행으로, 내부적으로 Http/Lambda 호출로 Promise() 된 실행 결과를 얻을 수 있음.
     * 
     * @param {*} url 
     * @returns {*} Result.
     */
    function do_post_execute_protocol(url,data){
        _log(NS, `do_post_execute_protocol()....`);
        if (!url) return Promise.reject('url is required!');

        // validate url
		if (!validate_url(url)) return Promise.reject(url);

		// force url to be 'string' type before sending it
        const url_str = typeof url === 'object' ? build_url(url) : url;
        
        // http-proxy.do_get (TYPE, ID, CMD, $param, $body)
		return $proxy().do_post(PROXY.type, '!', 'execute', {url:url_str},data);
	}
	
    /**
     * Asynchronized Call to URL.
     * - 비동기식 실행으로, 내부적으로 SNS를 활용하기도 한다.
     * 
     * @param {*} url 
     * @returns {*} MessageID.
     */
    function do_notify_protocol(url){
        _log(NS, `do_notify_protocol()....`);
		if (!url) return Promise.reject('url is required!');
		
		// validate url
		if (!validate_url(url)) return Promise.reject(url);

		// force url to be 'string' type before sending it
		const url_str = typeof url === 'object' ? build_url(url) : url;

        // http-proxy.do_get (TYPE, ID, CMD, $param, $body)
		return $proxy().do_get(PROXY.type, '!', 'notify', {url:url_str});
    }

	function validate_url(url){
		// _log(NS,"url:",url);
		const url_type = typeof url;
		
		//1. string
		if(url_type === 'string'){
			// parse url
			const $url = URL.parse(url, false);
			const protocol = $url.protocol || '';
			const service = $url.hostname || '';

			//1-1. FALSE: protocol is not lemon:
			if(protocol != 'lemon:') return false;
			//1-2. FALSE: service not exist
			if(!service) return false;
		}
		//2. object
		else if (url_type === 'object'){
			//2-1. FALSE: protocol not "lemon:"
			if(url.protocol != 'lemon:') return false;

			//2-2. FALSE: service not exist
			if(!url.service) return false;
		}
		//3. FALSE: url type is neither string nor object
		else return false;

		return true;
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
	function build_url(url_obj){
		const protocol = "lemon://";
		const sid = url_obj.sid || url_obj.SID;
        const service = url_obj.service || url_obj.SERVICE;
		const type = url_obj.type || url_obj.TYPE;
		const id = url_obj.id || url_obj.ID;
		const cmd = url_obj.cmd || url_obj.CMD;
		const $param = url_obj.param || url_obj.$param || url_obj.PARAM;
		const param = typeof $param === 'object'? queryString.stringify($param) : $param;
		const $body = url_obj.body || url_obj.$body || url_obj.BODY;
		const body = typeof $body === 'object'? queryString.stringify($body) : $body;
		
		const url = protocol			// Madatory => lemon://
				+ (sid?sid +'@':'') 	// Optional => sid@
				+ service 				// Madatory => service
				+ (type? "/"+type :'/')	// Partial Madatory => /type
				+ (id? "/"+id :'') 		// Optional	=> /id
				+ (cmd? "/"+cmd :'') 	// Optional => /cmd
				+ (param?"?"+param:'') 	// Optional => ?param
				+ (body?"#"+body:'');	// Optional => #body

		return url;
	}

	//! returns.
	return thiz;
});

