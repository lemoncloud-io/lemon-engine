/**
 * ElasticSearch Proxy Service Exports
 * - proxy call to elastic service.
 *
 *
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
import { EnginePluggable, EnginePluginBuilder } from '../common/types';
import httpProxy, { HttpProxy } from './http-proxy';

export interface Elastic6Proxy extends EnginePluggable {
    /**
     * get the current endpoint address.
     */
    endpoint: () => string;

    do_create_index_type: (index: string, type: string, options?: any) => any;
    do_delete_index_type: (index: string, type: string, options?: any) => any;
    do_create_item: (index: string, type: string, id: any, data: any) => any;
    do_push_item: (index: string, type: string, data: any, id?: any) => any;
    do_update_item: (index: string, type: string, id: any, data: any) => any;
    do_get_item: (index: string, type: string, id: any, data?: any) => any;
    do_delete_item: (index: string, type: string, id: any) => any;
    do_search_item: (index: string, type: string, param: any) => any;
    do_test_self: (that?: any) => any;
}

const maker: EnginePluginBuilder<Elastic6Proxy> = (_$, name, options) => {
    name = name || 'ES6';

    const $U = _$.U; // re-use global instance (utils).
    const $_ = _$._; // re-use global instance (_ lodash).

    if (!$U) throw new Error('$U is required!');
    if (!$_) throw new Error('$_ is required!');

    const NS = $U.NS(name, 'cyan'); // NAMESPACE TO BE PRINTED.

    //! load common functions
    const _log = _$.log;
    const _inf = _$.inf;
    const _err = _$.err;

    /** ****************************************************************************************************************
     *  Internal Proxy Function
     ** ****************************************************************************************************************/
    const ENDPOINT = $U.env('ES6_ENDPOINT', typeof options == 'string' ? options : '');
    const $proxy = function(): HttpProxy {
        if (!ENDPOINT) throw new Error('env:ES6_ENDPOINT is required!');
        const SVC = 'X' + name;
        const $SVC = _$(SVC, null as HttpProxy);
        return $SVC ? $SVC : (httpProxy(_$, SVC, ENDPOINT) as HttpProxy); // re-use proxy by name
    };

    /** ****************************************************************************************************************
     *  Main Implementation.
     ** ****************************************************************************************************************/
    const thiz = new (class implements Elastic6Proxy {
        public name = () => `elastic6-proxy:${name}`;
        public endpoint = () => ENDPOINT;

        /**
         * Create index with document initialization.
         *
         * @param index     - ES index.
         * @param type      - document type of index
         * @param options   - options of document.
         * @returns {Promise.<*>}
         */
        public do_create_index_type(index: string, type: string, options: any) {
            if (!index) return Promise.reject(new Error(NS + 'index is required'));
            // if (!type) return Promise.reject(new Error(NS + 'type is required'));

            const param: any = null;
            const $param = Object.assign({}, param || {});
            // $param.$type = type;		// must be ''
            return $proxy()
                .do_post(index, '0', 'create-index', $param, options)
                .then((_: any) => _.result);
        }

        /**
         * delete target index.
         *
         * @param {*} index 		index name
         * @param {*} type 			(optional) type
         * @param {*} options 		(optional) options.
         */
        public do_delete_index_type(index: string, type: string, options: any) {
            if (!index) return Promise.reject(new Error(NS + 'index is required'));
            // if (!type) return Promise.reject(new Error(NS + 'type is required'));

            const param: any = null;
            const $param = Object.assign({}, param || {});
            // $param.$type = type;		// must be ''
            return $proxy()
                .do_post(index, '0', 'delete-index', $param, options)
                .then((_: any) => _.result);
        }

        //! create new document.
        public do_create_item(index: string, type: string, id: any, data: any) {
            if (!index) return Promise.reject(new Error(NS + 'parameter:index is required'));
            if (!type) return Promise.reject(new Error(NS + 'parameter:type is required'));
            if (!id) return Promise.reject(new Error(NS + 'parameter:id is required'));
            if (!data) return Promise.reject(new Error(NS + 'parameter:data is required'));

            const options: any = null; // optional values.
            const $param = Object.assign({}, options || {});
            $param.$type = type;
            return $proxy()
                .do_post(index, id, undefined, $param, data)
                .then((_: any) => _.result);
        }

        //! push new document. (if without id)
        public do_push_item(index: string, type: string, data: any, id: any) {
            if (!index) return Promise.reject(new Error(NS + 'parameter:index is required'));
            if (!type) return Promise.reject(new Error(NS + 'parameter:type is required'));
            if (!data) return Promise.reject(new Error(NS + 'parameter:data is required'));

            const options: any = null; // optional values.
            const $param = Object.assign({}, options || {});
            $param.$type = type;
            id = id || ''; // make sure valid text.
            id = id === '' ? '0' : '';

            return $proxy()
                .do_post(index, id, 'push', $param, data)
                .then((_: any) => _.result);
        }

        //! update document only for specified data set.
        public do_update_item(index: string, type: string, id: any, data: any) {
            if (!index) return Promise.reject(new Error(NS + 'parameter:index is required'));
            if (!type) return Promise.reject(new Error(NS + 'parameter:type is required'));
            if (!id) return Promise.reject(new Error(NS + 'parameter:id is required'));
            if (!data) return Promise.reject(new Error(NS + 'parameter:data is required'));

            const options: any = null; // optional values.
            const $param = Object.assign({}, options || {});
            $param.$type = type;

            return $proxy()
                .do_put(index, id, undefined, $param, data)
                .then((_: any) => _.result);
        }

        //! Read document with projection (data)
        public do_get_item(index: string, type: string, id: any, data: any) {
            if (!index) return Promise.reject(new Error(NS + 'parameter:index is required'));
            if (!type) return Promise.reject(new Error(NS + 'parameter:type is required'));
            if (!id) return Promise.reject(new Error(NS + 'parameter:id is required'));
            // if (!data) return Promise.reject(new Error(NS + 'parameter:data is required'));

            const options: any = null; // optional values.
            const $param = Object.assign({}, options || {});
            $param.$type = type;

            return $proxy()
                .do_get(index, id, undefined, $param, data)
                .then((_: any) => _.result);
        }

        //! delete document.
        public do_delete_item(index: string, type: string, id: any) {
            if (!index) return Promise.reject(new Error(NS + 'parameter:index is required'));
            if (!type) return Promise.reject(new Error(NS + 'parameter:type is required'));
            if (!id) return Promise.reject(new Error(NS + 'parameter:id is required'));
            // if (!data) return Promise.reject(new Error(NS + 'parameter:data is required'));

            const options: any = null; // optional values.
            const $param = Object.assign({}, options || {});
            $param.$type = type;

            return $proxy()
                .do_delete(index, id, undefined, $param)
                .then((_: any) => _.result);
        }

        //! search item
        /**
         * Search Syntax. (Simple)
         *  - 기본적으로 'mini-language'를 그대로 지원하도록한다.
         *  - 입력의 파라마터의 키값은 테스트할 필드들이다.
         *  {"stock":">1"} => query_string : "stock:>1"
         *
         *  - 파라미터 예약:
         *      $query : ES _search 용 쿼리를 그대로 이용.
         *      $exist : 'a,!b,c' => a AND NOT b AND c 를 _exists_ 항목으로 풀어씀.
         *      $source : _source 항목에 포함될 내용. (undefined => _source:false)
         *      $limit : same as "size"
         *      $page : same as "from" / "size"  ($limit 를 ipp 으로 함축하여 이용).
         *
         *
         *  [Mini-Language]
         *  ```
         *  # find title field which contains quick or brown.
         *  title:(quick OR brown)
         *
         *  # not-null value.
         *  _exists_:title
         *
         *  # regular exp.
         *  name:/joh?n(ath[oa]n)/
         * ```
         *
         *
         *
         * 참고: https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-query-string-query.html#query-string-syntax
         * 참고: http://okfnlabs.org/blog/2013/07/01/elasticsearch-query-tutorial.html
         *
         * @returns {Promise.<*>}
         */
        public do_search_item(index: string, type: string, param: any) {
            if (!index) return Promise.reject(new Error(NS + 'parameter:index is required'));
            // if (!type) return Promise.reject(new Error(NS + 'parameter:type is required'));
            // if (!id) return Promise.reject(new Error(NS + 'parameter:id is required'));
            if (!param) return Promise.reject(new Error(NS + 'parameter:param is required'));

            const $param = Object.assign({}, param || {});
            $param.$type = type; //TODO:WARN! conflict with 'type' field.
            return $proxy()
                .do_get(index, '', undefined, $param)
                .then((_: any) => _.result);
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
