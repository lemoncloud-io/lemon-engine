/**
 * Lambda Proxy Service Exports
 * - proxy call to lambda service.
 *
 * 
 * 
 * author: Steve Jung <steve@lemoncloud.io>
 * date : 2018-06-22
 *
 * Copyright (C) 2018 LemonCloud Co Ltd. - All Rights Reserved.
 */
module.exports = (function (_$, name) {
	"use strict";
	name = name || 'LS';

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
	thiz.do_get     = do_get;
	thiz.do_post    = do_post;
	thiz.do_put     = do_put;
	thiz.do_delete  = do_delete;

	//! register service.
	_$(name, thiz);

	/** ****************************************************************************************************************
	 *  Internal Proxy Function
	 ** ****************************************************************************************************************/
	const ENDPOINT = $U.env('LS_ENDPOINT');
	const httpProxy = require('./http-proxy');
	const $proxy = function(){
		if (!ENDPOINT) throw new Error('env:LS_ENDPOINT is required!');
		const SVC = 'X'+name;
        const $SVC = _$(SVC);
		return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT);		// re-use proxy by name
	}

		
	/** ****************************************************************************************************************
	 *  Main Implementation.
	 ** ****************************************************************************************************************/
	/**
	 * GET HOST/PATH?$param
	 */
	function do_get(TYPE, ID, CMD, $param, $body, $ctx){
		if (!TYPE) return Promise.reject(new Error('TYPE is required'));
		if ($body) return Promise.reject(new Error(NS + ':$body is invalid!'));
		return $proxy().do_get(TYPE, ID, CMD, $param, $body, $ctx)
			.then(_ => _.result);
	}

	/**
	 * PUT HOST/PATH?$param
	 * 
	 */
	function do_put (TYPE, ID, CMD, $param, $body, $ctx) {
		if (!TYPE) return Promise.reject(new Error('TYPE is required'));
		return $proxy().do_put(TYPE, ID, CMD, $param, $body, $ctx)
			.then(_ => _.result);
	}

	/**
	 * POST HOST/PATH?$param
	 * 
	 */
	function do_post (TYPE, ID, CMD, $param, $body, $ctx) {
		if (!TYPE) return Promise.reject(new Error('TYPE is required'));
		return $proxy().do_post(TYPE, ID, CMD, $param, $body, $ctx)
			.then(_ => _.result);
	}

	/**
	 * DELETE HOST/PATH?$param
	 * 
	 */
	function do_delete (TYPE, ID, CMD, $param, $body, $ctx) {
		if (!TYPE) return Promise.reject(new Error('TYPE is required'));
		return $proxy().do_delete(TYPE, ID, CMD, $param, $body, $ctx)
			.then(_ => _.result);
	}

	//! returns.
	return thiz;
});

