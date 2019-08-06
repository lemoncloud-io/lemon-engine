/* eslint-disable prettier/prettier */
/**
 * WEB Proxy Service Exports
 * - proxy call to web service.
 * - must be matched with `web-api.js` in `lemon-backbone-api`.
 *
 * #History
 * 2019.05.27 - support headers with relaying.
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
import { EnginePluggable, EnginePluginBuilder } from '../common/types';
import httpProxy, { HttpProxy } from './http-proxy';

export interface WebProxy extends EnginePluggable {
    /**
     * get the current endpoint address.
     */
    endpoint: () => string;

    do_get: (host: string, path: string, $opt?: any, $param?: any, $body?: any) => any;
    do_put: (host: string, path: string, $opt?: any, $param?: any, $body?: any) => any;
    do_patch: (host: string, path: string, $opt?: any, $param?: any, $body?: any) => any;
    do_post: (host: string, path: string, $opt?: any, $param?: any, $body?: any) => any;
    do_delete: (host: string, path: string, $opt?: any, $param?: any, $body?: any) => any;
}

const maker: EnginePluginBuilder<WebProxy> = (_$, name, options) => {
    name = name || 'WS';

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
    const ENDPOINT = $U.env('WS_ENDPOINT', typeof options == 'string' ? options : '');
    const HEADERS = options && (typeof options === 'object' ? options.headers : null) || null;   // headers to pass.
    const $proxy = function(): HttpProxy {
        if (!ENDPOINT) throw new Error('env:WS_ENDPOINT is required!');
        //! re-use proxy by name
        const SVC = 'X' + name;
        const $SVC = _$(SVC, null as HttpProxy);
        if ($SVC) return $SVC;
        //! prepare options.
        const options: any = {
            endpoint: ENDPOINT,
        }
        //! relay HEADERS to `WEB-API`
        if (HEADERS){
            const RELAY_KEY = 'x-lemon-';
            options.headers = Object.keys(HEADERS).reduce((H: any, key: string, i: number)=>{
                const val = HEADERS[key];
                const name = RELAY_KEY + key;
                const text = `${val}`;
                H[name] = text;
                return H;
            }, {});
        }
        //! will register service as <SVC>.
        return httpProxy(_$, SVC, options);
    };

    /** ****************************************************************************************************************
     *  Main Implementation.
     ** ****************************************************************************************************************/
    const thiz = new (class implements WebProxy {
        public name = () => `web-proxy:${name}`;
        public endpoint = () => ENDPOINT;

        /**
         * GET HOST/PATH?$param
         *
         *
         * @param host 	hostname like (127.0.0.1, https://127.0.0.1, 127.0.0.1:8080)
         * @param path	full path
         * @param $opt	optional settings
         * @param $param query parameter (if string, then direct use w/o encoding)
         * @param $body	body payload (if string, then use as payload)
         */
        public do_get(host: any, path: any, $opt: any, $param: any, $body: any) {
            if ($body) return Promise.reject(new Error(NS + ':$body is invalid!'));
            if (host === undefined) return Promise.reject(new Error(NS + ':host is required!'));
            // if (path === undefined) return Promise.reject(new Error(NS + ':path is required!'));
            // if ($opt === undefined) return Promise.reject(new Error(NS + ':$opt is required!'));

            return $proxy()
                .do_get(host, path, undefined, $param, $body)
                .then((_: any) => _.result);
        }

        /**
         * PUT HOST/PATH?$param
         *
         */
        public do_put(host: any, path: any, $opt: any, $param: any, $body: any) {
            if (host === undefined) return Promise.reject(new Error(NS + ':host is required!'));
            // if (path === undefined) return Promise.reject(new Error(NS + ':path is required!'));
            // if ($opt === undefined) return Promise.reject(new Error(NS + ':$opt is required!'));

            return $proxy()
                .do_put(host, path, undefined, $param, $body)
                .then((_: any) => _.result);
        }

        /**
         * POST HOST/PATH?$param
         *
         */
        public do_post(host: any, path: any, $opt: any, $param: any, $body: any) {
            if (host === undefined) return Promise.reject(new Error(NS + ':host is required!'));
            // if (path === undefined) return Promise.reject(new Error(NS + ':path is required!'));
            // if ($opt === undefined) return Promise.reject(new Error(NS + ':$opt is required!'));

            return $proxy()
                .do_post(host, path, undefined, $param, $body)
                .then((_: any) => _.result);
        }

        /**
         * PATCH HOST/PATH?$param
         *
         */
        public do_patch(host: any, path: any, $opt: any, $param: any, $body: any) {
            if (host === undefined) return Promise.reject(new Error(NS + ':host is required!'));
            // if (path === undefined) return Promise.reject(new Error(NS + ':path is required!'));
            // if ($opt === undefined) return Promise.reject(new Error(NS + ':$opt is required!'));

            return $proxy()
                .do_patch(host, path, undefined, $param, $body)
                .then((_: any) => _.result);
        }

        /**
         * DELETE HOST/PATH?$param
         *
         */
        public do_delete(host: any, path: any, $opt: any, $param: any, $body: any) {
            if (host === undefined) return Promise.reject(new Error(NS + ':host is required!'));
            // if (path === undefined) return Promise.reject(new Error(NS + ':path is required!'));
            // if ($opt === undefined) return Promise.reject(new Error(NS + ':$opt is required!'));

            return $proxy()
                .do_delete(host, path, undefined, $param, $body)
                .then((_: any) => _.result);
        }
    })();

    //! create & register service.
    return _$(name, thiz);
}

export default maker;
