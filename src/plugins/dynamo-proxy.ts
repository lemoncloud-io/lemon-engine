/* eslint-disable prettier/prettier */
/**
 * DynamoDB Proxy Service Exports
 * - proxy call to dynamo service.
 *
 *
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
import { EngineCore, EnginePluggable, EnginePluginBuilder } from '../common/types';
import httpProxy from './http-proxy';

const maker: EnginePluginBuilder = function(_$: EngineCore, name?: string, options?: any): EnginePluggable {
    name = name || 'DS';

    const $U = _$.U; // re-use global instance (utils).
    const $_ = _$._; // re-use global instance (_ lodash).

    if (!$U) throw new Error('$U is required!');
    if (!$_) throw new Error('$_ is required!');

    const NS = $U.NS(name, 'magenta'); // NAMESPACE TO BE PRINTED.

    //! load common functions
    const _log = _$.log;
    const _inf = _$.inf;
    const _err = _$.err;

    //! IGNORE all log function.
    // var _log = 0 ? _$.log : (()=>{});

    //! prepare instance.
    const thiz = function(){} as EnginePluggable;

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
    const ENDPOINT = $U.env('DS_ENDPOINT');
    // const httpProxy = require('./http-proxy');
    const $proxy = function() {
        if (!ENDPOINT) throw new Error('env:DS_ENDPOINT is required!');
        const SVC = 'X' + name;
        const $SVC = _$(SVC);
        return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT); // re-use proxy by name
    };

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
    function do_create_table(table: any, id_name: any, id_type: any) {
        if (!table) return Promise.reject(new Error(NS + 'parameter:table is required'));
        const $param = { idName: id_name, idType: id_type };
        return $proxy()
            .do_get(table, '0', 'create-table', $param)
            .then((_: any) => _.result);
    }

    /**
     * Delete the target table by Name.
     *
     * @param table
     * @returns {*}
     */
    function do_delete_table(table: any) {
        if (!table) return Promise.reject(new Error(NS + 'parameter:table is required'));
        const $param: any = undefined;
        return $proxy()
            .do_get(table, '0', 'delete-table', $param)
            .then((_: any) => _.result);
    }

    /**
     * List Tables
     *
     * @param table table
     * @param limit default 100
     * @returns {Promise.<*>}
     */
    function do_list_tables(table: any, limit: any) {
        // if (!table) return Promise.reject(new Error(NS + 'parameter:table is required'));
        table = table || '#'; // prevent ''.
        const $param = { limit };
        return $proxy()
            .do_get(table, '0', 'list-table', $param)
            .then((_: any) => _.result);
    }

    /**
     * read stream buffer.
     *
     * @param {*} param
     */
    function do_read_stream(param: any) {
        const $param = param || {};
        const table = $param.table;
        delete $param.table;
        return $proxy().do_get(table, '0', 'stream', $param);
        // .then((_: any) => _.result);					//WARN! pass the original body.
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
    function do_create_item(table: any, id: any, data: any) {
        if (!table) return Promise.reject(new Error(NS + 'parameter:table is required'));
        if (!id) return Promise.reject(new Error(NS + 'parameter:id is required'));
        if (!data) return Promise.reject(new Error(NS + 'parameter:data is required'));
        if (typeof data !== 'object') return Promise.reject(new Error(NS + 'parameter:data must be object'));

        //! additional parameters.
        const $param: any = {};

        //! decode idName, idType.
        if (id && typeof id === 'object') {
            const $id = id;
            const idType = $id.idType;
            delete $id.idType;
            const keys = Object.keys($id);
            if (keys.length !== 1) return Promise.reject(new Error(NS + ':id is un-expected keys.'));
            const idName = keys.pop() || '';
            id = $id[idName];
            // _log(NS,'> idName =', idName,' id = ', id);
            $param.idName = idName;
            $param.idType = idType || (typeof id === 'number' ? 'Number' : 'String');
        }

        return $proxy()
            .do_post(table, id, undefined, $param, data)
            .then((_: any) => _.result);
    }

    /**
     * Get Item from Table
     *
     * @param table
     * @param id
     * @returns {Promise.<*>}
     */
    function do_get_item(table: any, id: any) {
        if (!table) return Promise.reject(new Error(NS + 'parameter:table is required'));
        if (!id) return Promise.reject(new Error(NS + 'parameter:id is required'));

        //! additional parameters.
        const $param: any = {};

        //! decode idName, idType.
        if (id && typeof id === 'object') {
            const $id = id;
            const idType = $id.idType;
            delete $id.idType;
            const keys = Object.keys($id);
            if (keys.length !== 1) return Promise.reject(new Error(NS + ':id is un-expected keys.'));
            const idName = keys.pop() || '';
            id = $id[idName];
            // _log(NS,'> idName =', idName,' id = ', id);
            $param.idName = idName;
            $param.idType = idType || (typeof id === 'number' ? 'Number' : 'String');
        }

        return $proxy()
            .do_get(table, id, undefined, $param)
            .then((_: any) => _.result);
    }

    /**
     * Delete Item from Table
     *
     * @param table
     * @param id
     * @returns {Promise.<*>}
     */
    function do_delete_item(table: any, id: any) {
        if (!table) return Promise.reject(new Error(NS + 'parameter:table is required'));
        if (!id) return Promise.reject(new Error(NS + 'parameter:id is required'));

        //! additional parameters.
        const $param: any = {};

        //! decode idName, idType.
        if (id && typeof id === 'object') {
            const $id = id;
            const idType = $id.idType;
            delete $id.idType;
            const keys = Object.keys($id);
            if (keys.length !== 1) return Promise.reject(new Error(NS + ':id is un-expected keys.'));
            const idName = keys.pop() || '';
            id = $id[idName];
            // _log(NS,'> idName =', idName,' id = ', id);
            $param.idName = idName;
            $param.idType = idType || (typeof id === 'number' ? 'Number' : 'String');
        }

        return $proxy()
            .do_delete(table, id, undefined, $param)
            .then((_: any) => _.result);
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
    function do_update_item(table: any, id: any, data: any, incset: any) {
        if (!table) return Promise.reject(new Error(NS + 'parameter:table is required'));
        if (!id) return Promise.reject(new Error(NS + 'parameter:id is required'));
        if (!data) return Promise.reject(new Error(NS + 'parameter:data is required'));
        if (typeof data !== 'object') return Promise.reject(new Error(NS + 'parameter:data must be object'));

        //! additional parameters.
        const $param: any = {};

        //! decode idName, idType.
        if (id && typeof id === 'object') {
            const $id = id;
            const idType = $id.idType;
            delete $id.idType;
            const keys = Object.keys($id);
            if (keys.length !== 1) return Promise.reject(new Error(NS + ':id is un-expected keys.'));
            const idName = keys.pop() || '';
            id = $id[idName];
            // _log(NS,'> idName =', idName,' id = ', id);
            $param.idName = idName;
            $param.idType = idType || (typeof id === 'number' ? 'Number' : 'String');
        }

        const $body = data || {};
        if (incset) $body.$I = incset;

        return $proxy()
            .do_put(table, id, undefined, $param, $body)
            .then((_: any) => _.result);
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
    function do_increment_item(table: any, id: any, data: any, incset: any) {
        if (!table) return Promise.reject(new Error(NS + 'parameter:table is required'));
        if (!id) return Promise.reject(new Error(NS + 'parameter:id is required'));
        if (!data) return Promise.reject(new Error(NS + 'parameter:data is required'));
        if (typeof data !== 'object') return Promise.reject(new Error(NS + 'parameter:data must be object'));

        //! additional parameters.
        const $param: any = {};

        //! decode idName, idType.
        if (id && typeof id === 'object') {
            const $id = id;
            const idType = $id.idType;
            delete $id.idType;
            const keys = Object.keys($id);
            if (keys.length !== 1) return Promise.reject(new Error(NS + ':id is un-expected keys.'));
            const idName = keys.pop() || '';
            id = $id[idName];
            // _log(NS,'> idName =', idName,' id = ', id);
            $param.idName = idName;
            $param.idType = idType || (typeof id === 'number' ? 'Number' : 'String');
        }

        const $body = data || {};
        if (incset) $body.$I = incset;

        return $proxy()
            .do_put(table, id, 'increment', $param, $body)
            .then((_: any) => _.result);
    }

    /**
     * Self Test Functions.
     *
     * @param param
     */
    function do_test_self(param: any) {
        const $param = param || {};
        return $proxy()
            .do_get('#', '0', 'test-self', $param)
            .then((_: any) => _.result);
    }

    //! returns.
    return thiz;
}

export default maker;
