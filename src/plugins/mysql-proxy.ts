/**
 * MySQL Proxy Service Exports
 * - proxy call to mysql proxy.
 *
 *
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
import { EnginePluggable, EnginePluginBuilder } from '../common/types';
import httpProxy, { HttpProxy } from './http-proxy';

export interface MysqlProxy extends EnginePluggable {
    /**
     * get the current endpoint address.
     */
    endpoint: () => string;

    do_get_last_id: (type: any) => any;
    do_get_next_id: (type: any) => any;
    do_create_id_seq: (type: any, nextval: any) => any;
    do_delete_id_seq: (type: any) => any;
    do_promise_query: (query: any, values: any) => any;
    do_save_node: (table_name: any, node: any, $insert_set: any) => any;
    do_save_node_hist: (table_name: any, node: any, hist_cols: any) => any;
    do_read_node: (table_name: any, node: any) => any;
    do_test_self: (that?: any) => any;
}

const maker: EnginePluginBuilder<MysqlProxy> = (_$, name, options) => {
    name = name || 'MS';

    const $U = _$.U; // re-use global instance (utils).

    if (!$U) throw new Error('$U is required!');

    const NS = $U.NS(name, 'blue'); // NAMESPACE TO BE PRINTED.

    //! load common functions
    const _log = _$.log;
    const _inf = _$.inf;
    const _err = _$.err;

    /** ****************************************************************************************************************
     *  Internal Proxy Function
     ** ****************************************************************************************************************/
    const ENDPOINT = $U.env('MS_ENDPOINT', typeof options == 'string' ? options : '');
    const $proxy = function() {
        if (!ENDPOINT) throw new Error('env:MS_ENDPOINT is required!');
        const SVC = 'X' + name;
        const $SVC = _$(SVC, null as HttpProxy);
        return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT); // re-use proxy by name
    };

    /** ****************************************************************************************************************
     *  Main Implementation.
     ** ****************************************************************************************************************/
    const thiz = new (class implements MysqlProxy {
        public name = () => `mysql-proxy:${name}`;
        public endpoint = () => ENDPOINT;

        /**
         * Read last inserted id of type-name.
         *
         * @param type
         * @returns {Promise.<*>}
         */
        public do_get_last_id(type: any) {
            // _log(NS, `do_get_last_id(${type})...`);
            return $proxy()
                .do_get(type, '0', 'last-id')
                .then((_: any) => _.result);
        }

        /**
         * Get Next Generated ID (or Sequence) by type-name
         *
         * @param type
         * @returns {Promise.<*>}
         */
        public do_get_next_id(type: any) {
            // _log(NS, `do_get_next_id(${type})...`);
            return $proxy()
                .do_get(type, '0', 'next-id')
                .then((_: any) => _.result);
        }

        /**
         * Create Sequence Table with next-val
         *
         * @param type
         * @param nextval
         * @returns {Promise.<*>}
         */
        public do_create_id_seq(type: any, nextval: any) {
            const $param = nextval ? { next: nextval } : null;
            return $proxy()
                .do_get(type, '0', 'create-id', $param)
                .then((_: any) => _.result);
        }

        /**
         * Delete Sequence Table.
         *
         * @param type
         * @returns {Promise.<*>}
         */
        public do_delete_id_seq(type: any) {
            return $proxy()
                .do_get(type, '0', 'delete-id')
                .then((_: any) => _.result);
        }

        /**
         * Execute Query directly.
         *
         * @param query
         * @param values
         * @returns {*}
         */
        public do_promise_query(query: any, values: any) {
            if (!query) return Promise.reject(new Error(NS + 'parameter:query is required'));
            if (values && !Array.isArray(values))
                return Promise.reject(new Error(NS + 'parameter:values should be array!'));

            //! prepare params
            const $param = { query, values };

            return $proxy()
                .do_get('#', '0', 'query', $param)
                .then((_: any) => _.result);
        }

        /**
         * 해당 노드(여기서 노드는 하나의 인스턴스나 오브젝트)를 저장[업데이트(update) 또는 새로추가(insert)]한다
         * - 노드를 해당 테이블에 저장한다. (by using Promise)
         *
         * @param table_name
         * @param node
         * @param $insert_set (optional) only if insert case.
         */
        public do_save_node(table_name: any, node: any, $insert_set: any) {
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
        public do_save_node_hist(table_name: any, node: any, hist_cols: any) {
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
        public do_read_node(table_name: any, node: any) {
            //TODO - IMPLEMENT.
            return Promise.reject(new Error('404 NOT FOUND - NOT IMPLEMENTED!'));
        }

        public do_test_self(that: any) {
            that = that || {};
            _log(NS, '- do_test_self()... param=', that);

            const $param = Object.assign({}, that || {});
            // $param.$type = type;
            return $proxy()
                .do_get('#', '0', 'test-self', $param)
                .then((_: any) => _.result);
        }
    })();

    //! create & register service.
    return _$(name, thiz);
};

export default maker;
