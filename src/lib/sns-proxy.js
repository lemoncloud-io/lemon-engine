/**
 * SNS Proxy Service Exports
 * - proxy call to sns service.
 *
 * 
 * 
 * author: Steve Jung <steve@lemoncloud.io>
 * date : 2018-05-28
 *
 * Copyright (C) 2018 LemonCloud Co Ltd. - All Rights Reserved.
 */
module.exports = (function (_$, name) {
	"use strict";
	name = name || 'SN';

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
	thiz.do_publish = do_publish;

	//! test function.
	thiz.do_test_self   = do_test_self;

	//! register service.
	_$(name, thiz);

	/** ****************************************************************************************************************
	 *  Internal Proxy Function
	 ** ****************************************************************************************************************/
	const ENDPOINT = $U.env('SN_ENDPOINT');
	const httpProxy = require('./http-proxy');
	const $proxy = function(){
		if (!ENDPOINT) throw new Error('env:SN_ENDPOINT is required!');
		const SVC = 'X'+name;
        const $SVC = _$(SVC);
		return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT);		// re-use proxy by name
	}

		
	/** ****************************************************************************************************************
	 *  Main Implementation.
	 ** ****************************************************************************************************************/
	function do_publish (snsId, subject, payload) {
		if (!snsId) return Promise.reject('snsId is required!');
		if (!subject) return Promise.reject('subject is required!');
		if (!payload) return Promise.reject('payload is required!');

		const options = null;	// optional values.
		const $param = Object.assign({}, options||{});
        $param.subject = subject;
        
		return $proxy().do_post(snsId, '0', undefined, $param, payload)
			.then(_ => _.result);
	}
	
	function do_test_self (options){
		options = options||{};
		_log(NS, 'do_test_self()... param=', options);

		const $param = Object.assign({}, options||{});
		
		return $proxy().do_get('#', '0', 'test-self', $param)
			.then(_ => _.result);
	}

	//! returns.
	return thiz;
});

