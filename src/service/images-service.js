/**
 * # images-service 
 *  - 샘플 파일로, ID 가 문자열 형태를 가지는 노드의 기본형. 
 * 
 * Images
 * - 이미지(jpg,gif,png)등 메타 정보 저장.
 * - ID는 자동 생성이 아닌, 문자열 값으로 생성됨.
 *
 * 
 * # API vs Service 차이
 * 	- API :  GET/PUT/POST/DEL 으로 외부 인터페이스 제공 (as controll interface).
 * 	- Service : LEMON 엔진의 노드모델별 최적화/특수화 시킨 것 (as enging-tuning).
 * 	- Service : validation, 기본 필드값 (ex: refid) 계산등 데이터 상호 완결성에 집중함.
 *  - Service : node 의 삭제 상태 체크는 Service 에서 진행한다.
 * 
 * ## 요구사항
 * - see README.md.
 *
 * 
 * ------------------------------------------
 * ## 스키마 구조
 *  - 주의! Name 앞에 '-' 이 붙어 있으면 삭제된 속성!.
 * Index	Name	    Type	    Comment
 * PK	    id	        String	    고유 ID (hash(file))
 * PK	    type	    String	    데이터 타입
 * 		    parent	    String	    부모  ID.
 * 		    name	    String	    type 내에서 고유한 값 (see refid)
 * 	    	refid	    String	    := MD5(type+":"+name)
 * 			stereo 		String		같은 type에서의 스테레오 타입(예: User내에서 email/hphone등).
 * 
 * 
 * 
 * author: Steve Jung <steve@lemoncloud.io>
 * date : 2018-04-11
 *
 * Copyright (C) 2018 LemonCloud Co Ltd. - All Rights Reserved.
 */
module.exports = (function (_$, name, options) {
	"use strict";
	name = name || 'IMS';								// global service name.

	// data properties.
	const FIELDS = [
		//! core properties.
		'id', 'type', 'parent', 'name', 'group', 'refid', 'stereo',
		//! extended properties.
		'size',
		'description',
	];

	// index properties.
	const ES_FIELDS = FIELDS.reduce((arr, val) => {
		val = val||'';
		if (val.startsWith('desc')) return arr;
		arr.push(val);
		return arr;
	}, []);
	// _log('ES_FIELDS = ', ES_FIELDS);

	// core module
	const $U = _$.U; 
	const LEM = _$.LEM;
	if (!$U) throw new Error('$U is required!');
	if (!LEM) throw new Error('LEM is required!');

	//! load common(log) functions
	const _log = _$.log;
	const _inf = _$.inf;
	const _err = _$.err;
	
	// NAMESPACE TO BE PRINTED.
	const NS = $U.NS(name);

	// make instance of lemon-core-service with parameters.
	const $LEM = LEM(_$, '_'+name, {			// use '_' prefix for LEM instance. 
		ID_TYPE     : '#ImageSeq',				// WARN! '#' means no auto-generated id.
		ID_NEXT     : 0,						// useless if ID_TYPE has '#' prefix.
		FIELDS      : FIELDS,					// node properties.
		DYNA_TABLE  : 'Images',					// table name of DynamoDB
		REDIS_PKEY  : 'CIMS',					// prefix key in Redis.
		ES_INDEX    : 'images-v1',				// ES Index Name. (//TODO - dev/prod index)
		ES_TYPE     : 'image',					//TODO:0315 - ES 데이터를 같은 인덱스 내에서, type별로 나눠서 저장.
		ES_FIELDS   : ES_FIELDS,				// some fields for search-index.
		NS_NAME     : name,                     // Notify Service Name. (null means no notifications)
		ES_MASTER	: 1,						// If acts as MASTER NODE.
		CLONEABLE   : true,                     // 복제 가능하며, parent/cloned 필드를 지원함. (Core 에만 세팅!)
		PARENT_IMUT : true,						// parent-id 변경 가능함(2018.03.15)
	});
	if (!$LEM) throw new Error(NS+'$LEM is required!');

	
	/** ****************************************************************************************************************
	 *  Public Common Interface Exported.
	 ** ****************************************************************************************************************/
		//! prepare instance.
	const thiz = options||{};
	const ERR_NOT_IMPLEMENTED = (id) => {throw new Error(`NOT_IMPLEMENTED - ${NS}:${JSON.stringify(id)}`)};

	//! SAVE PROPERTY.
	thiz.$LEM 			= $LEM;							// Save Local LEM.

	//! public exported functions (INFO! bind final function at bottom of this)
	thiz.do_prepare     = ERR_NOT_IMPLEMENTED;          // prepare dummy $node with new id. (created_at := 0, deleted_at=now)
	thiz.do_create      = ERR_NOT_IMPLEMENTED;          // create $node with given id (created_at := now, updated_at := now, deleted_at=0).
	thiz.do_clone       = ERR_NOT_IMPLEMENTED;          // clone node itself.
	thiz.do_update      = ERR_NOT_IMPLEMENTED;          // update $node by id. (updated_at := now)
	thiz.do_increment   = ERR_NOT_IMPLEMENTED;          // increment by count ex) stock = stock + 2.
	thiz.do_read        = ERR_NOT_IMPLEMENTED;          // read-back $node by id.
	thiz.do_delete      = ERR_NOT_IMPLEMENTED;          // mark deleted by id (deleted_at := now)
	thiz.do_destroy     = ERR_NOT_IMPLEMENTED;          // destroy $node by id (real deletion).
	thiz.do_search      = ERR_NOT_IMPLEMENTED;          // search items by query.

	//! events functions.
	thiz.on_records     = ERR_NOT_IMPLEMENTED;          // records events.

	//! notify functions.
	thiz.do_notify      = $LEM.do_notify;                // delegated notify event.
	thiz.do_subscribe   = $LEM.do_subscribe;             // delegated notify event.

	//! critical functions.
	thiz.do_initialize  = ERR_NOT_IMPLEMENTED;           // initialize environment based on configuration.
	thiz.do_terminate   = ERR_NOT_IMPLEMENTED;           // terminate environment based on configuration.
	thiz.do_test_self   = ERR_NOT_IMPLEMENTED;           // execute self test self-test..

	//! register as service.
	_$(name, thiz);

	/** ****************************************************************************************************************
	 *  Local Configuration.
	 ** ****************************************************************************************************************/
	//! prepare the chained `that`
	const prepare_chain = (id, $node, mode) => {
		return $LEM.do_prepare_chain(id, $node, mode);
	};

	//! finish/clenaup the chained `that`
	const finish_chain = that => {
		return $LEM.do_finish_chain(that);
	};

	//! read original node as _node.
	const my_read_origin_node = (that) => {
		const ID = that._id;
		_log(NS, `my_read_origin_node(${ID})....`);
		if (!ID) return Promise.reject(new Error('ID is required!'));
		return prepare_chain(ID, null, 'read')
			.then($LEM.do_read)
			.then(_ => {
				const node = _._node;
				that._node = node;
				return that;
			})
			.catch(e => {
				const message = e && e.message || ''+e;
				if (message.startsWith('404 NOT FOUND')){
					that._node = null;
					return that;
				}
				throw e;
			})
	}

	//! prepare node with id.
	const my_prepare_origin_node = (that) => {
		const ID = that._id;
		_log(NS, `my_prepare_origin_node(${ID})....`);
		if (!ID) return Promise.reject(new Error('ID is required!'));
		return prepare_chain(ID, null, 'prepare')
			.then(that => {
				that._force_create = true;			// force to create.
				return that;
			})
			.then($LEM.do_prepare)
			.then(_ => {
				const node = _._node;
				that._node = node;
				return that;
			})
	}

	//! throw error if node is invalid.
	const my_validate_origin = (that) => {
		const ID = that._id;
		_log(NS, `my_validate_origin(${ID})....`);
		const node = that._node;
		if (!node) return Promise.reject(new Error('404 NOT FOUND. ID:'+ID))
		return that;
	}

	//! throw error if node was deleted.
	const my_validate_deleted = (that) => {
		const ID = that._id;
		_log(NS, `my_validate_deleted(${ID})....`);
		const node = that._node||that;
		_log(NS, '> node=', node);
		if (node.deleted_at) return Promise.reject(new Error('404 NOT FOUND. deleted_at:'+node.deleted_at))
		return that;
	}

	//! throw error if node is invalid.
	const my_filter_different = (that) => {
		const ID = that._id;
		_log(NS, `my_filter_different(${ID})....`);
		const node = that._node;
		if (node){
			//! filter out only the updated fields.
			Object.keys(that).reduce((that, key)=>{
				if (key.startsWith('_')||key.startsWith('$')) return that;
				const org = node[key];
				const val = that[key];
				if (val === org){
					delete that[key];
				}
				return that;
			}, that);
		}
		return that;
	}
	
	/** ****************************************************************************************************************
	 *  Main Implementation.
	 ** ****************************************************************************************************************/
	//! Node의 상태에 따라 다르게 작동할 수 있으며, 기본적으로 노드의 생성을 보장해 줌.
	// if no exist -> create new one.
	// if exists -> update fields.
	// if deleted -> undelete, and update fields.
	thiz.do_create = (_id, $params) => {
		const id = (_id && typeof _id === 'object' ? _id._id : _id);
		if (!id) return Promise.reject(new Error('id is required!'));
		_log(NS, 'do_create()... id=', id);
		//! prepare -> save
		return prepare_chain(_id, $params, 'create')
			.then(my_read_origin_node)
			.then(that => {
				const node = that._node;
				if (!node || node.deleted_at){					// no exists or deleted.
					return my_prepare_origin_node(that)			// force to be prepared state.
				}
				that._is_update = true;							// use update mode.
				return my_filter_different(that);				// filter out the updated fields.
			})
			.then(my_validate_origin)							// check exists
			.then(that => that._is_update ? $LEM.do_update(that) : $LEM.do_create(that))
			.then(finish_chain)
	};
	
	//! 단순 필드의 업데이트만 지원하며
	// if no/deleted -> 404 error.
	// if exists -> update fields. 
	thiz.do_update = (_id, $params) => {
		const id = (_id && typeof _id === 'object' ? _id._id : _id);
		if (!id) return Promise.reject(new Error('id is required!'));
		_log(NS, 'do_update()... id=', id);
		// _log(NS, '> params=', $params);
		return prepare_chain(_id, $params, 'update')
			.then(my_read_origin_node)				// read origin
			.then(my_validate_origin)				// check exists
			.then(my_validate_deleted)				// check deleted.
			.then(my_filter_different)				// only diff.
			.then($LEM.do_update)					// now update node.
			.then(finish_chain)
	};

	//! 필드 값을 증분에 따라 업데이트 시킴.
	thiz.do_increment = (_id, $params) => {
		const id = (_id && typeof _id === 'object' ? _id._id : _id);
		if (!id) return Promise.reject(new Error('id is required!'));
		_log(NS, 'do_increment()... id=', id);
		// make copy of node with fields filtering.
		return prepare_chain(_id, $params, 'increment')
			.then($LEM.do_increment)
			.then(finish_chain)
	};

	//! Node 값 읽음.
	// if no/deleted -> 404 error.
	thiz.do_read = (_id, $params) => {
		const id = (_id && typeof _id === 'object' ? _id._id : _id);
		if (!id) return Promise.reject(new Error('id is required!'));
		// _log(NS, 'do_read()... id=', id);
		// use $params as field projection.
		return prepare_chain(_id, $params, 'read')
			.then($LEM.do_read)
			.then(my_validate_deleted)
			.then(finish_chain)
	};

	//! Node 값 삭제 처리.
	// if no/deleted -> 404 error.
	thiz.do_delete = (_id, $params) => {
		const id = (_id && typeof _id === 'object' ? _id._id : _id);
		if (!id) return Promise.reject(new Error('id is required!'));
		// _log(NS, 'do_delete()... id=', id);
		return prepare_chain(_id, $params, 'delete')
			.then($LEM.do_delete)
			.then(finish_chain)
	};

	thiz.do_search = (_id, $params) => {
		const id = (_id && typeof _id === 'object' ? _id._id : _id);
		_log(NS, 'do_search()... id=', id);
		return prepare_chain(_id, $params, 'search')
			.then($LEM.do_search)
			.then(finish_chain)
	};	

	thiz.on_records = ($params) => {
		_log(NS, 'on_records()... records.len=', $params&&$params.records&&$params.records.length||0);
		return $LEM.on_records($params||{});
	};

	thiz.do_initialize = ($params) => {
		_log(NS+'do_initialize()... params=', $U.json($params));
		return $LEM.do_initialize($params||{});
	};

	thiz.do_terminate = ($params) => {
		_log(NS+'do_terminate()... params=', $U.json($params));
		return $LEM.do_terminate($params||{});
	};

	//! returns.
	return thiz;
});