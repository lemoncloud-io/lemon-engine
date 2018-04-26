/**
 * Redis Proxy Service Exports
 * - proxy call to redis service.
 *
 * 
 * 
 * author: Steve Jung <steve@lemoncloud.io>
 * date : 2018-04-03
 *
 * Copyright (C) 2018 LemonCloud Co Ltd. - All Rights Reserved.
 */
module.exports = (function (_$, name) {
	"use strict";
	name = name || 'RS';

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
	thiz.do_create_item = do_create_item;
	thiz.do_get_item    = do_get_item;
	thiz.do_delete_item = do_delete_item;
	thiz.do_update_item = do_update_item;

	//! test function.
	thiz.do_test_self   = do_test_self;

	//! register service.
	_$(name, thiz);

	/** ****************************************************************************************************************
	 *  Internal Proxy Function
	 ** ****************************************************************************************************************/
	const ENDPOINT = $U.env('RS_ENDPOINT');
	const httpProxy = require('./http-proxy');
	const $proxy = function(){
		if (!ENDPOINT) throw new Error('env:RS_ENDPOINT is required!');
        const SVC = 'X'+name;
        const $SVC = _$(SVC);
		return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT);		// re-use proxy by name
	}

		
	/** ****************************************************************************************************************
	 *  Main Implementation.
	 ** ****************************************************************************************************************/
	function do_create_item (PKEY, id, item, timeout) {
		if (!PKEY) return Promise.reject(new Error(NS + 'PKEY is required!'));
		if (!id) return Promise.reject(new Error(NS + 'id is required!'));
		if (!item) return Promise.reject(new Error(NS + 'item is required!'));

		if (Array.isArray(PKEY))
			PKEY = PKEY.join('+');
		
		const options = null;	// optional values.
		const $param = Object.assign({}, options||{});
		$param.timeout = timeout;

		return $proxy().do_post(PKEY, id, undefined, $param, item)
			.then(_ => _.result);
	}

	function do_get_item (PKEY, id) {
		if (!PKEY) return Promise.reject(new Error(NS + 'PKEY is required!'));
		if (!id) return Promise.reject(new Error(NS + 'id is required!'));

		if (Array.isArray(PKEY))
			PKEY = PKEY.join('+');
		
		const options = null;	// optional values.
		const $param = Object.assign({}, options||{});

		return $proxy().do_get(PKEY, id)
			.then(_ => _.result);
	}

	function do_update_item (PKEY, id, item) {
		if (!PKEY) return Promise.reject(new Error(NS + 'PKEY is required!'));
		if (!id) return Promise.reject(new Error(NS + 'id is required!'));
		if (!item) return Promise.reject(new Error(NS + 'item is required!'));

		if (Array.isArray(PKEY))
			PKEY = PKEY.join('+');
		
		const options = null;	// optional values.
		const $param = Object.assign({}, options||{});

		return $proxy().do_put(PKEY, id, undefined, $param, item)
			.then(_ => _.result);
	}

	function do_delete_item (PKEY, id) {
		if (!PKEY) return Promise.reject(new Error(NS + 'PKEY is required!'));
		if (!id) return Promise.reject(new Error(NS + 'id is required!'));

		if (Array.isArray(PKEY))
			PKEY = PKEY.join('+');
		
		const options = null;	// optional values.
		const $param = Object.assign({}, options||{});

		return $proxy().do_delete(PKEY, id, undefined, $param)
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

