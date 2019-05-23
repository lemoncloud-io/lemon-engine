/* eslint-disable prettier/prettier */
/**
 * Lambda Proxy Service Exports
 * - proxy call to lambda service.
 *
 *
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
import { EngineService, EnginePluginService, EnginePluginMaker } from '../common/types';
import httpProxy from './http-proxy';

const maker: EnginePluginMaker = function(_$: EngineService, name?: string, options?: any): EnginePluginService {
    'use strict';
    name = name || 'LS';

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
    const thiz = function(){} as EnginePluginService;

    //! item functions.
    thiz.do_get = do_get;
    thiz.do_post = do_post;
    thiz.do_put = do_put;
    thiz.do_delete = do_delete;

    //! register service.
    _$(name, thiz);

    /** ****************************************************************************************************************
     *  Internal Proxy Function
     ** ****************************************************************************************************************/
    const ENDPOINT = $U.env('LS_ENDPOINT');
    const $proxy = function() {
        if (!ENDPOINT) throw new Error('env:LS_ENDPOINT is required!');
        const SVC = 'X' + name;
        const $SVC = _$(SVC);
        return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT); // re-use proxy by name
    };

    /** ****************************************************************************************************************
     *  Main Implementation.
     ** ****************************************************************************************************************/
    /**
     * GET HOST/PATH?$param
     */
    function do_get(TYPE: string, ID: any, CMD: string, $param: any, $body: any, $ctx: any) {
        if (!TYPE) return Promise.reject(new Error('TYPE is required'));
        if ($body) return Promise.reject(new Error(NS + ':$body is invalid!'));
        return $proxy()
            .do_get(TYPE, ID, CMD, $param, $body, $ctx)
            .then((_: any) => _.result);
    }

    /**
     * PUT HOST/PATH?$param
     *
     */
    function do_put(TYPE: string, ID: any, CMD: string, $param: any, $body: any, $ctx: any) {
        if (!TYPE) return Promise.reject(new Error('TYPE is required'));
        return $proxy()
            .do_put(TYPE, ID, CMD, $param, $body, $ctx)
            .then((_: any) => _.result);
    }

    /**
     * POST HOST/PATH?$param
     *
     */
    function do_post(TYPE: string, ID: any, CMD: string, $param: any, $body: any, $ctx: any) {
        if (!TYPE) return Promise.reject(new Error('TYPE is required'));
        return $proxy()
            .do_post(TYPE, ID, CMD, $param, $body, $ctx)
            .then((_: any) => _.result);
    }

    /**
     * DELETE HOST/PATH?$param
     *
     */
    function do_delete(TYPE: string, ID: any, CMD: string, $param: any, $body: any, $ctx: any) {
        if (!TYPE) return Promise.reject(new Error('TYPE is required'));
        return $proxy()
            .do_delete(TYPE, ID, CMD, $param, $body, $ctx)
            .then((_: any) => _.result);
    }

    //! returns.
    return thiz;
}

export default maker;
