/* eslint-disable prettier/prettier */
/**
 * Http Proxy Service Exports
 * - proxy call to http based service.
 *
 *
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
import { EngineService, EnginePluginService, EnginePluginMaker } from '../common/types';

/**
 * Define Interface
 * 
 * @see http://www.albertgao.xyz/2016/08/11/how-to-declare-a-function-type-variable-in-typescript/
 */
export interface HttpProxy extends EnginePluginService {
    /**
     * GET
     */
    do_get: (method: string, type: string, id?: string, cmd?: string, $param?: any, $body?: any) => any;

    /**
     * PUT
     */
    do_put: (method: string, type: string, id?: string, cmd?: string, $param?: any, $body?: any) => any;

    /**
     * POST
     */
    do_post: (method: string, type: string, id?: string, cmd?: string, $param?: any, $body?: any) => any;

    /**
     * DELETE
     */
    do_delete: (method: string, type: string, id?: string, cmd?: string, $param?: any, $body?: any) => any;
}

import REQUEST from 'request';
import queryString from 'query-string';

const maker: EnginePluginMaker = function(_$: EngineService, name?: string, options?: any): HttpProxy {
    name = name || 'HS';

    const $U = _$.U; // re-use global instance (utils).
    const $_ = _$._; // re-use global instance (_ lodash).

    if (!$U) throw new Error('$U is required!');
    if (!$_) throw new Error('$_ is required!');

    const NS = $U.NS(name, 'magenta'); // NAMESPACE TO BE PRINTED.
    const ENDPOINT = options && (typeof options === 'string' ? options : options.endpoint||'') || ''; // service endpoint.
    const HEADERS = options && options.headers || {}; // custom headers.

    if (!ENDPOINT) throw new Error('endpoint is required!');

    //! prepare instance.
    const thiz = function(){} as HttpProxy;
    // const thiz: any = { endpoint };
    thiz.endpoint = () => ENDPOINT;

    //! load common functions
    const _log = _$.log;
    const _inf = _$.inf;
    const _err = _$.err;

    //! item functions.
    thiz.do_get = do_get;
    thiz.do_put = do_put;
    thiz.do_post = do_post;
    thiz.do_patch = do_patch;
    thiz.do_delete = do_delete;

    //! register service.
    _$(name, thiz);

    /** ****************************************************************************************************************
     *  Main Implementation.
     ** ****************************************************************************************************************/
    //! request in local server.
    const my_request_http = (METHOD: any, TYPE: any, ID: any, CMD: any, $param: any, $body: any) => {
        if (!METHOD) return Promise.reject(new Error(NS + ':METHOD is required!'));
        if (!REQUEST) throw new Error('request is required!');

        //! prepare request parameters
        const query_string = $param ? queryString.stringify($param) : '';
        const url =
            ENDPOINT +
            (TYPE === undefined ? '' : '/' + encodeURIComponent(TYPE)) +
            (ID === undefined ? '' : '/' + encodeURIComponent(ID)) +
            (CMD === undefined ? '' : '/' + encodeURIComponent(CMD)) +
            (!query_string ? '' : '?' + query_string);
        const request = REQUEST;
        const options: any = {
            method: METHOD || 'GET',
            uri: url,
            body: $body === null ? undefined : $body,
            json: (typeof $body === 'string') ? false : true,
        };
        //! attache headers.
        if (HEADERS && Object.keys(HEADERS).length > 0) options.headers = HEADERS;
        // _log(NS, ' url :=', options.method, url);
        _log(NS, '*', options.method, url);
        _inf(NS, '> options =', options);
        options.headers && _log(NS, '> headers =', options.headers); 

        //! returns promise
        return new Promise((resolve, reject) => {
            //! start request..
            request(options, function(error: any, response: any, body: any) {
                error && _err(NS, '>>>>> requested! err=', error);
                if (error) return reject(error);
                //! detecte trouble.
                const statusCode = response.statusCode;
                const statusMessage = response.statusMessage;
                if (statusCode !== 200) {
                    //! handle for not-found.
                    if (statusCode === 400 || statusCode === 404) {
                        const msg = '' + body;
                        return reject(new Error(msg.indexOf('404 NOT FOUND') >= 0 ? msg : '404 NOT FOUND'));
                    }
                    _log(NS, '> code=' + statusCode + ', msg=' + statusMessage + ', body=', body);
                    // if (statusCode === 400 || statusCode === 404)
                    // 	return reject(new Error(body||statusMessage));
                    // else
                    // 	return reject(new Error(body||statusMessage));
                    body = body || statusMessage;
                    return reject(typeof body === 'string' ? new Error(body) : body);
                }

                //! try to parse body.
                try {
                    if (body && typeof body == 'string' && body.startsWith('{') && body.endsWith('}')) {
                        body = JSON.parse(body);
                    } else if (body && typeof body == 'string' && body.startsWith('[') && body.endsWith(']')) {
                        body = JSON.parse(body);
                    }
                } catch (e) {
                    _err(NS, '!WARN! parse =', e);
                }

                //! ok! successed.
                resolve(body);
            });
        });
    };

    /**
     * GET /:type/:id/:cmd?$param
     */
    function do_get(TYPE: any, ID: any, CMD: any, $param: any, $body: any) {
        if ($body) return Promise.reject(new Error(NS + ':$body is invalid!'));
        if (TYPE === undefined) return Promise.reject(new Error(NS + ':TYPE is required!'));
        // if (ID === undefined) return Promise.reject(new Error(NS + ':ID is required!'));
        // if (CMD === undefined) return Promise.reject(new Error(NS + ':CMD is required!'));
        return my_request_http('GET', TYPE, ID, CMD, $param, $body);
    }
    /**
     * PUT /:type/:id/:cmd?$param
     */
    function do_put(TYPE: any, ID: any, CMD: any, $param: any, $body: any) {
        if (TYPE === undefined) return Promise.reject(new Error(NS + ':TYPE is required!'));
        if (ID === undefined) return Promise.reject(new Error(NS + ':ID is required!'));
        // if (CMD === undefined) return Promise.reject(new Error(NS + ':CMD is required!'));
        return my_request_http('PUT', TYPE, ID, CMD, $param, $body);
    }
    /**
     * POST /:type/:id/:cmd?$param
     */
    function do_post(TYPE: any, ID: any, CMD: any, $param: any, $body: any) {
        if (TYPE === undefined) return Promise.reject(new Error(NS + ':TYPE is required!'));
        if (ID === undefined) return Promise.reject(new Error(NS + ':ID is required!'));
        // if (CMD === undefined) return Promise.reject(new Error(NS + ':CMD is required!'));
        return my_request_http('POST', TYPE, ID, CMD, $param, $body);
    }
    /**
     * PATCH /:type/:id/:cmd?$param
     */
    function do_patch(TYPE: any, ID: any, CMD: any, $param: any, $body: any) {
        if (TYPE === undefined) return Promise.reject(new Error(NS + ':TYPE is required!'));
        if (ID === undefined) return Promise.reject(new Error(NS + ':ID is required!'));
        // if (CMD === undefined) return Promise.reject(new Error(NS + ':CMD is required!'));
        return my_request_http('PATCH', TYPE, ID, CMD, $param, $body);
    }
    /**
     * DELETE /:type/:id/:cmd?$param
     */
    function do_delete(TYPE: any, ID: any, CMD: any, $param: any, $body: any) {
        if (TYPE === undefined) return Promise.reject(new Error(NS + ':TYPE is required!'));
        if (ID === undefined) return Promise.reject(new Error(NS + ':ID is required!'));
        // if (CMD === undefined) return Promise.reject(new Error(NS + ':CMD is required!'));
        return my_request_http('DELETE', TYPE, ID, CMD, $param, $body);
    }

    //! returns.
    return thiz;
}

export default maker;
