/* eslint-disable prettier/prettier */
/**
 * SQS Proxy Service Exports
 * - proxy call to sqs service.
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
    name = name || 'RS';

    const $U = _$.U; // re-use global instance (utils).
    const $_ = _$._; // re-use global instance (_ lodash).

    if (!$U) throw new Error('$U is required!');
    if (!$_) throw new Error('$_ is required!');

    const NS = $U.NS(name, 'yellow'); // NAMESPACE TO BE PRINTED.

    //! load common functions
    const _log = _$.log;
    const _inf = _$.inf;
    const _err = _$.err;

    //! prepare instance.
    const thiz = function(){} as EnginePluggable;

    //! item functions.
    thiz.do_sendMessage = do_sendMessage;
    thiz.do_receiveMessage = do_receiveMessage;
    thiz.do_deleteMessage = do_deleteMessage;
    thiz.do_statistics = do_statistics;

    //! test function.
    thiz.do_test_self = do_test_self;

    //! register service.
    _$(name, thiz);

    /** ****************************************************************************************************************
     *  Internal Proxy Function
     ** ****************************************************************************************************************/
    const ENDPOINT = $U.env('SS_ENDPOINT');
    const $proxy = function() {
        if (!ENDPOINT) throw new Error('env:SS_ENDPOINT is required!');
        const SVC = 'X' + name;
        const $SVC = _$(SVC);
        return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT); // re-use proxy by name
    };

    /** ****************************************************************************************************************
     *  Main Implementation.
     ** ****************************************************************************************************************/
    function do_receiveMessage(TYPE: any, size: any) {
        size = $U.N(size, 1);
        if (!TYPE) return Promise.reject('TYPE is required!');
        if (!size) return Promise.reject('size is required!');

        const options: any = null; // optional values.
        const $param = Object.assign({}, options || {});
        $param.size = size;

        return $proxy()
            .do_get(TYPE, '0', undefined, $param)
            .then((_: any) => _.result);
    }

    function do_sendMessage(TYPE: any, $attr: any, $data: any) {
        if (!TYPE) return Promise.reject('TYPE is required!');
        if (!$attr) return Promise.reject('$attrs is required!');
        if (!$data) return Promise.reject('$data is required!');

        const $param = Object.assign({}, $attr || {});

        return $proxy()
            .do_put(TYPE, '0', undefined, $param, $data)
            .then((_: any) => _.result);
    }

    function do_deleteMessage(TYPE: any, handle: any) {
        if (!TYPE) return Promise.reject('TYPE is required!');
        if (!handle) return Promise.reject('handle is required!');

        const options: any = null; // optional values.
        const $param = Object.assign({}, options || {});

        return $proxy()
            .do_delete(TYPE, handle, undefined)
            .then((_: any) => _.result);
    }

    function do_statistics(TYPE: any, handle: any) {
        if (!TYPE) return Promise.reject('TYPE is required!');

        const options: any = null; // optional values.
        const $param = Object.assign({}, options || {});

        return $proxy()
            .do_get(TYPE, '0', 'stat')
            .then((_: any) => _.result);
    }

    function do_test_self(options: any) {
        options = options || {};
        _log(NS, 'do_test_self()... param=', options);

        const $param = Object.assign({}, options || {});

        return $proxy()
            .do_get('#', '0', 'test-self', $param)
            .then((_: any) => _.result);
    }

    //! returns.
    return thiz;
}

export default maker;
