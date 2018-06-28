/**
 * SES Proxy Service Exports
 * - proxy call to ses service.
 *
 * 
 * 
 * author: Steve Jung <steve@lemoncloud.io>
 * date : 2018-06-28
 *
 * Copyright (C) 2018 LemonCloud Co Ltd. - All Rights Reserved.
 */
module.exports = (function (_$, name) {
	"use strict";
	name = name || 'SE';

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
	thiz.do_send_email = do_send_email;

	//! register service.
	_$(name, thiz);

	/** ****************************************************************************************************************
	 *  Internal Proxy Function
	 ** ****************************************************************************************************************/
	const ENDPOINT = $U.env('SE_ENDPOINT');
	const httpProxy = require('./http-proxy');
	const $proxy = function(){
		if (!ENDPOINT) throw new Error('env:SE_ENDPOINT is required!');
		const SVC = 'X'+name;
        const $SVC = _$(SVC);
		return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT);		// re-use proxy by name
	}

		
	/** ****************************************************************************************************************
	 *  Main Implementation.
	 ** ****************************************************************************************************************/
	function do_send_email (payload) {
        const TYPE = 'email';
        if (!payload) return Promise.reject('payload is required!');
		if (typeof payload != 'object') return Promise.reject('payload:object is required!');

		return $proxy().do_post(TYPE, '0', 'send', undefined, payload)
		.then(_ => _.result);
	}
	
	//! returns.
	return thiz;
});

