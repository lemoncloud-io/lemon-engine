/**
 * SQS Proxy Service Exports
 * - proxy call to sqs service.
 *
 * 
 * 
 * author: Steve Jung <steve@lemoncloud.io>
 * date : 2018-04-08
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
	thiz.do_sendMessage = do_sendMessage;
	thiz.do_receiveMessage = do_receiveMessage;
	thiz.do_deleteMessage = do_deleteMessage;

	//! test function.
	thiz.do_test_self   = do_test_self;

	//! register service.
	_$(name, thiz);

	/** ****************************************************************************************************************
	 *  Internal Proxy Function
	 ** ****************************************************************************************************************/
	const ENDPOINT = $U.env('SS_ENDPOINT');
	const httpProxy = require('./http-proxy');
	const $proxy = function(){
		if (!ENDPOINT) throw new Error('env:SS_ENDPOINT is required!');
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

	function do_sendMessage (TYPE, $attr, $data) {
		if (!TYPE) return Promise.reject('TYPE is required!');
		if (!$attr) return Promise.reject('$attrs is required!');
		if (!$data) return Promise.reject('$data is required!');

		const $param = Object.assign({}, $attr||{});

		return $proxy().do_put(TYPE, '0', undefined, $param, $data)
			.then(_ => _.result);
	}

	function do_deleteMessage (TYPE, handle) {
		if (!TYPE) return Promise.reject('TYPE is required!');
		if (!handle) return Promise.reject('handle is required!');

		const options = null;	// optional values.
		const $param = Object.assign({}, options||{});

		return $proxy().do_delete(TYPE, handle, undefined)
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

