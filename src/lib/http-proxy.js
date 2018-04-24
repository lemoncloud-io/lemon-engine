/**
 * Http Proxy Service Exports
 * - proxy call to http based service.
 *
 * 
 * 
 * author: Steve Jung <steve@lemoncloud.io>
 * date : 2018-04-03
 *
 * Copyright (C) 2018 LemonCloud Co Ltd. - All Rights Reserved.
 */
module.exports = (function (_$, name, endpoint) {
	"use strict";
	name = name || 'HS';

	const $U = _$.U;                                // re-use global instance (utils).
	const $_ = _$._;                             	// re-use global instance (_ lodash).

	if (!$U) throw new Error('$U is required!');
	if (!$_) throw new Error('$_ is required!');

	const NS = $U.NS(name, 'magenta');					// NAMESPACE TO BE PRINTED.
	const ENDPOINT = endpoint;
	const REQUEST = require('request');
	const queryString = require('query-string');

	if (!ENDPOINT) throw new Error('endpoint is required!');
	if (!REQUEST) throw new Error('request is required!');

	//! prepare instance.
	const thiz = {endpoint};

	//! load common functions
	const _log = _$.log;
	const _inf = _$.inf;
	const _err = _$.err;

	//! item functions.
	thiz.do_get    		= do_get;
	thiz.do_put 		= do_put;
	thiz.do_post 		= do_post;
	thiz.do_delete 		= do_delete;

	//! register service.
	_$(name, thiz);

	/** ****************************************************************************************************************
	 *  Main Implementation.
	 ** ****************************************************************************************************************/
	//! request in local server.
	const my_request_http = (METHOD, TYPE, ID, CMD, $param, $body) => {
		if (!METHOD) return Promise.reject(new Error(NS + ':METHOD is required!'));
		//! prepare request parameters
		const query_string = $param ? queryString.stringify($param) : '';
		const url = ENDPOINT
				+ (TYPE === undefined ? '' : '/' + encodeURIComponent(TYPE))
				+ (ID === undefined ? '' : '/' + encodeURIComponent(ID))
				+ (CMD === undefined ? '' : '/' + encodeURIComponent(CMD))
				+ (!query_string ? '' : '?' + query_string)
				;
		const request = REQUEST;
		const options = {
			method: METHOD||'GET',
			uri: url,
			body: $body,
			json: true
		}
		// _log(NS, ' url :=', options.method, url);
		_log(NS, '*', options.method, url);

		//! returns promise
		return new Promise((resolve, reject) => {
			request(options, function(error, response, body){
				error && _err(NS,'>>>>> requested! err=', error);
				if (error) return reject(error);
				//! detecte trouble.
				const statusCode = response.statusCode;
				const statusMessage = response.statusMessage;
				if (statusCode !== 200){
					_log(NS,'> code='+statusCode+', msg='+statusMessage+', body=', body);
					// if (statusCode === 400 || statusCode === 404)
					// 	return reject(new Error(body||statusMessage));
					// else
					// 	return reject(new Error(body||statusMessage));
					body = body||statusMessage;
					return reject(typeof body === 'string' ? new Error(body) : body);
				}
				
				//! ok! successed.
				resolve(body);
			})
		});
	};
	 
	/**
	 * GET /:type/:id/:cmd?$param
	 */
	function do_get (TYPE, ID, CMD, $param, $body) {
		if ($body) return Promise.reject(new Error(NS + ':$body is invalid!'));
		if (TYPE === undefined) return Promise.reject(new Error(NS + ':TYPE is required!'));
		// if (ID === undefined) return Promise.reject(new Error(NS + ':ID is required!'));
		// if (CMD === undefined) return Promise.reject(new Error(NS + ':CMD is required!'));
		return my_request_http('GET', TYPE, ID, CMD, $param, $body);
	}
	/**
	 * PUT /:type/:id/:cmd?$param
	 */
	function do_put (TYPE, ID, CMD, $param, $body) {
		if (TYPE === undefined) return Promise.reject(new Error(NS + ':TYPE is required!'));
		if (ID === undefined) return Promise.reject(new Error(NS + ':ID is required!'));
		// if (CMD === undefined) return Promise.reject(new Error(NS + ':CMD is required!'));
		return my_request_http('PUT', TYPE, ID, CMD, $param, $body);
	}
	/**
	 * POST /:type/:id/:cmd?$param
	 */
	function do_post (TYPE, ID, CMD, $param, $body) {
		if (TYPE === undefined) return Promise.reject(new Error(NS + ':TYPE is required!'));
		if (ID === undefined) return Promise.reject(new Error(NS + ':ID is required!'));
		// if (CMD === undefined) return Promise.reject(new Error(NS + ':CMD is required!'));
		return my_request_http('POST', TYPE, ID, CMD, $param, $body);
	}
	/**
	 * DELETE /:type/:id/:cmd?$param
	 */
	function do_delete (TYPE, ID, CMD, $param, $body) {
		if (TYPE === undefined) return Promise.reject(new Error(NS + ':TYPE is required!'));
		if (ID === undefined) return Promise.reject(new Error(NS + ':ID is required!'));
		// if (CMD === undefined) return Promise.reject(new Error(NS + ':CMD is required!'));
		return my_request_http('DELETE', TYPE, ID, CMD, $param, $body);
	}

	//! returns.
	return thiz;
});

