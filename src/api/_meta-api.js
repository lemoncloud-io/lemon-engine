/**
 * API: /_meta 
 * 
 * - 최상위 공통 메타 데이터를 관리.
 * - 메타 데이터의 공통 사항은 아래와 같음.
 * 	1. id - 숫자형 자동 생성. 
 *  2. type - 데이터형 구분지움
 *  3. name - type 별로 거의 유니크하게 name이 활용.
 * 	4. refid - type+name 조합이 유니크함.
 * 
 *
 * author: Steve Jung <steve@lemoncloud.io>
 * date : 2018-03-15
 *
 * Copyright (C) 2018 LemonCloud Co Ltd. - All Rights Reserved.
 */
/** ********************************************************************************************************************
 *  Common Headers
 ** ************************************************************`********************************************************/
//! module.exports
exports = module.exports = (function (_$, name) {
	if (!_$) throw new Error('_$(global instance pool) is required!');

//! load services (_$ defined in global)
const $_ = _$._;                                // re-use global instance (lodash).
const $U = _$.U;                                // re-use global instance (utils).

//! load common(log) functions
const _log = _$.log;
const _inf = _$.inf;
const _err = _$.err;

//! Name Space.
const NS = $U.NS('META', "yellow");				// NAMESPACE TO BE PRINTED.

//! Re-use core services.
const $MMS = _$.MMS;							// Re-use the message-service.


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
		case 'LIST?':
			next = do_list_meta;
			break;
		case 'GET':
			next = do_get_meta;
			if (0 && CMD === 'initialize')				//WARN! - BE CAREFUL
				next = do_initialize_meta;
			if (0 && CMD === 'terminate')				//WARN! - BE CAREFUL
				next = do_terminate_meta;
			if (CMD === 'self-test')
				next = do_self_test_meta;
			break;
		case 'PUT':
			break;
		case 'POST':
			break;
		case 'DELETE':
			break;
		case 'EVENT':
			break;
		default:
			break;
	}
	return next;
}

//INFO - 이름 규칙 do_action_object().
main.do_list_meta = do_list_meta;
main.do_get_meta = do_get_meta;
main.do_put_meta = do_put_meta;
main.do_post_meta = do_post_meta;
main.do_delete_meta = do_delete_meta;
main.do_self_test_meta = do_self_test_meta;



/** ********************************************************************************************************************
 *  Local Functions.
 ** ********************************************************************************************************************/

/**
 * UPDATE시 parent항목 검사.
 * 
 * @param {*} node
 */
const do_chain_on_update_parent = (node) => {
	if (!node.type) return Promise.reject(new Error('type is required!'));
	const TYPE = node.type;

	//! if parent set!
	if (node.parent !== undefined){
		const parent = (''+node.parent).trim();
		if (!parent || parent === '0'){
			node.parent = 0; 									// clear set to 0.
		} else if (typeof node.parent === 'string'){			// must be name.
			var $ref = {type:TYPE, name:node.parent};
			$ref.refid = $MMS.calculate_refid($ref);
			//! search by ref-id.
			return $MMS.do_search_refid($ref)
				.then(_ => {
					// _log(NS,'> ret =', _);
					_log(NS,'> set parent-id :=', _.id, '<- ref:' + $ref.refid);
					node.parent = _.id;
					if (node.parent == node.id || node.parent == node._id){
						return Promise.reject(new Error('parent is same as id'));
					}
					return node;
				})
		} else {
			return $MMS.do_read(parent)
				.then(_ => {
					_log(NS,'> set parent-id :=', _.id, '<- pid:'+parent);
					node.parent = _.id;
					if (_.type !== TYPE){
						return Promise.reject(new Error('parent.type is different. type:'+_.type));
					} else if (node.parent == node.id || node.parent == node._id){
						return Promise.reject(new Error('parent-id is same as id'));
					}
					return node;
				})
		}
	}
	return node;
}
main.do_chain_on_update_parent = do_chain_on_update_parent;

/**
 * UPDATE시 group 항목 검증하기.
 * 
 * @param {*} node 
 */
const do_chain_on_update_group = (node) => {	
	//! if group set!
	if (node.group !== undefined){
		const group = (''+node.group).trim();
		if (!group || group === '0' || group === ''){
			node.group = 0; 									// clear set to 0.
			// node.group_name = '';
		} else if (typeof node.group === 'string'){				// must be string.
			var $ref = {type:'group', name:group};
			$ref.refid = $MMS.calculate_refid($ref);
			return $MMS.do_search_refid($ref)
				.then(_ => {
					// _log(NS,'> ret =', _);
					_log(NS,'> set group-id :=', _.id, '<- refid:', $ref.refid);
					node.group = _.id;
					// node.group_name = _.name;
					return node;
				})
		} else {
			return $MMS.do_read(group)
				.then(_ => {
					_log(NS,'> set group-id :=', _.id, '<- gid:'+group);
					node.group = _.id;
					if (_.type !== 'group'){
						return Promise.reject(new Error('group.type is different. type:'+_.type));
					} else if (node.group == node.id || node.group == node._id){
						return Promise.reject(new Error('group-id is same as id'));
					}
					return node;
				})
		}
	}
	return node;
}
main.do_chain_on_update_group = do_chain_on_update_group;

/**
 * update groups array.
 * 
 * @param {*} node 
 */
const my_chain_on_update_groups = (node) => {	
	//! if groups set!
	if (node.groups !== undefined){
		const groups = node.groups||[];
		if (!Array.isArray(groups)) return Promise.reject(new Error('groups should be array!'));
		const my_check_group = (name0) => {
			const name = (''+name0).trim();
			if (!name || name === '0' || name === ''){
				return 0;
			} else if (typeof name0 === 'string'){				// must be string.
				var $ref = {type:'group', name:name};
				$ref.refid = $MMS.calculate_refid($ref);
				return $MMS.do_search_refid($ref)
					.then(_ => {
						// _log(NS,'> ret =', _);
						_log(NS,'> set group-id :=', _.id, '<- refid:', $ref.refid);
						return _.id;
					})
			} else {
				// const $group = require('./group-api');
				// return $group.do_get_group(name)
				// 	.then(_ => {
				// 		_log(NS,'> set group-id :=', _.id, '<- id:', name);
				// 		return _.id;
				// 	})
				return Promise.resolve(parseInt(name));
			}
		}
		return groups.reduce((chain, val, i)=>{
				return chain.then(arr => {
					return my_check_group(val)
						.then(_ => {
							if(_ && arr.indexOf(_) < 0){
								arr.push(_);
							}
							return arr;
						})
				})
			}, Promise.resolve([])).then(_ => {
				node.groups = _;
				return node;
			})
	}
	return node;
}

/**
 * detailed groups with fully populated information.
 * 
 * @param {*} node 
 */
const my_chain_on_detail_groups = (node) => {	
	const $group = require('./group-api')(_$);
	//! if groups set!
	if (node.groups !== undefined){
		const groups = node.groups||[];
		_log(NS,'> groups =', groups);
		
		const my_detail_group = (id) => {
			_log(NS,'>> group-id =', id);
			return $group.do_get_group(id)
				.then(_ => {
					return $U.cleanup(_);
				})
		};
		return groups.reduce((chain, val, i)=>{
				return chain.then(arr => {
					return my_detail_group(val)
						.then(_ => {
							arr.push(_);
							return arr;
						})
				})
			}, Promise.resolve([])).then(_ => {
				node.groups = _;
				return node;
			})
	}
	return node;
}

/**
 * Initialize Resources for _meta.
 * 
 * example:
 * $ http 'localhost:8086/_meta/0/initialize'
 * 
 * @param {*} ID 
 * @param {*}  
 * @param {*}  
 * @param {*} 
 */
function do_initialize_meta(ID, $param, $body, $ctx){
	_log(NS, `do_initialize_meta(${ID})....`);
	if (ID !== '0') return Promise.reject(new Error('invalid ID:' + ID));

	const that = Object.assign({}, $param);
	_inf(NS, 'WARN! initialize ', $MMS.name);
	return Promise.resolve(that)
		.then(that => {
			const ret = $MMS.do_initialize();
			return ret;
		});
}

/**
 * Destroy Resources for _meta.
 * 
 * example:
 * $ http 'localhost:8086/_meta/0/terminate'
 * 
 * @param {*} ID 
 * @param {*}  
 * @param {*}  
 * @param {*}  
 */
function do_terminate_meta(ID, $param, $body, $ctx){
	_log(NS, `do_terminate_meta(${ID})....`);
	if (ID !== '0') return Promise.reject(new Error('invalid ID:' + ID));

	const that = Object.assign({}, $param);
	_inf(NS, 'WARN! terminate ', $MMS.name);
	return Promise.resolve(that)
		.then(that => {
			const ret = $MMS.do_terminate();
			return ret;
		});
}

/**
 * Execute self-test.
 * 
 * example:
 * $ http 'localhost:8086/_meta/0/self-test'
 * 
 * @param {*} ID 
 * @param {*}  
 * @param {*}  
 * @param {*}  
 */
function do_self_test_meta(ID, $param, $body, $ctx){
	_log(NS, `do_self_test_meta(${ID})....`);
	// if (ID !== '0') return Promise.reject(new Error('invalid ID:' + ID));

	const that = Object.assign({}, $body||{});
	that.id = $U.N(ID, 0);
	return Promise.resolve(that)
	.then(that => {
		const ret = $MMS.do_test_self(that, $param);
		return ret;
	});
}


/**
 * Search by params
 * 
 * example:
 * $ http 'localhost:8086/_meta/?type=TEST'
 * 
 * @param {*} ID 			id of object
 * @param {*} $param		query parameters (json)
 * @param {*} $body			body parameters (json)
 * @param {*} $ctx			context (optional)
 */
function do_list_meta(ID, $param, $body, $ctx){
	// _log(NS, `do_list_meta(${ID})....`);

	const that = Object.assign({}, $body||$param);
	if (!that.type) return Promise.reject(new Error('type is required!'));
	// _log(NS, '> that = ', that);
	return $MMS.do_search(ID, that);
}

/**
 * Read the detailed object.
 * 
 * example:
 * $ http 'localhost:8086/_meta/1000?type=TEST'
 * 
 * @param {*} ID 
 * @param {*}  
 * @param {*}  
 * @param {*}  
 */
function do_get_meta(ID, $param, $body, $ctx){
	// _log(NS, `do_get_meta(${ID})....`);

	const that = Object.assign({}, $body||$param);
	if (!that.type) return Promise.reject(new Error('type is required!'));
	const TYPE = that.type;
	delete that.type;

	//! target search.
	return $MMS.do_read(ID, that)
		.then(that => {
			const node = that._node||{};
			const deleted_at = that.deleted_at||node.deleted_at||0;
			if (deleted_at){
				return Promise.reject(new Error('404 NOT FOUND'+': Node deleted_at='+deleted_at));
			}
			if (node.type != TYPE){
				return Promise.reject(new Error('404 NOT FOUND'+': Invalid Type='+node.type));
			}
			return that;
		})
		// .then(my_chain_filter_node)
}

/**
 * UPDATE META.
 * - $MMS.do_update() 와 차이점은, type이 서로 동일해야함.
 * 
 * @param {*} ID 
 * @param {*}  
 * @param {*}  
 * @param {*}  
 */
function do_put_meta(ID, $param, $body, $ctx){
	// _log(NS, `do_put_meta(${ID})....`);

	const that = Object.assign({}, $body||$param);
	if (!that.type) return Promise.reject(new Error('type is required!'));
	const TYPE = that.type;
	delete that.type;

	//! target search.
	return $MMS.do_read(ID, that)
		.then(_ => {
			const node = _._node||{};
			const deleted_at = _.deleted_at||node.deleted_at||0;
			if (deleted_at){
				return Promise.reject(new Error('404 NOT FOUND'+': Node deleted_at='+deleted_at));
			}
			if (node.type != TYPE){
				return Promise.reject(new Error('404 NOT FOUND'+': Invalid Type='+node.type));
			}
			_log(NS,'> update =', that);
			//TODO - check updated field.
			return $MMS.do_update(ID, that);
		})
}

/**
 * 새로운 항목을 생성해 준다.
 * 
 * @param {*} ID 
 * @param {*}  
 * @param {*}  
 * @param {*}  
 */
function do_post_meta(ID, $param, $body, $ctx){
	// _log(NS, `do_post_meta(${ID})....`);
	if (ID !== 0) return Promise.reject(new Error('invalid id:' + ID));

	const that = Object.assign({}, $body||$param);
	if (!that.type) return Promise.reject(new Error('type is required!'));
	//!WARN! - type is required!
	// const TYPE = that.type;
	// delete that.type;

	//! target search.
	return $MMS.do_create_safe(ID, that)
}

/**
 * 데이터를 삭제한다. 
 * 
 * @param {*} ID 
 * @param {*}  
 * @param {*}  
 * @param {*}  
 */
function do_delete_meta(ID, $param, $body, $ctx){
	// _log(NS, `do_delete_meta(${ID})....`);
	if (typeof ID !== 'number') return Promise.reject(new Error('invalid id:' + ID));

	const that = Object.assign({}, $body||$param);
	if (!that.type) return Promise.reject(new Error('type is required!'));
	const TYPE = that.type;
	delete that.type;

	//! target search.
	return $MMS.do_read(ID, that)
		.then(_ => {
			const node = _._node||{};
			const deleted_at = _.deleted_at||node.deleted_at||0;
			if (deleted_at){
				//! already deleted.
				// return Promise.reject(new Error('404 NOT FOUND'+': Node deleted_at='+deleted_at));
				return _;						// returns deleted object in detail.
			}
			if (node.type != TYPE){
				return Promise.reject(new Error('404 NOT FOUND'+': Invalid Type='+node.type));
			}
			return $MMS.do_delete(ID, that)
				.then((that) => {
					const node = that._node||that;
					const deleted_at = node.deleted_at||0;
					_.deleted_at = deleted_at;
					return _;					// returns deleted object in detail.
				});
		})
}

//! returns main function.
return main;


//////////////////////////
//- end of module.exports
});