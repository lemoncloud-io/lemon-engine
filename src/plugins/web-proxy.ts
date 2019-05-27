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
import { EngineService, EnginePluginService, EnginePluginMaker } from '../common/types';
import httpProxy from './http-proxy';

const maker: EnginePluginMaker = function(_$: EngineService, name?: string, options?: any): EnginePluginService {
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
    const ENDPOINT = $U.env('WS_ENDPOINT');
    const HEADERS = options && options.headers || null;   // headers to pass.
    const $proxy = function() {
        if (!ENDPOINT) throw new Error('env:WS_ENDPOINT is required!');
        const SVC = 'X' + name;
        const $SVC = _$(SVC);
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
        //! will register service as <SVC>, or override.
        return $SVC ? $SVC : httpProxy(_$, SVC, options); // re-use proxy by name
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
    function do_get(host: any, path: any, $opt: any, $param: any, $body: any) {
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
    function do_put(host: any, path: any, $opt: any, $param: any, $body: any) {
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
    function do_post(host: any, path: any, $opt: any, $param: any, $body: any) {
        if (host === undefined) return Promise.reject(new Error(NS + ':host is required!'));
        // if (path === undefined) return Promise.reject(new Error(NS + ':path is required!'));
        // if ($opt === undefined) return Promise.reject(new Error(NS + ':$opt is required!'));

        return $proxy()
            .do_post(host, path, undefined, $param, $body)
            .then((_: any) => _.result);
    }

    /**
     * DELETE HOST/PATH?$param
     *
     */
    function do_delete(host: any, path: any, $opt: any, $param: any, $body: any) {
        if (host === undefined) return Promise.reject(new Error(NS + ':host is required!'));
        // if (path === undefined) return Promise.reject(new Error(NS + ':path is required!'));
        // if ($opt === undefined) return Promise.reject(new Error(NS + ':$opt is required!'));

        return $proxy()
            .do_delete(host, path, undefined, $param, $body)
            .then((_: any) => _.result);
    }

    //! returns.
    return thiz;
}

export default maker;
