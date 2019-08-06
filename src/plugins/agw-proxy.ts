/**
 * AGW(API Gateway) Proxy Service Exports
 * - proxy call to api gateway service.
 *
 *
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
import { EnginePluggable, EnginePluginBuilder } from '../common/types';
import httpProxy, { HttpProxy } from './http-proxy';

export interface AGWProxy extends EnginePluggable {
    /**
     * get the current endpoint address.
     */
    endpoint: () => string;

    postToConnection: (endpoint: any, connectionId: any, payload: any) => any;
}

const maker: EnginePluginBuilder<AGWProxy> = (_$, name, options) => {
    name = name || 'AG';

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
    const ENDPOINT = $U.env('AG_ENDPOINT', typeof options == 'string' ? options : '');
    const $proxy = function() {
        if (!ENDPOINT) throw new Error('env:AG_ENDPOINT is required!');
        const SVC = 'X' + name;
        const $SVC = _$(SVC, null as HttpProxy);
        return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT); // re-use proxy by name
    };

    /** ****************************************************************************************************************
     *  Main Implementation.
     ** ****************************************************************************************************************/
    const thiz = new (class implements AGWProxy {
        public name = () => `agw-proxy:${name}`;
        public endpoint = () => ENDPOINT;
        public postToConnection(endpoint: any, connectionId: any, payload: any) {
            if (!endpoint) return Promise.reject(new Error('endpoint(url) is required!'));
            if (!connectionId) return Promise.reject(new Error('connectionId is required!'));
            if (!payload) return Promise.reject(new Error('payload is required!'));

            const options: any = null; // optional values.
            const $param = Object.assign({}, options || {});
            $param.endpoint = endpoint;
            $param.connectionId = connectionId;

            return $proxy()
                .do_post('execute-api', '0', undefined, $param, payload)
                .then((_: any) => _.result);
        }
    })();

    //! create & register service.
    return _$(name, thiz);
};

export default maker;
