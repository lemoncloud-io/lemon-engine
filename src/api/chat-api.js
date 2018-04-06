/**
 * API: /chat 
 * - type:chat specific API handler
 * 
 * 
 * 단순 메세지를 보내는 것으로, 
 * 
 *
 * author: Steve Jung <steve@lemoncloud.io>
 * date : 2018-03-15
 *
 * Copyright (C) 2018 LemonCloud Co Ltd. - All Rights Reserved.
 */
/** ********************************************************************************************************************
 *  Common Headers
 ** ********************************************************************************************************************/
//! load services (_$ defined in global)
const $_ = _$._;                                // re-use global instance (lodash).
const $U = _$.U;                                // re-use global instance (utils).
// const $R = _$.R;                                // re-use global instance (rdb).
// const $MS = _$.MS;                              // re-use global instance (mysql-service).
// const $DS = _$.DS;                              // re-use global instance (dynamo-service).
// const $RS = _$.RS;                              // re-use global instance (redis-service).
// const $ES = _$.ES;                              // re-use global instance (elasticsearch-service).
// const $SS = _$.SS;                              // re-use global instance (sqs-service).

//! Name Space.
const NS = $U.NS('CHAT', "yellow");				// NAMESPACE TO BE PRINTED.

//! Re-use core services.
// const $MMS = _$.MMS;							// Re-use the meta-service.


/** ********************************************************************************************************************
 *  COMMON Functions.
 ** ********************************************************************************************************************/
function success(body) {
    return buildResponse(200, body);
}

function notfound(body) {
    return buildResponse(404, body);
}

function failure(body) {
    return buildResponse(503, body);
}

function buildResponse(statusCode, body) {
    return {
        statusCode: statusCode,
        headers: {
            "Access-Control-Allow-Origin": "*",         // Required for CORS support to work
            "Access-Control-Allow-Credentials": true    // Required for cookies, authorization headers with HTTPS
        },
        body: JSON.stringify(body)
    };
}

/** ********************************************************************************************************************
 *  Main Function for API export.
 ** ********************************************************************************************************************/
//! IT WILL BE MOVED TO SUB FILES..
const main = function (event, context, callback){
	"use strict";

	//!WARN! allows for using callbacks as finish/error-handlers
	context.callbackWaitsForEmptyEventLoop = false;

	//! API parameters.
	const $param = event.queryStringParameters || {};
	const $path = event.pathParameters || {};
	// _log(NS,'$path=', $path);

	//! determine running mode.
	const ID = decodeURIComponent($path.id || '');                                   // id in path (1st parameter).
	const METHOD = !ID&&event.httpMethod==='GET'&&'LIST'||event.httpMethod||'';      // determine method.
	const METHOD_MODE_MAP = {'LIST':'SEARCH', 'GET':'GET', 'PUT':'PUT', 'POST':'POST', 'DELETE':'DELETE'};
	const CMD = decodeURIComponent($path.cmd || '');                                 // cmd in path (2nd parameter).

	//! decoding mode.
	let MODE = METHOD_MODE_MAP[METHOD];
	let $body = event.body && JSON.parse(event.body) || null;
	let action = $param.action;                                               		// action parameter (for test).
	if (action !== undefined) delete $param.action;									// clear action param

	//! debug print.
	!$body && _log(NS, `#${MODE}:${CMD} (${METHOD}, ${ID}, ${action})....`);
	// $body && _log(NS+`#${mode} (${METHOD}, ${ID}, ${action}).... body=`, $U.json($body).length);
	$body && _log(NS, `#${MODE}:${CMD} (${METHOD}, ${ID}, ${action}).... body.len=`, $body ? $U.json($body).length : -1);
	// _log(NS, '> body =', $body);

	//! check stream mode.
	if (!MODE && event.Records) {
		$body = $body||{};
		MODE = 'EVENT';
		action = 'records';
		$body.records = event.Records;
	}

	//! decode mode.
	const that = {_id:ID, _param:$param, _body:$body, _ctx:context};
	let chain = Promise.resolve(that);

	//! exit if not found.
	const next = _decode_next_handler(MODE, ID, CMD);
	if (!next) return callback(null, notfound({MODE}));

	//! do the promised task chain.
	try {
		chain.then((that) => {
			//! decode parameter.
			const ID = that._id;
			const $param = that._param;
			const $body = that._body;
			const $ctx = that._ctx;

			// call next.. (it will return result or promised)
			return next(ID, $param, $body, $ctx);
		})
		// .then($IPS.do_finish_chain)		//WARN! DO NOT CALL THIS.
		.then(_ => {
			if(_ && typeof _ === 'object') _ = $U.cleanup(_);
			// _log(NS, '!!! callback@1 with 200');
			callback(null, success(_));
			return true;
		})
		.catch(e => {
			_err(NS, '!!! callback@1 with err', e);
			const message = e && e.message || '';
			if(message.indexOf('404 NOT FOUND') >= 0){
				callback(null, notfound(e.message));
			} else {
				callback(null, failure(e.message||e));
			}
			return false;
		})
	} catch(e){
		callback(e, failure(e.message));
	}
};

/** ********************************************************************************************************************
 *  Decode Next Handler
 ** ********************************************************************************************************************/
/**
 * Decode Target Next Handler (promised function).
 * 
 * @param {*} MODE 	method
 * @param {*} ID 	id 
 * @param {*} CMD 	command
 */
function _decode_next_handler(MODE, ID, CMD)
{
	let next = null;
	switch(MODE)
	{
		case 'SEARCH':
			next = do_list_chat;
			break;
		case 'GET':
			next = do_get_chat;
			if (ID === '0' && CMD === 'self-test')
				next = do_self_test_chat;
			break;
		case 'PUT':
			next = do_put_chat;
			break;
		case 'POST':
			next = do_post_chat;
			break;
		case 'DELETE':
			next = do_delete_chat;
			break;
		case 'EVENT':
			break;
		default:
			break;
	}
	return next;
}

//INFO - 이름 규칙 do_action_object().
main.do_list_chat = do_list_chat;
main.do_get_chat = do_get_chat;
main.do_put_chat = do_put_chat;
main.do_post_chat = do_post_chat;
main.do_delete_chat = do_delete_chat;

module.exports = main;


/** ********************************************************************************************************************
 *  Local Functions.
 ** ********************************************************************************************************************/
const TYPE = 0 ? 'TEST' : 'chat';
const PROPERTIES = {
	'id' 			: 'ID',
	'parent' 		: 'Parent Chat ID (for reply)',
	'group' 		: 'Group/Org ID',
	'name' 			: 'Tag (should be "#")',			// "#" means no unique name.
	'nick' 			: 'Sender Nickname',
	'message' 		: 'Short Message',
	'description' 	: 'Long Message body',
	'image' 		: 'Sender Avatar',
	'state' 		: 'State',
	'source' 		: 'Creator ID',
	'target' 		: 'Target ID',
	'created_at' 	: 'Created Time',
	'updated_at' 	: 'Updated Time',
}
const $meta = require('./_meta-api');
const $user = require('./user-api');

//! Filtering Saved Node instance with field set. (for chat filter)
const my_chain_filter_node = (node) => {
	// _log(NS, 'node = ', $U.json(node));
	
	node = node||{};
	const node2 = Object.keys(PROPERTIES).reduce((N, key, i)=>{
		if(node[key] !== undefined) N[key] = node[key];
		return N;
	}, {});
	if (node._id !== undefined) node2._id = node._id;
	return node2;
}

const my_chain_override_type = (node) => {
	node.type = TYPE;
	return node;
}

const my_chain_on_update_parent = (node) => {
	if (node.name !== undefined) node.name = (''+node.name).trim();
	return $meta.do_chain_on_update_parent(node);
}

const my_chain_on_update_group = (node) => {	
	return $meta.do_chain_on_update_group(node);
}

const my_chain_on_update_source = (node) => {
	if (node.source !== undefined)
	{
		return $user.do_get_user(node.source)
			.then(_ => {
				const name = (node.name||'#sms').trim();
				node.name = name;					// '#' means that name is not unique.
				node.source = _.id;
				node.nick = node.nick||_.nick||_.name;
				node.image = _.image;
				return node;
			})
	}
	return node;
}

const my_chain_on_update_target = (node) => {	
	if (node.target !== undefined)
	{
		return $user.do_get_user(node.target)
			.then(_ => {
				node.target = _.id;
				return node;
			})
	}
	return node;
}


/**
 * Search by params
 * 
 * example:
 * $ http 'localhost:8086/chat/'
 * 
 * @param {*} ID 			id of object
 * @param {*} $param		query parameters (json)
 * @param {*} $body			body parameters (json)
 * @param {*} $ctx			context (optional)
 */
function do_list_chat(ID, $param, $body, $ctx){
	_log(NS, `do_list_chat(${ID})....`);

	//! override settings.
	$param = $param||{};
	$param.type = TYPE;

	//! target search.
	return $meta.do_list_meta(ID, $param)
		.then(_ => {
			const list = _.list||[];
			_.list = list.map(my_chain_filter_node);
			return _;
		})
}


/**
 * Read the detailed object.
 * 
 * example:
 * $ http 'localhost:8086/chat/1000'
 * 
 * @param {*} ID 
 * @param {*}  
 * @param {*}  
 * @param {*}  
 */
function do_get_chat(ID, $param, $body, $ctx){
	_log(NS, `do_get_chat(${ID})....`);

	//! override settings.
	$param = $param||{};
	$param.type = TYPE;

	//! target search.
	return $meta.do_get_meta(ID, $param)
		.then(my_chain_filter_node)
}


/**
 * self-test 
 * 
 * $ http 'localhost:8086/chat/0/self-test'
 * $ http 'localhost:8086/chat/0/self-test?name=hoho2'
 * 
 * @param {*} ID 
 * @param {*}  
 * @param {*}  
 * @param {*}  
 */
function do_self_test_chat(ID, $param, $body, $ctx){
	_log(NS, `do_self_test_chat(${ID})....`);

	//! override settings.
	$param = $param||{};
	$param.type = TYPE;

	//! target search.
	return $meta.do_self_test_meta(ID, $param)
}


/**
 * Update
 * 
 * example:
 * $ echo '{"name":"test 1001"}' | http PUT 'localhost:8086/chat/1009'
 * $ echo '{"parent":1000}' | http PUT 'localhost:8086/chat/1009'
 * $ echo '{"parent":"haha3+"}' | http PUT 'localhost:8086/chat/1009'
 * $ echo '{"group":1008}' | http PUT 'localhost:8086/chat/1009'
 * 
 * 
 * @param {*} ID 
 * @param {*}  
 * @param {*}  
 * @param {*}  
 */
function do_put_chat(ID, $param, $body, $ctx){
	_log(NS, `do_put_chat(${ID})....`);

	const that = $body||$param;
	if (!that) return Promise.reject(new Error('node is required!'));
	that._id = $U.N(ID, 0);

	//! target search.
	return Promise.resolve(that)
		.then(my_chain_filter_node)						// create new node
		.then(my_chain_override_type)					// override type.
		.then(my_chain_on_update_parent)
		.then(my_chain_on_update_group)
		.then(that => {
			return $meta.do_put_meta(ID, that);
		})
}


/**
 * Create
 * - ID != 0 이면, create에서 에러 발생하면,
 * - refid 를 조사해서, 같은 항목을 업데이트 한다.
 * 
 * example:
 * $ echo '{"message":"test chat"}' | http POST 'localhost:8086/chat/0'		=> error.
 * $ echo '{"source":"steve@lemoncloud.io","message":"hello! lemon!"}' | http POST 'localhost:8086/chat/0'
 * $ echo '{"source":"d.kim@lemoncloud.io","message":"hello! daniel!"}' | http POST 'localhost:8086/chat/0'
 * 
 * test set:
 * 	1000 - chat!0
 *  1001 - chat!1
 * 
 * @param {*} ID 
 * @param {*}  
 * @param {*}  
 * @param {*}  
 */
function do_post_chat(ID, $param, $body, $ctx){
	_log(NS, `do_post_chat(${ID})....`);
	if (ID !== '0' && ID !== 0) return Promise.reject(new Error('invalid ID:' + ID));

	const that = $body||$param;
	if (!that) return Promise.reject(new Error('node is required!'));
	ID = $U.N(ID, 0);

	// _log(NS, '> that=', that);
	// return Promise.resolve(that);

	//! validate.
	const my_chain_validate_self = (that) => {
		const source = (that.source||'').trim();
		if (!that.source) return Promise.reject(new Error('source is required!'));

		const message = (that.message||'').trim();
		if (!that.message) return Promise.reject(new Error('message is required!'));
		return that;
	}

	//! target search.
	return Promise.resolve(that)
		.then(my_chain_filter_node)						// filter chat fields
		.then(my_chain_override_type)					// override type.
		.then(my_chain_validate_self)
		.then(my_chain_on_update_source)
		.then(my_chain_on_update_target)
		.then(my_chain_on_update_parent)
		.then(my_chain_on_update_group)
		.then(that => $meta.do_post_meta(ID, that))
		.then(my_chain_filter_node)
}


/**
 * Delete
 * 
 * example:
 * $ http DELETE 'localhost:8086/chat/1007'
 * 
 * @param {*} ID 
 * @param {*}  
 * @param {*}  
 * @param {*}  
 */
function do_delete_chat(ID, $param, $body, $ctx){
	_log(NS, `do_delete_chat(${ID})....`);

	const that = $body||$param;
	if (!that) return Promise.reject(new Error('node is required!'));
	ID = $U.N(ID, 0);

	//! target search.
	return Promise.resolve(that)
		.then(my_chain_filter_node)
		.then(my_chain_override_type)					// override type.
		.then(that => $meta.do_delete_meta(ID, that))
}

