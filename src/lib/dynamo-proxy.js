/**
 * DynamoDB Proxy Service Exports
 * - proxy call to dynamo service.
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
	name = name || 'DS';

	const $U = _$.U;                                // re-use global instance (utils).
	const $_ = _$._;                             	// re-use global instance (_ lodash).

	if (!$U) throw new Error('$U is required!');
	if (!$_) throw new Error('$_ is required!');

	const NS = $U.NS(name, "magenta");		        // NAMESPACE TO BE PRINTED.

	//! load common functions
	const _log = _$.log;
	const _inf = _$.inf;
	const _err = _$.err;

	//! IGNORE all log function.
	// var _log = 0 ? _$.log : (()=>{});

	//! prepare instance.
	const thiz = {};

	//! table functions.
	thiz.do_create_table = do_create_table;
	thiz.do_delete_table = do_delete_table;
	thiz.do_list_tables = do_list_tables;

	//! item functions.
	thiz.do_create_item = do_create_item;
	thiz.do_get_item = do_get_item;
	thiz.do_delete_item = do_delete_item;
	thiz.do_update_item = do_update_item;
	thiz.do_increment_item = do_increment_item;

	//! test function.
	thiz.do_test_self = do_test_self;

	thiz.do_read_stream = do_read_stream;
	
	//! register service.
	_$(name, thiz);

	/** ****************************************************************************************************************
	 *  Internal Proxy Function
	 ** ****************************************************************************************************************/
	const PROXY = require('./http-proxy')(_$, 'X'+name, $U.env('DS_ENDPOINT'));


	/** ****************************************************************************************************************
	 *  Main Implementation.
	 ** ****************************************************************************************************************/
	/**
	 * Create Table by table-name
	 * see: http://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_CreateTable.html
	 *]
	 * @param table
	 * @param id_name
	 * @param id_type default 'Number'
	 * @returns {Promise.<*>}
	 */
	function do_create_table (table, id_name, id_type){
		if (!table) return Promise.reject(new Error(NS + 'parameter:table is required'));
		const $param = {idName:id_name,idType:id_type};
		return PROXY.do_get(table, '0', 'create-table', $param)
			.then(_ => _.result);
	}

	/**
	 * Delete the target table by Name.
	 *
	 * @param table
	 * @returns {*}
	 */
	function do_delete_table (table){
		if (!table) return Promise.reject(new Error(NS + 'parameter:table is required'));
		const $param = undefined;
		return PROXY.do_get(table, '0', 'delete-table', $param)
			.then(_ => _.result);
	}

	/**
	 * List Tables
	 *
	 * @param table table
	 * @param limit default 100
	 * @returns {Promise.<*>}
	 */
	function do_list_tables (table, limit){
		// if (!table) return Promise.reject(new Error(NS + 'parameter:table is required'));
		table = table||'#';						// prevent ''.
		const $param = {limit};
		return PROXY.do_get(table, '0', 'list-table', $param)
			.then(_ => _.result);
	}

	/**
	 * read stream buffer.
	 * 
	 * @param {*} param 
	 */
	function do_read_stream(param) {
		const $param = param||{};
		const table = $param.table;
		delete $param.table;
		return PROXY.do_get(table, '0', 'stream', $param)
			// .then(_ => _.result);					//WARN! pass the original body.
	}
	
	/**
	 * Create Item in Table
	 *
	 * example:
	 *  do_create_item('PetTable', 1, {name:'cat'})
	 *  do_create_item('PetTable', {id: 1}, {name:'cat'})
	 *
	 * @param table table-name.
	 * @param id    id of item.
	 * @param data  data as object.
	 */
	function do_create_item (table, id, data){
		if (!table) return Promise.reject(new Error(NS + 'parameter:table is required'));
		if (!id) return Promise.reject(new Error(NS + 'parameter:id is required'));
		if (!data) return Promise.reject(new Error(NS + 'parameter:data is required'));
		if (typeof data !== 'object') return Promise.reject(new Error(NS + 'parameter:data must be object'));

		//! additional parameters.
		const $param = {};

		//! decode idName, idType.
		if (id && typeof id === 'object'){
			const ID = id;
			const keys = Object.keys(ID);
			if (keys.length !== 1) return Promise.reject(new Error(NS + ':id is un-expected keys.'));
			const idName = keys.pop()||'';
			id = ID[idName];
			// _log(NS,'> idName =', idName,' id = ', id);
			$param.idName = idName;
		}

		return PROXY.do_post(table, id, undefined, $param, data)
			.then(_ => _.result);
	}

	/**
	 * Get Item from Table
	 *
	 * @param table
	 * @param id
	 * @returns {Promise.<*>}
	 */
	function do_get_item (table, id){
		if (!table) return Promise.reject(new Error(NS + 'parameter:table is required'));
		if (!id) return Promise.reject(new Error(NS + 'parameter:id is required'));

		//! additional parameters.
		const $param = {};

		//! decode idName, idType.
		if (id && typeof id === 'object'){
			const ID = id;
			const keys = Object.keys(ID);
			if (keys.length !== 1) return Promise.reject(new Error(NS + ':id is un-expected keys.'));
			const idName = keys.pop()||'';
			id = ID[idName];
			// _log(NS,'> idName =', idName,' id = ', id);
			$param.idName = idName;
		}

		return PROXY.do_get(table, id, undefined, $param)
			.then(_ => _.result);
	}

	/**
	 * Delete Item from Table
	 *
	 * @param table
	 * @param id
	 * @returns {Promise.<*>}
	 */
	function do_delete_item (table, id){
		if (!table) return Promise.reject(new Error(NS + 'parameter:table is required'));
		if (!id) return Promise.reject(new Error(NS + 'parameter:id is required'));

		//! additional parameters.
		const $param = {};

		//! decode idName, idType.
		if (id && typeof id === 'object'){
			const ID = id;
			const keys = Object.keys(ID);
			if (keys.length !== 1) return Promise.reject(new Error(NS + ':id is un-expected keys.'));
			const idName = keys.pop()||'';
			id = ID[idName];
			// _log(NS,'> idName =', idName,' id = ', id);
			$param.idName = idName;
		}

		return PROXY.do_delete(table, id, undefined, $param)
			.then(_ => _.result);
	}

	/**
	 * Update Item in Table
	 *
	 * @param table table-name.
	 * @param id    id of item.
	 * @param data  data as object.
	 * @param incset additional increment set.
	 * @returns {Promise.<*>}
	 */
	function do_update_item (table, id, data, incset){
		if (!table) return Promise.reject(new Error(NS + 'parameter:table is required'));
		if (!id) return Promise.reject(new Error(NS + 'parameter:id is required'));
		if (!data) return Promise.reject(new Error(NS + 'parameter:data is required'));
		if (typeof data !== 'object') return Promise.reject(new Error(NS + 'parameter:data must be object'));

		//! additional parameters.
		const $param = {};

		//! decode idName, idType.
		if (id && typeof id === 'object'){
			const ID = id;
			const keys = Object.keys(ID);
			if (keys.length !== 1) return Promise.reject(new Error(NS + ':id is un-expected keys.'));
			const idName = keys.pop()||'';
			id = ID[idName];
			// _log(NS,'> idName =', idName,' id = ', id);
			$param.idName = idName;
		}

		const $body = data||{};
		if(incset) $body.$I = incset;

		return PROXY.do_put(table, id, undefined, $param, $body)
			.then(_ => _.result);
	}


	/**
	 * Use Increment (+ operator) operation.
	 *
	 * @param table table-name.
	 * @param id    id of item.
	 * @param data  data as object.
	 * @param incset additional increment set.
	 * @returns {Promise.<*>}
	 */
	function do_increment_item (table, id, data, incset){
		if (!table) return Promise.reject(new Error(NS + 'parameter:table is required'));
		if (!id) return Promise.reject(new Error(NS + 'parameter:id is required'));
		if (!data) return Promise.reject(new Error(NS + 'parameter:data is required'));
		if (typeof data !== 'object') return Promise.reject(new Error(NS + 'parameter:data must be object'));

		//! additional parameters.
		const $param = {};

		//! decode idName, idType.
		if (id && typeof id === 'object'){
			const ID = id;
			const keys = Object.keys(ID);
			if (keys.length !== 1) return Promise.reject(new Error(NS + ':id is un-expected keys.'));
			const idName = keys.pop()||'';
			id = ID[idName];
			// _log(NS,'> idName =', idName,' id = ', id);
			$param.idName = idName;
		}

		const $body = data||{};
		if(incset) $body.$I = incset;

		return PROXY.do_put(table, id, 'increment', $param, $body)
			.then(_ => _.result);
	}

	/**
	 * Self Test Functions.
	 *
	 * @param param
	 */
	function do_test_self (param){
		const $param = param||{};
		return PROXY.do_get('#', '0', 'test-self', $param)
			.then(_ => _.result);
	}

	//! returns.
	return thiz;
});
