/**
 * # messages-service
 *  - id/type/name 를 기본으로 작동하는 노드 처리 엔진.
 * 
 * Messages
 * - 메세지 메타 정보 저장.
 *
 * ## 요구사항
 * - see README.md.
 *
 * 
 * ------------------------------------------
 * ## 스키마 구조
 *  - 주의! Name 앞에 '-' 이 붙어 있으면 삭제된 속성!.
 * Index	Name	    Type	    Comment
 * PK	    id	        Integer	    고유 ID (자동생성)
 * PK	    type	    String	    데이터 타입
 * 		    parent	    Integer	    부모  ID.
 * 		    name	    String	    type내에서 고유한 값 (see refid)
 * 	    	group	    Integer	    그룹 ID.
 * 	    	refid	    String	    := MD5(type+":"+name)
 * 			nick		String		표시할 이름.
 * 			stereo 		String		같은 type에서의 스테레오 타입(예: User내에서 email/hphone등).
 * 
 * 
 * 
 * author: Steve Jung <steve@lemoncloud.io>
 * date : 2018-03-01
 *
 * Copyright (C) 2018 LemonCloud Co Ltd. - All Rights Reserved.
 */
module.exports = (function (_$, name, options) {
	"use strict";
	name = name || 'MMS';								// global service name.

	// data properties.
	const FIELDS = [
		//! core properties.
		'id', 'type', 'parent', 'name', 'group', 'refid', 'nick', 'stereo',
		//! common properties.
		'message', 'description', 'image', 'source', 'target', 'state',
		//! extended properties.
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

	// load core-service with parameters.
	const $LEM = LEM(_$, '_'+name, {
		ID_TYPE     : 'LemonMessagesSeq',			// WARN! '#' means no auto-generated id.
		ID_NEXT     : 1000, 
		FIELDS      : FIELDS,
		DYNA_TABLE  : 'Messages',
		REDIS_PKEY  : 'CMMS',
		ES_INDEX    : 'messages-v1',				// ES Index Name. (//TODO - dev/prod index)
		ES_TYPE     : 'messages',					//TODO:0315 - ES 데이터를 같은 인덱스 내에서, type별로 나눠서 저장.
		ES_FIELDS   : ES_FIELDS,
		NS_NAME     : name,                         // Notify Service Name. (null means no notifications)
		ES_MASTER	: 1,							// MASTER NODE.
		CLONEABLE   : true,                         // 복제 가능하며, parent/cloned 필드를 지원함. (Core 에만 세팅!)
		PARENT_IMUT : false,						// parent-id 변경 가능함(2018.03.15)
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
	const prepare_chain = (id, $node, mode) => {
		return $LEM.do_prepare_chain(id, $node, mode);
	};

	const finish_chain = that => {
		return $LEM.do_finish_chain(that);
	};

	const calculate_refid = that => {
		const type = (''+that.type).trim();
		const name = (''+that.name).trim();
		
		const str = (type+':'+name).toLowerCase();
		const refid2 = 'MD5' + $U.md5(str);
		return refid2;
	}
	thiz.calculate_refid = calculate_refid;
	

	const my_chain_auto_update_refid = that => {
		const node = that._node||{};
		// _log(NS, 'my_chain_update_refid().... ');
		// _log(NS, '> refid.node =', $U.json(node));

		const ID = that._id || node.id;
		const refid = node.refid;
		const type = that.type || node.type ||'';
		const name = that.name || node.name ||'';
		
		const str = (type.trim()+':'+name.trim()).toLowerCase();
		const refid2 = str == ':' ? '' : calculate_refid({type:type, name:name});
		
		if (refid2 && refid != refid2){
			_inf(NS, '>> refid := ', refid2, ' (', str, ')');
			if (!node.id){				// must be empty node. then returns refid.
				that.refid = refid2;
			} else {
				//! call update.
				return prepare_chain(node.id, {refid:refid2}, 'update')
					.then($LEM.do_update)
					.then(finish_chain)
					.then(() => that)
			}
		}
		return that;
	}

	/** ****************************************************************************************************************
	 *  Main Implementation.
	 ** ****************************************************************************************************************/
	thiz.do_prepare = (_id, $params) => {
		const id = (_id && typeof _id === 'object' ? _id._id : _id);
		_log(NS, 'do_prepare()... id=', id);
		//WARN! - only prepare could have null id.
		// if (!id) return Promise.reject(new Error('id is required!'));
		//! prepare
		return prepare_chain(_id, $params, 'prepare')
			.then($LEM.do_prepare)
			.then(finish_chain)
	};

	thiz.do_create = (_id, $params) => {
		const id = (_id && typeof _id === 'object' ? _id._id : _id);
		if (!id) return Promise.reject(new Error('id is required!'));
		_log(NS, 'do_create()... id=', id);
		//! prepare -> save
		return prepare_chain(_id, $params, 'create')
			.then(that => {					//! VALIDATE INPUT PARAMETERS.
				// _log(NS, '> create.that =', that);
				if (!that.type) return Promise.reject(new Error('type is required!'));
				if (!that.name) return Promise.reject(new Error('name is required!'));
				return that;
			})
			.then(my_chain_auto_update_refid)
			.then($LEM.do_create)
			.then(finish_chain)
	};

	//! refid 로 해당 노드를 찾아냄.
	//WARN! - 만일 해당 노드가 없을 경우, 자동 생성은 안하게는게 좋음 (이유: 동시에 호출할 경우 중복 생성 가능성 높음)
	thiz.do_search_refid = (that) => {
		const refid = that.refid;
		if (!refid) return Promise.reject(new Error('refid is required!'));
		return $LEM.do_search(0, {refid:refid})
			.then(_ => {
				const list = _.list||[];
				if (list.length > 0){
					return list[0];
				}
				return Promise.reject(new Error('404 NOT FOUND - refid:'+refid));
			})
	}

	//! refid를 활용하여, 중복 생성을 막는다.
	thiz.do_create_safe = (_id, $params) => {						// create by refid.
		const id = (_id && typeof _id === 'object' ? _id._id : _id);
		if (id) return Promise.reject(new Error('id is invalid'));
		_log(NS, 'do_create_safe()... id=', id);
		//! prepare -> save
		return prepare_chain(_id, $params, 'create')
			.then(that => {					//! VALIDATE INPUT PARAMETERS.
				// _log(NS, '> create.that =', that);
				if (!that.type) return Promise.reject(new Error('type is required!'));
				if (!that.name) return Promise.reject(new Error('name is required!'));
				return that;
			})
			.then(my_chain_auto_update_refid)
			.then(that => {
				const name =''+(that.name||'');
				//! new ID if name is #.
				if (name.startsWith('#')) {
					return $LEM.do_prepare(0)
						.then(_ => {
							_inf(NS, '! prepared-id =', _._id);
							that._id = _._id;			// override _id.
							that._prepared = 1;
							return that;
						})
				}

				//! search by ref-id.
				const refid = that.refid;
				if (!refid) return Promise.reject(new Error('refid is invalid'));
				return $LEM.do_search(0, {refid:refid})
					.then(_ => {
						const list = _.list||[];
						if (list.length < 1){
							return $LEM.do_prepare(0)
								.then(_ => {
									_inf(NS, '! prepared-id =', _._id);
									that._id = _._id;			// override _id.
									that._prepared = 1;
									return that;
								})
						} else if (list.length === 1){
							that._id = list[0].id;			// override _id.
						} else {
							_err(NS, 'TOO MANY RESULT BY REFID:'+refid+' = ', list);
							return Promise.reject(new Error('Invalid refid@1:' + refid));
						}
						return that;
					})
			})
			.then((that) => {
				return (that._id && !that._prepared) ? $LEM.do_update(that) : $LEM.do_create(that);
			})
			.then(that => {
				that.id = that._id;
				return that;
			})
			.then(finish_chain)
	};

	thiz.do_clone = (_id, $params) => {
		const id = (_id && typeof _id === 'object' ? _id._id : _id);
		if (!id) return Promise.reject(new Error('id is required!'));
		_log(NS, 'do_clone()... id=', id);
		//! clone 
		return prepare_chain(_id, $params, 'clone')
			.then($LEM.do_clone)
			.then(my_chain_auto_update_refid)
			.then(finish_chain)
	};

	thiz.do_update = (_id, $params) => {
		const id = (_id && typeof _id === 'object' ? _id._id : _id);
		if (!id) return Promise.reject(new Error('id is required!'));
		_log(NS, 'do_update()... id=', id);
		// _log(NS, '> params=', $params);
		// make copy of node with fields filtering.
		return prepare_chain(_id, $params, 'update')
			.then(that => {					//! VALIDATE INPUT PARAMETERS.
				// _log(NS, '> update.that =', that);
				if (that.type) return Promise.reject(new Error('type is imutable'));
				return that;
			})
			.then($LEM.do_update)
			.then(my_chain_auto_update_refid)
			.then(finish_chain)
	};

	thiz.do_increment = (_id, $params) => {
		const id = (_id && typeof _id === 'object' ? _id._id : _id);
		if (!id) return Promise.reject(new Error('id is required!'));
		_log(NS, 'do_increment()... id=', id);
		// make copy of node with fields filtering.
		return prepare_chain(_id, $params, 'increment')
			.then(that => {					//! VALIDATE INPUT PARAMETERS.
				// _log(NS, '> that =', that);
				if (!that.type) return Promise.reject(new Error('type is imutable'));
				return that;
			})
			.then($LEM.do_increment)
			.then(finish_chain)
	};

	thiz.do_read = (_id, $params) => {
		const id = (_id && typeof _id === 'object' ? _id._id : _id);
		if (!id) return Promise.reject(new Error('id is required!'));
		// _log(NS, 'do_read()... id=', id);
		// use $params as field projection.
		return prepare_chain(_id, $params, 'read')
			.then($LEM.do_read)
			.then(finish_chain)
	};

	thiz.do_delete = (_id, $params) => {
		const id = (_id && typeof _id === 'object' ? _id._id : _id);
		if (!id) return Promise.reject(new Error('id is required!'));
		// _log(NS, 'do_delete()... id=', id);
		return prepare_chain(_id, $params, 'delete')
			.then($LEM.do_delete)
			.then(finish_chain)
	};

	thiz.do_destroy = (_id, $params) => {
		const id = (_id && typeof _id === 'object' ? _id._id : _id);
		if (!id) return Promise.reject(new Error('id is required!'));
		_log(NS, 'do_destroy()... id=', id);
		return prepare_chain(_id, $params, 'destroy')
			.then($LEM.do_destroy)
			.then(finish_chain)
	};

	thiz.do_search = (_id, $params) => {
		const id = (_id && typeof _id === 'object' ? _id._id : _id);
		_log(NS, 'do_search()... id=', typeof _id, id);
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

	thiz.do_test_self = (that, $params) => {
		_log(NS+'do_test_self()... params=', $U.json($params));
		// return $LEM.do_test_self($params||{});
		return do_test_self(that, $params);
	};

	function do_test_self (that, $params) {
		// const that = $U.extend({}, $params);
		_log(NS, '- do_test_self()... that=', $U.json(that));
		let chain = $U.promise(that);

		//! STEP1. Create Item. 
		chain = chain.then(that => {
			_log(NS,'------------- STEP1 ');
			const $N = Object.assign({_id:0, type:'TEST', name:'test-name', nick:'hello'
					, description:'test description (invisible in ES)'
					, meta:'{"hello":1}'}, $params||{});
			if (that.id !== undefined) $N._id = that.id;
			_log(NS,'! ID =', $N._id);

			// runs prepare/create.
			return Promise.resolve($N)
				.then(_ => {
					_log(NS,'======== PREPARE');
					return !_._id ? thiz.do_prepare(0) : _;
				}).then(_ => {
					_log(NS,'======== CREATE');
					_log(NS, '> do_create =', $U.json(_));
					const ID = _._id;
					return thiz.do_create(ID, $N).
						then(_ => {
							_log(NS,'======== VALIDATE-CREATE');
							_log(NS, '>> do_create = ', $U.json(_));
							const node = _._node||{};
							const ID = node.id;
							const ok = node.created_at && node.updated_at && !node.deleted_at && node.id === ID;
							ok && _log(NS, '>> CREATE TEST RESULT: OK');
							!ok && _err(NS, '>> CREATE TEST RESULT: FAIL');
							if (!ID) throw new Error('invalid id after creation');
							return _;
						});
				}).then(_ => {
					_log(NS,'======== UPDATE');
					_log(NS, '> do_update =', $U.json(_));
					const node = _._node||{};
					const ID = node.id;
					const node2 = {name: (node.name||'!')+'+'};
					return thiz.do_update(ID, node2).
						then(_ => {
							_log(NS,'======== VALIDATE-UPDATE');
							_log(NS, '>> do_update = ', $U.json(_));
							return _;
						});
				}).catch(e => {
					_err(NS, 'ERR =', e);
					const message = e.message||'';
					if(message.indexOf('INVALID STATE.') > 0){
						_log(NS,'======== DELETE');
						const ID = $N._id;
						return thiz.do_delete(ID, $N).then(_ => {
							_log(NS, '>> do_delete = ', $U.json(_));
							// VALIDATE!
							const node = _._node||{};
							const ok = node.created_at && node.updated_at && node.deleted_at && node.id === ID;
							ok && _log(NS, '>> DELETE TEST RESULT: OK');
							!ok && _err(NS, '>> DELETE TEST RESULT: FAIL');
							return _;
						})
					}
					throw e;
				})
		});

		return chain;
	}


	//! returns.
	return thiz;
});