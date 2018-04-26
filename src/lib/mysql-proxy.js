/**
 * MySQL Proxy Service Exports
 * - proxy call to mysql proxy.
 *
 * 
 * 
 * author: Steve Jung <steve@lemoncloud.io>
 * date : 2018-04-03
 *
 * Copyright (C) 2018 LemonCloud Co Ltd. - All Rights Reserved.
 */
module.exports = (function (_$, name) {
	"use strict"
	name = name || 'MS';

	const $U = _$.U;                                // re-use global instance (utils).

	if (!$U) throw new Error('$U is required!');

	const NS = $U.NS(name,  "blue");				// NAMESPACE TO BE PRINTED.

	//! load common functions
	const _log = _$.log;
	const _inf = _$.inf;
	const _err = _$.err;

	//! prepare instance.
	var thiz = {};
	thiz.do_get_last_id = do_get_last_id;
	thiz.do_get_next_id = do_get_next_id;
	thiz.do_create_id_seq = do_create_id_seq;
	thiz.do_delete_id_seq = do_delete_id_seq;
	thiz.do_promise_query = do_promise_query;
	thiz.do_save_node = do_save_node_async;
	thiz.do_save_node_hist = do_save_node_hist_async;
	thiz.do_read_node = do_read_node_async;

	thiz.do_test_self = param => param;

	//! register service.
	_$(name, thiz);


	/** ****************************************************************************************************************
	 *  Internal Proxy Function
	 ** ****************************************************************************************************************/
	const ENDPOINT = $U.env('MS_ENDPOINT');
	const httpProxy = require('./http-proxy');
	const $proxy = function(){
		if (!ENDPOINT) throw new Error('env:MS_ENDPOINT is required!');
		const SVC = 'X'+name;
        const $SVC = _$(SVC);
		return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT);		// re-use proxy by name
	}


	/** ****************************************************************************************************************
	 *  Main Implementation.
	 ** ****************************************************************************************************************/
	//! local configuration.
	const _is_dev = !!$U.is_dev;

	/**
	 * Read last inserted id of type-name.
	 *
	 * @param type
	 * @returns {Promise.<*>}
	 */
	function do_get_last_id(type) {
		return $proxy().do_get(type, '0', 'last-id')
			.then(_ => _.result);
	}

	/**
	 * Get Next Generated ID (or Sequence) by type-name
	 *
	 * @param type
	 * @returns {Promise.<*>}
	 */
	function do_get_next_id(type) {
		return $proxy().do_get(type, '0', 'next-id')
			.then(_ => _.result);
	}

	/**
	 * Create Sequence Table with next-val
	 *
	 * @param type
	 * @param nextval
	 * @returns {Promise.<*>}
	 */
	function do_create_id_seq(type, nextval) {
		const $param = nextval ? {next:nextval} : null;
		return $proxy().do_get(type, '0', 'create-id', $param)
			.then(_ => _.result);
	}

	/**
	 * Delete Sequence Table.
	 *
	 * @param type
	 * @returns {Promise.<*>}
	 */
	function do_delete_id_seq(type) {
		return $proxy().do_get(type, '0', 'delete-id')
			.then(_ => _.result);
	}

	/**
	 * Execute Query directly.
	 *
	 * @param query
	 * @param values
	 * @returns {*}
	 */
	function do_promise_query(query, values) {
		if (!query) return Promise.reject(new Error(NS + 'parameter:query is required'));
		if (values && !Array.isArray(values)) return Promise.reject(new Error(NS + 'parameter:values should be array!'));

		//! prepare params
		const $param = {query, values};

		return $proxy().do_get('#', '0', 'query', $param)
			.then(_ => _.result);
	}

	/**
	 * 해당 노드(여기서 노드는 하나의 인스턴스나 오브젝트)를 저장[업데이트(update) 또는 새로추가(insert)]한다
	 * - 노드를 해당 테이블에 저장한다. (by using Promise)
	 *
	 * @param table_name
	 * @param node
	 * @param $insert_set (optional) only if insert case.
	 */
	function do_save_node_async(table_name, node, $insert_set) {
		//TODO - IMPLEMENT.
		return Promise.reject(new Error('404 NOT FOUND - NOT IMPLEMENTED!'));
	}

	/**
	 * save_node with history (by using Promise)
	 *
	 * @param table_name
	 * @param node
	 * @param hist_cols
	 * @returns {null}
	 */
	function do_save_node_hist_async(table_name, node, hist_cols) {
		//TODO - IMPLEMENT.
		return Promise.reject(new Error('404 NOT FOUND - NOT IMPLEMENTED!'));
	}


	/**
	 * Read Target Node information via MySQL.
	 *
	 * @param table_name    target table-name.
	 * @param node          {id,...}
	 * @returns {*}
	 */
	function do_read_node_async(table_name, node) {
		//TODO - IMPLEMENT.
		return Promise.reject(new Error('404 NOT FOUND - NOT IMPLEMENTED!'));
	}

	//! returns.
	return thiz;
});