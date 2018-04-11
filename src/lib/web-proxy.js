/**
 * WEB Proxy Service Exports
 * - proxy call to web service.
 *
 * 
 * 
 * author: Steve Jung <steve@lemoncloud.io>
 * date : 2018-04-11
 *
 * Copyright (C) 2018 LemonCloud Co Ltd. - All Rights Reserved.
 */
module.exports = (function (_$, name) {
	"use strict";
	name = name || 'WS';

	const $U = _$.U;                                // re-use global instance (utils).
	const $_ = _$._;                             	// re-use global instance (_ lodash).

	if (!$U) throw new Error('$U is required!');
	if (!$_) throw new Error('$_ is required!');

	const NS = $U.NS(name, 'yellow');				// NAMESPACE TO BE PRINTED.

	//! load common functions
	const _log = _$.log;
	const _inf = _$.inf;
	const _err = _$.err;

	//! prepare instance.
	const thiz = {};

	//! item functions.
	thiz.do_get = do_get;
	thiz.do_post = do_post;
	thiz.do_put = do_put;
	thiz.do_delete = do_delete;

	//! register service.
	_$(name, thiz);

	/** ****************************************************************************************************************
	 *  Internal Proxy Function
	 ** ****************************************************************************************************************/
	const ENDPOINT = $U.env('WS_ENDPOINT');
	const httpProxy = require('./http-proxy');
	const $proxy = function(){
		if (!ENDPOINT) throw new Error('env:WS_ENDPOINT is required!');
		const SVC = 'X'+name;
		return _$[SVC] || httpProxy(_$, SVC, ENDPOINT);		// re-use proxy by name
	}

		
	/** ****************************************************************************************************************
	 *  Main Implementation.
	 ** ****************************************************************************************************************/
	function do_receiveMessage (TYPE, size) {
		size = $U.N(size, 1);
		if (!TYPE) return Promise.reject('TYPE is required!');
		if (!size) return Promise.reject('size is required!');

		const options = null;	// optional values.
		const $param = Object.assign({}, options||{});
		$param.size = size;

		return $proxy().do_get(TYPE, '0', undefined, $param)
			.then(_ => _.result);
	}

	/**
	 * GET HOST/PATH?$param
	 * 
	 * 
	 * @param host 	hostname like (127.0.0.1, https://127.0.0.1, 127.0.0.1:8080)
	 * @param path	full path
	 * @param $opt	optional settings
	 * @param $param query parameter (if string, then direct use w/o encoding)
	 * @param $body	body payload (if string, then use as payload)
	 */
	function do_get (host, path, $opt, $param, $body) {
		if ($body) return Promise.reject(new Error(NS + ':$body is invalid!'));
		if (host === undefined) return Promise.reject(new Error(NS + ':host is required!'));
		// if (path === undefined) return Promise.reject(new Error(NS + ':path is required!'));
		// if ($opt === undefined) return Promise.reject(new Error(NS + ':$opt is required!'));

		return $proxy().do_get(host, path, undefined, $param, $body)
			.then(_ => _.result);
	}

	/**
	 * PUT HOST/PATH?$param
	 * 
	 */
	function do_put (host, path, $opt, $param, $body) {
		if (host === undefined) return Promise.reject(new Error(NS + ':host is required!'));
		// if (path === undefined) return Promise.reject(new Error(NS + ':path is required!'));
		// if ($opt === undefined) return Promise.reject(new Error(NS + ':$opt is required!'));

		return $proxy().do_put(host, path, undefined, $param, $body)
			.then(_ => _.result);
	}

	/**
	 * POST HOST/PATH?$param
	 * 
	 */
	function do_post (host, path, $opt, $param, $body) {
		if (host === undefined) return Promise.reject(new Error(NS + ':host is required!'));
		// if (path === undefined) return Promise.reject(new Error(NS + ':path is required!'));
		// if ($opt === undefined) return Promise.reject(new Error(NS + ':$opt is required!'));

		return $proxy().do_post(host, path, undefined, $param, $body)
			.then(_ => _.result);
	}

	/**
	 * DELETE HOST/PATH?$param
	 * 
	 */
	function do_delete (host, path, $opt, $param, $body) {
		if (host === undefined) return Promise.reject(new Error(NS + ':host is required!'));
		// if (path === undefined) return Promise.reject(new Error(NS + ':path is required!'));
		// if ($opt === undefined) return Promise.reject(new Error(NS + ':$opt is required!'));

		return $proxy().do_delete(host, path, undefined, $param, $body)
			.then(_ => _.result);
	}

	//! returns.
	return thiz;
});

