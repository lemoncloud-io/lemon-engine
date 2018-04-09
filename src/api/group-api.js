/**
 * API: /group 
 * - type:group specific API handler
 * 
 * 회사와 회사내 조직을 표현함.
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
const NS = $U.NS('GRUP', "yellow");				// NAMESPACE TO BE PRINTED.

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
	const TYPE = decodeURIComponent($path.type || '');                               // type in path (0st parameter).
	const ID = decodeURIComponent($path.id || '');                                   // id in path (1st parameter).
	const METHOD = !ID&&event.httpMethod==='GET'&&'LIST'||event.httpMethod||'';      // determine method.
	const CMD = decodeURIComponent($path.cmd || '');                                 // cmd in path (2nd parameter).

	//! decoding mode.
	const METHOD_MODE_MAP = {'LIST':'LIST', 'GET':'GET', 'PUT':'PUT', 'POST':'POST', 'DELETE':'DELETE'};
	const MODE = !METHOD && event.Records ? 'EVENT' : METHOD_MODE_MAP[METHOD];
	//! safe decode body if it has json format. (TODO - support url-encoded post body)
	const $body = event.body 
			&& (typeof event.body === 'string' && (event.body.startsWith('{') || event.body.startsWith('[')) ? JSON.parse(event.body) : event.body) 
			|| event.Records && {records: event.Records}
			|| null;
	//! debug print body.
	!$body && _log(NS, `#${MODE}:${CMD} (${METHOD}, ${TYPE}/${ID})....`);
	$body && _log(NS, `#${MODE}:${CMD} (${METHOD}, ${TYPE}/${ID}).... body.len=`, $body ? $U.json($body).length : -1);

	//! prepare chain object.
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
		case 'LIST':
			next = do_list_group;
			break;
		case 'GET':
			next = do_get_group;
			if (ID === '0' && CMD === 'self-test')
				next = do_self_test_group;
			// if (CMD === 'detail')
			// 	next = do_get_group_detail;
			break;
		case 'PUT':
			next = do_put_group;
			break;
		case 'POST':
			next = do_post_group;
			break;
		case 'DELETE':
			next = do_delete_group;
			break;
		case 'EVENT':
			break;
		default:
			break;
	}
	return next;
}

//INFO - 이름 규칙 do_action_object().
main.do_list_group = do_list_group;
main.do_get_group = do_get_group;
// main.do_get_group_detail = do_get_group_detail;
main.do_put_group = do_put_group;
main.do_post_group = do_post_group;
main.do_delete_group = do_delete_group;

module.exports = main;


/** ********************************************************************************************************************
 *  Local Functions.
 ** ********************************************************************************************************************/
const TYPE = 0 ? 'TEST' : 'group';
const PROPERTIES = {
	'id' 			: 'ID',
	'parent' 		: 'Parent ID (상위 조직의 ID)',
	'group' 		: 'Group ID (???)',
	'name' 			: 'Name (그룹 고유 이름ID)',
	'nick' 			: 'Show Name (표시할 이름)',
	'message' 		: 'Short Description (그룹의 상태 표시 메세지)',
	'description' 	: 'Long Description (그룹의 상세 내용)',
	'image' 		: 'Image URL (대표 이미지)',
	'state' 		: 'State (그룹 상태)',
	'source' 		: 'Creator ID (생성자)',
	'created_at' 	: 'Created Time',
	'updated_at' 	: 'Updated Time',
}
const $meta = require('./_meta-api');

//! Filtering Saved Node instance with field set. (for user filter)
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

/**
 * Search by params
 * 
 * example:
 * $ http 'localhost:8086/group/'
 * 
 * @param {*} ID 			id of object
 * @param {*} $param		query parameters (json)
 * @param {*} $body			body parameters (json)
 * @param {*} $ctx			context (optional)
 */
function do_list_group(ID, $param, $body, $ctx){
	_log(NS, `do_list_group(${ID})....`);

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
 * $ http 'localhost:8086/group/1000'
 * $ http 'localhost:8086/group/1005'
 * 
 * @param {*} ID 
 * @param {*}  
 * @param {*}  
 * @param {*}  
 */
function do_get_group(ID, $param, $body, $ctx){
	_log(NS, `do_get_group(${ID})....`);

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
 * $ http 'localhost:8086/group/0/self-test'
 * $ http 'localhost:8086/group/0/self-test?name=haha2'
 * 
 * @param {*} ID 
 * @param {*}  
 * @param {*}  
 * @param {*}  
 */
function do_self_test_group(ID, $param, $body, $ctx){
	_log(NS, `do_self_test_group(${ID})....`);

	//! override settings.
	$param = $param||{};
	$param.type = TYPE;

	//! target search.
	return $meta.do_self_test_meta(ID, $param)
}

// /**
//  * 
//  * $ http 'localhost:8086/group/1004/detail'
//  * 
//  * @param {*} ID 
//  * @param {*}  
//  * @param {*}  
//  * @param {*}  
//  */
// function do_get_group_detail(ID, $param, $body, $ctx){
// 	_log(NS, `do_get_group_detail(${ID})....`);

// 	return do_get_group(ID, $param, $body, $ctx)
// 		.then(my_chain_on_detail_groups)	
// }

/**
 * Update
 * 
 * example:
 * $ echo '{"name":"test 1001"}' | http PUT 'localhost:8086/group/1001'
 * $ echo '{"parent":1000}' | http PUT 'localhost:8086/group/1001'
 * $ echo '{"parent":"test-name+"}' | http PUT 'localhost:8086/group/1001'
 * $ echo '{"group":1001}' | http PUT 'localhost:8086/group/1001'
 * $ echo '{"group":"test-name+"}' | http PUT 'localhost:8086/group/1001'
 * $ echo '{"parent":"group!2","group":"brand!0"}' | http PUT 'localhost:8086/group/1004'
 * 
 * 
 * @param {*} ID 
 * @param {*}  
 * @param {*}  
 * @param {*}  
 */
function do_put_group(ID, $param, $body, $ctx){
	_log(NS, `do_put_group(${ID})....`);

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
 * $ echo '{"name":"test create"}' | http POST 'localhost:8086/group/0'
 * $ echo '{"name":"group!1","brand":1000,"brand_name":"inisfree","ingredients":[1002,1001]}' | http POST 'localhost:8086/group/0'
 * $ echo '{"name":"group!2","brand":1000,"brand_name":"inisfree","option":"red"}' | http POST 'localhost:8086/group/0'
 * $ echo '{"name":"group!3","brand":"brand!1","ingredients":["ingredient!2"]}' | http POST 'localhost:8086/group/0'
 * $ echo '{"name":"lemoncloud.io"}' | http POST 'localhost:8086/group/0'
 * 
 * @param {*} ID 
 * @param {*}  
 * @param {*}  
 * @param {*}  
 */
function do_post_group(ID, $param, $body, $ctx){
	_log(NS, `do_post_group(${ID})....`);
	if (ID !== '0' && ID !== 0) return Promise.reject(new Error('invalid ID:' + ID));

	const that = $body||$param;
	if (!that) return Promise.reject(new Error('node is required!'));
	ID = $U.N(ID, 0);

	//! target search.
	return Promise.resolve(that)
		.then(my_chain_filter_node)						// filter user fields
		.then(my_chain_override_type)					// override type.
		.then(my_chain_on_update_parent)
		.then(my_chain_on_update_group)
		.then(that => $meta.do_post_meta(ID, that))
		.then(my_chain_filter_node)
}


/**
 * Delete
 * 
 * example:
 * $ http DELETE 'localhost:8086/group/1007'
 * 
 * @param {*} ID 
 * @param {*}  
 * @param {*}  
 * @param {*}  
 */
function do_delete_group(ID, $param, $body, $ctx){
	_log(NS, `do_delete_group(${ID})....`);

	const that = $body||$param;
	if (!that) return Promise.reject(new Error('node is required!'));
	ID = $U.N(ID, 0);

	//! target search.
	return Promise.resolve(that)
		.then(my_chain_filter_node)
		.then(my_chain_override_type)					// override type.
		.then(that => $meta.do_delete_meta(ID, that))
}
