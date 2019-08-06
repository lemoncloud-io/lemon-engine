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
import { EnginePluggable, EnginePluginBuilder } from '../common/types';
import httpProxy, { HttpProxy } from './http-proxy';

export interface LambdaProxy extends EnginePluggable {
    /**
     * get the current endpoint address.
     */
    endpoint: () => string;

    do_get: (TYPE: string, ID: any, CMD?: string, $param?: any, $body?: any, $ctx?: any) => any;
    do_put: (TYPE: string, ID: any, CMD?: string, $param?: any, $body?: any, $ctx?: any) => any;
    do_post: (TYPE: string, ID: any, CMD?: string, $param?: any, $body?: any, $ctx?: any) => any;
    do_delete: (TYPE: string, ID: any, CMD?: string, $param?: any, $body?: any, $ctx?: any) => any;
}

const maker: EnginePluginBuilder<LambdaProxy> = (_$, name, options) => {
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

    /** ****************************************************************************************************************
     *  Internal Proxy Function
     ** ****************************************************************************************************************/
    const ENDPOINT = $U.env('LS_ENDPOINT', typeof options == 'string' ? options : '');
    const $proxy = function() {
        if (!ENDPOINT) throw new Error('env:LS_ENDPOINT is required!');
        const SVC = 'X' + name;
        const $SVC = _$(SVC, null as HttpProxy);
        return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT); // re-use proxy by name
    };

    /** ****************************************************************************************************************
     *  Main Implementation.
     ** ****************************************************************************************************************/
    const thiz = new (class implements LambdaProxy {
        public name = () => `lambda-proxy:${name}`;
        public endpoint = () => ENDPOINT;

        /**
         * GET HOST/PATH?$param
         */
        public do_get(TYPE: string, ID: any, CMD: string, $param: any, $body: any, $ctx: any) {
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
        public do_put(TYPE: string, ID: any, CMD: string, $param: any, $body: any, $ctx: any) {
            if (!TYPE) return Promise.reject(new Error('TYPE is required'));
            return $proxy()
                .do_put(TYPE, ID, CMD, $param, $body, $ctx)
                .then((_: any) => _.result);
        }

        /**
         * POST HOST/PATH?$param
         *
         */
        public do_post(TYPE: string, ID: any, CMD: string, $param: any, $body: any, $ctx: any) {
            if (!TYPE) return Promise.reject(new Error('TYPE is required'));
            return $proxy()
                .do_post(TYPE, ID, CMD, $param, $body, $ctx)
                .then((_: any) => _.result);
        }

        /**
         * DELETE HOST/PATH?$param
         *
         */
        public do_delete(TYPE: string, ID: any, CMD: string, $param: any, $body: any, $ctx: any) {
            if (!TYPE) return Promise.reject(new Error('TYPE is required'));
            return $proxy()
                .do_delete(TYPE, ID, CMD, $param, $body, $ctx)
                .then((_: any) => _.result);
        }
    })();

    //! create & register service.
    return _$(name, thiz);
};

export default maker;
