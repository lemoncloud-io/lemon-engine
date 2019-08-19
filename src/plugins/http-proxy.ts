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
import { EngineCore, EnginePluggable, EnginePluginBuilder } from '../common/types';

/**
 * Define Interface
 *
 * @see http://www.albertgao.xyz/2016/08/11/how-to-declare-a-function-type-variable-in-typescript/
 */
export interface HttpProxy extends EnginePluggable {
    /**
     * get the current endpoint address.
     */
    endpoint: () => string;

    /**
     * GET
     */
    do_get: (type: string, id?: string, cmd?: string, $param?: any, $body?: any, $ctx?: any) => any;

    /**
     * PUT
     */
    do_put: (type: string, id?: string, cmd?: string, $param?: any, $body?: any, $ctx?: any) => any;

    /**
     * POST
     */
    do_post: (type: string, id?: string, cmd?: string, $param?: any, $body?: any, $ctx?: any) => any;

    /**
     * PATCH
     */
    do_patch: (type: string, id?: string, cmd?: string, $param?: any, $body?: any, $ctx?: any) => any;

    /**
     * DELETE
     */
    do_delete: (type: string, id?: string, cmd?: string, $param?: any, $body?: any, $ctx?: any) => any;
}

import REQUEST from 'request';
import queryString from 'query-string';

const maker: EnginePluginBuilder<HttpProxy> = (_$, name, options) => {
    name = name || 'HS';

    const $U = _$.U; // re-use global instance (utils).
    const $_ = _$._; // re-use global instance (_ lodash).

    if (!$U) throw new Error('$U is required!');
    if (!$_) throw new Error('$_ is required!');

    const NS = $U.NS(name, 'magenta'); // NAMESPACE TO BE PRINTED.
    const ENDPOINT: string = options && (typeof options === 'string' ? options : options.endpoint||'') || ''; // service endpoint.
    const HEADERS = options && (typeof options === 'object' ? options.headers : {}) || {}; // custom headers.
    if (!ENDPOINT) throw new Error('endpoint is required!');

    //! load common functions
    const _log = _$.log;
    const _inf = _$.inf;
    const _err = _$.err;

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
            (TYPE === undefined || ID === undefined ? '' : '/' + encodeURIComponent(ID)) +
            (TYPE === undefined || ID === undefined || CMD === undefined ? '' : '/' + encodeURI(CMD)) +   //NOTE - cmd could have additional '/' char.
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
        _log(NS, '*', options.method, url, options.json ? 'json' : 'plain');
        // _inf(NS, '> options =', options);
        // options.headers && _log(NS, '> headers =', options.headers);

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
     * class: HttpProxyBody
     */
    class HttpProxyBody implements HttpProxy {
        private _endpoint: string;
        public constructor(endpoint: string){
            this._endpoint = endpoint;
        }
        public name = () => `http-proxy:${this._endpoint}`;
        public endpoint = () => this._endpoint;

        /**
        * GET /:type/:id/:cmd?$param
        */
        public do_get(TYPE: any, ID: any, CMD: any, $param: any, $body: any) {
            if ($body) return Promise.reject(new Error(NS + ':$body is invalid!'));
            if (TYPE === undefined) return Promise.reject(new Error(NS + ':TYPE is required!'));
            // if (ID === undefined) return Promise.reject(new Error(NS + ':ID is required!'));
            // if (CMD === undefined) return Promise.reject(new Error(NS + ':CMD is required!'));
            return my_request_http('GET', TYPE, ID, CMD, $param, $body);
        }

        /**
        * PUT /:type/:id/:cmd?$param
        */
        public do_put(TYPE: any, ID: any, CMD: any, $param: any, $body: any) {
            if (TYPE === undefined) return Promise.reject(new Error(NS + ':TYPE is required!'));
            if (ID === undefined) return Promise.reject(new Error(NS + ':ID is required!'));
            // if (CMD === undefined) return Promise.reject(new Error(NS + ':CMD is required!'));
            return my_request_http('PUT', TYPE, ID, CMD, $param, $body);
        }

        /**
        * POST /:type/:id/:cmd?$param
        */
        public do_post(TYPE: any, ID: any, CMD: any, $param: any, $body: any) {
            if (TYPE === undefined) return Promise.reject(new Error(NS + ':TYPE is required!'));
            if (ID === undefined) return Promise.reject(new Error(NS + ':ID is required!'));
            // if (CMD === undefined) return Promise.reject(new Error(NS + ':CMD is required!'));
            return my_request_http('POST', TYPE, ID, CMD, $param, $body);
        }

        /**
        * PATCH /:type/:id/:cmd?$param
        */
        public do_patch(TYPE: any, ID: any, CMD: any, $param: any, $body: any) {
            if (TYPE === undefined) return Promise.reject(new Error(NS + ':TYPE is required!'));
            if (ID === undefined) return Promise.reject(new Error(NS + ':ID is required!'));
            // if (CMD === undefined) return Promise.reject(new Error(NS + ':CMD is required!'));
            return my_request_http('PATCH', TYPE, ID, CMD, $param, $body);
        }

        /**
        * DELETE /:type/:id/:cmd?$param
        */
        public do_delete(TYPE: any, ID: any, CMD: any, $param: any, $body: any) {
            if (TYPE === undefined) return Promise.reject(new Error(NS + ':TYPE is required!'));
            if (ID === undefined) return Promise.reject(new Error(NS + ':ID is required!'));
            // if (CMD === undefined) return Promise.reject(new Error(NS + ':CMD is required!'));
            return my_request_http('DELETE', TYPE, ID, CMD, $param, $body);
        }
    }

    //! create & register service.
    return _$(name, new HttpProxyBody(ENDPOINT));
}

export default maker;
