'use strict';
/** ********************************************************************************************************************
 *  boot loading for global instance manager
 ** *******************************************************************************************************************/
/**
 * main creation function of lemon instance pool (LIP)
 *
 *  
 * options : {
 * 	name : string 		- name of module.
 * 	env : object		- environment settings.
 * }
 * 
 * @param $root		main scope.
 * @param options	configuration.
 */
module.exports = (function ($root, options) {
	"use strict";
	function _$$() {};             // global container.(dummy instance pointer)

	$root = $root || new _$$();
	options = options || {};

	//! load configuration.
	const ROOT_NAME = options.name || 'lemon';
	const STAGE = _get_env('STAGE', '');
    const TS = (_get_env('TS', '1') === '1');                                                   // PRINT TIME-STAMP.
    const LC = (STAGE === 'local'||STAGE === 'express'||_get_env('LC', '')==='1');              // COLORIZE LOG.

    const RED = "\x1b[31m";
    const BLUE = "\x1b[32m";
    const YELLOW = "\x1b[33m";

	//! common function for logging.
	var $console = {thiz: console, log: console.log, error: console.error, auto_ts: TS, auto_color: LC};
	var _log = function () {
		let args = !Array.isArray(arguments) && Array.prototype.slice.call(arguments) || arguments;
		if ($console.auto_color) args.unshift("\x1b[0m"), $console.auto_ts && args.unshift(_ts(), 'L') || args.unshift('L'), args.unshift(BLUE);
		else $console.auto_ts && args.unshift(_ts(), 'L');
		return $console.log.apply($console.thiz, args)
	}
	var _inf = function () {
		let args = !Array.isArray(arguments) && Array.prototype.slice.call(arguments) || arguments;
		if ($console.auto_color) args.unshift(""), args.push("\x1b[0m"), $console.auto_ts && args.unshift(_ts(), 'I') || args.unshift('I'), args.unshift(YELLOW);
		else $console.auto_ts && args.unshift(_ts(), 'I');
		return $console.log.apply($console.thiz, args)
	}
	var _err = function () {
		let args = !Array.isArray(arguments) && Array.prototype.slice.call(arguments) || arguments;
		if ($console.auto_color) args.unshift(""), args.push("\x1b[0m"), $console.auto_ts && args.unshift(_ts(), 'E') || args.unshift('E'), args.unshift(RED);
		else $console.auto_ts && args.unshift(_ts(), 'E');
		return $console.error.apply($console.thiz, args)
	}
	var _extend = function (opt, opts) {      // simple object extender.
		for (var k in opts) {
			var v = opts[k];
			if (v === undefined) delete opt[k];
			else opt[k] = v;
		}
		return opt;
	}
	function _ts(_d) {                       // timestamp like 2016-12-08 13:30:44
		let dt = _d || new Date();
		let [y, m, d, h, i, s] = [dt.getFullYear(), dt.getMonth() + 1, dt.getDate(), dt.getHours(), dt.getMinutes(), dt.getSeconds()];
		return (y < 10 ? "0" : "") + y + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d + " " + (h < 10 ? "0" : "") + h + ":" + (i < 10 ? "0" : "") + i + ":" + (s < 10 ? "0" : "") + s;
	}
	function _get_env(name, defVal){
		// as default, load from proces.env.
		const env =  options.env || (process && process.env) || {};
		const val = env && env[name] || undefined;
		// throw Error if value is not set.
		if (defVal && defVal instanceof Error && val === undefined) throw defVal;
		// returns default.
		return val === undefined ? defVal : val;
	}

	//! root instance to manage global objects.
	var _$ = function (name, opts) {      // global identifier.
		if (!name) return;
		var thiz = _$;        									// 인스턴스 바꿔치기: _$('hello') == _$.hello
		var opt = typeof thiz[name] !== 'undefined' ? thiz[name] : undefined;
		if (opts === undefined) return opt;
		if (opt === undefined) {
			_log('INFO! service[' + name + '] registered');
			thiz[name] = opts;
			return opts;
		}
		//! extends options.
		_err('WARN! service[' + name + '] exists! so extends ');
		opt = opt || {};
		opts = opts || {};
		opt = _extend(opt, opts);
		thiz[name] = opt;
		return opt;
	};

	// register into _$(global instance manager).
	_$.STAGE = STAGE;
	_$.id = ROOT_NAME;
	_$.log = _log;
	_$.inf = _inf;
	_$.err = _err;
	_$.extend = _extend;
	_$.ts = _ts;
	_$.environ = _get_env;
	_$.$console = $console;                     // '$' means object. (change this in order to override log/error message handler)
	_$.toString = () => ROOT_NAME || '$ROOT';

	// register as global instances.
	$root._log = _log;
	$root._inf = _inf;
	$root._err = _err;
	$root._$ = _$;
	$root[_$.id] = _$;

	//! load underscore(or lodash) for global utility.
	const _ = require('lodash/core');           // underscore utilities.
	_$('_', _);                                 // register: underscore utility.

	//! initialize in addition.
	initialize.apply(_$, [$root, options]);

	//! returns finally root (for scoping)
	return $root;
});

/** ********************************************************************************************************************
 *  main application
 ** *******************************************************************************************************************/
/**
 * initialize application.
 */
function initialize($export, options) {
	"use strict";

	// //! load main instance.
	const thiz = this;			// it must be $root.
	const _$ = thiz;

	if (!$export) throw new Error('$export is required.');
	if (!_$) throw new Error('_$ is required.');
	if (typeof _$ !== 'function') throw new Error('_$ should be function.');

	//! load common functions
	const _log = _$.log;
	const _inf = _$.inf;
	const _err = _$.err;

	//! load configuration.
	const STAGE = _$.environ('STAGE', '');
	STAGE && _inf('#STAGE =', STAGE);

	//! load utilities.
	const $U = require('./lib/utilities')(_$);

	//! register to global instance manager.
	_$('U', $U);            // register: Utilities.

    //! load common libraries...
    const httpProxy = require('./lib/http-proxy');
	const createHttpProxy = function(_$, name, endpoint){
		return httpProxy(_$, name, endpoint);
	}
	_$('httpProxy', httpProxy);                             // register as httpProxy (as factory function).
    
	//! load common services....
	require('./lib/mysql-proxy')(_$, 'MS');           		// load service, and register as 'MS'
	require('./lib/dynamo-proxy')(_$, 'DS');          		// load service, and register as 'DS'
	require('./lib/redis-proxy')(_$, 'RS');           		// load service, and register as 'RS'
	require('./lib/elastic-proxy')(_$, 'ES'); 				// load service, and register as 'ES'
	require('./lib/elastic6-proxy')(_$, 'ES6'); 		    // load service, and register as 'ES6'
	require('./lib/s3-proxy')(_$, 'S3'); 					// load service, and register as 'S3'
	require('./lib/sqs-proxy')(_$, 'SS'); 					// load service, and register as 'SS'
	require('./lib/sns-proxy')(_$, 'SN'); 					// load service, and register as 'SN'
	require('./lib/ses-proxy')(_$, 'SE'); 					// load service, and register as 'SE'
	require('./lib/web-proxy')(_$, 'WS'); 					// load service, and register as 'WS'
	require('./lib/cognito-proxy')(_$, 'CS'); 				// load service, and register as 'CS'
	require('./lib/lambda-proxy')(_$, 'LS'); 				// load service, and register as 'LS'
	require('./lib/protocol-proxy')(_$,'PR');				// load service, and register as 'PR'
	require('./lib/cron-proxy')(_$,'CR');				    // load service, and register as 'CR'
	require('./lib/agw-proxy')(_$,'AG');				    // load service, and register as 'AG'

	//! load core services......
	const buildEngine = require('./core/lemon-engine-model');
	const createModel = function(_$, name, option){
		return buildEngine(_$, name, option);
	}
	_$('LEM', buildEngine);                                 // register: lemon-engine-model (as factory function).

    //WARN:TODO - move below messges-service to seperated module.
	//! load basic core services......
	// require('./service/messages-service')(_$, 'MMS');		// Loading & Register as 'MMS'
	
	// //! load api functions......
	// const _meta = require('./api/_meta-api')(_$);
	// const group = require('./api/group-api')(_$);
	// const user  = require('./api/user-api')(_$);
	// const chat  = require('./api/chat-api')(_$);
	
	//! export.
	return Object.assign($export, {createModel, createHttpProxy});
}
