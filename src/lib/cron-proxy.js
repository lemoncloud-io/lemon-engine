/**
 * CRON Proxy Service Exports
 * - proxy call to cron(CloudWatch Rule) service.
 *
 * 
 * 
 * @author Steve Jung <steve@lemoncloud.io)
 * @date 2018-11-28
 *
 * Copyright (C) 2018 LemonCloud Co Ltd. - All Rights Reserved.
 */
module.exports = (function (_$, name) {
	"use strict";
	name = name || 'CR';

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
	thiz.do_list_rules              = do_list_rules;
	thiz.do_describe_rule           = do_describe_rule;
	thiz.do_enable_rule             = do_enable_rule;
	thiz.do_save_rule               = do_save_rule;

	//! register service.
	_$(name, thiz);

	/** ****************************************************************************************************************
	 *  Internal Proxy Function
	 ** ****************************************************************************************************************/
	const ENDPOINT = $U.env('CR_ENDPOINT');
	const httpProxy = require('./http-proxy');
	const $proxy = function(){
		if (!ENDPOINT) throw new Error('env:CR_ENDPOINT is required!');
		const SVC = 'X'+name;
        const $SVC = _$(SVC);
		return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT);		// re-use proxy by name
	}
		
	/** ****************************************************************************************************************
	 *  Main Implementation.
	 ** ****************************************************************************************************************/
	/**
	 * List Rules
	 */
	function do_list_rules(limit, prefix, token){
		return $proxy().do_get('rules', '', '', {limit, prefix, token}, undefined)
		// .then(_ => _.result);                //WARN! - cron-api 에서 전달을 .resuld에 안함.
	}
	/**
	 * Details of rule
	 */
	function do_describe_rule(name){
		return $proxy().do_get('rules', name, undefined, undefined, undefined)
		// .then(_ => _.result);                //WARN! - cron-api 에서 전달을 .resuld에 안함.
    }
    /**
     * enable/disable rule.
     */
	function do_enable_rule(name, enabled){
		return $proxy().do_get('rules', name, enabled ? 'enable' : 'disable', undefined, undefined)
		// .then(_ => _.result);                //WARN! - cron-api 에서 전달을 .resuld에 안함.
    }
    /**
     * save(or update) rule.
     */
	function do_save_rule(name, node){
		return $proxy().do_post('rules', name, '', undefined, node)
		// .then(_ => _.result);                //WARN! - cron-api 에서 전달을 .resuld에 안함.
    }

	//! returns.
	return thiz;
});

