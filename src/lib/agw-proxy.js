/**
 * AGW(API Gateway) Proxy Service Exports
 * - proxy call to api gateway service.
 *
 * 
 * 
 * @author Steve Jung <steve@lemoncloud.io>
 * @date   2019-05-09
 *
 * Copyright (C) 2019 LemonCloud Co Ltd. - All Rights Reserved.
 */
module.exports = (function (_$, name) {
	"use strict";
	name = name || 'AG';

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
	thiz.postToConnection = postToConnection;

	//! register service.
	_$(name, thiz);

	/** ****************************************************************************************************************
	 *  Internal Proxy Function
	 ** ****************************************************************************************************************/
	const ENDPOINT = $U.env('AG_ENDPOINT');
	const httpProxy = require('./http-proxy');
	const $proxy = function(){
		if (!ENDPOINT) throw new Error('env:AG_ENDPOINT is required!');
		const SVC = 'X'+name;
        const $SVC = _$(SVC);
		return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT);		// re-use proxy by name
	}

	/** ****************************************************************************************************************
	 *  Main Implementation.
	 ** ****************************************************************************************************************/
	function postToConnection (endpoint, connectionId, payload) {
		if (!endpoint) return Promise.reject(new Error('endpoint(url) is required!'));
		if (!connectionId) return Promise.reject(new Error('connectionId is required!'));
		if (!payload) return Promise.reject(new Error('payload is required!'));

		const options = null;	// optional values.
		const $param = Object.assign({}, options||{});
        $param.endpoint = endpoint;
        $param.connectionId = connectionId;
        
		return $proxy().do_post('execute-api', '0', undefined, $param, payload)
		.then(_ => _.result);
	}
	
	//! returns.
	return thiz;
});

