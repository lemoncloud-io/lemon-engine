/**
 * Redis Proxy Service Exports
 * - proxy call to redis service.
 *
 *
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
import { EnginePluggable, EnginePluginBuilder } from '../common/types';
import httpProxy, { HttpProxy } from './http-proxy';

export interface RedisProxy extends EnginePluggable {
    /**
     * get the current endpoint address.
     */
    endpoint: () => string;

    do_create_item: (PKEY: any, id: any, item: any, timeout?: any) => any;
    do_get_item: (PKEY: any, id: any) => any;
    do_update_item: (PKEY: any, id: any, item: any) => any;
    do_delete_item: (PKEY: any, id: any) => any;
    do_test_self: (options?: any) => any;
}

const maker: EnginePluginBuilder<RedisProxy> = (_$, name, options) => {
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

    /** ****************************************************************************************************************
     *  Internal Proxy Function
     ** ****************************************************************************************************************/
    const ENDPOINT = $U.env('RS_ENDPOINT', typeof options == 'string' ? options : '');
    const $proxy = function() {
        if (!ENDPOINT) throw new Error('env:RS_ENDPOINT is required!');
        const SVC = 'X' + name;
        const $SVC = _$(SVC, null as HttpProxy);
        return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT); // re-use proxy by name
    };

    /** ****************************************************************************************************************
     *  Main Implementation.
     ** ****************************************************************************************************************/
    const thiz = new (class implements RedisProxy {
        public name = () => `redis-proxy:${name}`;
        public endpoint = () => ENDPOINT;

        public do_create_item(PKEY: any, id: any, item: any, timeout: any) {
            if (!PKEY) return Promise.reject(new Error(NS + 'PKEY is required!'));
            if (!id) return Promise.reject(new Error(NS + 'id is required!'));
            if (!item) return Promise.reject(new Error(NS + 'item is required!'));

            if (Array.isArray(PKEY)) PKEY = PKEY.join('+');

            const options: any = null; // optional values.
            const $param = Object.assign({}, options || {});
            $param.timeout = timeout;

            // _log(NS, `- redis-proxy:do_create_item(${PKEY}, ${id})... item=`, item);
            return $proxy()
                .do_post(PKEY, id, undefined, $param, item)
                .then((_: any) => _.result);
        }

        public do_get_item(PKEY: any, id: any) {
            if (!PKEY) return Promise.reject(new Error(NS + 'PKEY is required!'));
            if (!id) return Promise.reject(new Error(NS + 'id is required!'));

            if (Array.isArray(PKEY)) PKEY = PKEY.join('+');

            const options: any = null; // optional values.
            const $param = Object.assign({}, options || {});

            return $proxy()
                .do_get(PKEY, id)
                .then((_: any) => _.result);
        }

        public do_update_item(PKEY: any, id: any, item: any) {
            if (!PKEY) return Promise.reject(new Error(NS + 'PKEY is required!'));
            if (!id) return Promise.reject(new Error(NS + 'id is required!'));
            if (!item) return Promise.reject(new Error(NS + 'item is required!'));

            if (Array.isArray(PKEY)) PKEY = PKEY.join('+');

            const options: any = null; // optional values.
            const $param = Object.assign({}, options || {});

            return $proxy()
                .do_put(PKEY, id, undefined, $param, item)
                .then((_: any) => _.result);
        }

        public do_delete_item(PKEY: any, id: any) {
            if (!PKEY) return Promise.reject(new Error(NS + 'PKEY is required!'));
            if (!id) return Promise.reject(new Error(NS + 'id is required!'));

            if (Array.isArray(PKEY)) PKEY = PKEY.join('+');

            const options: any = null; // optional values.
            const $param = Object.assign({}, options || {});

            return $proxy()
                .do_delete(PKEY, id, undefined, $param)
                .then((_: any) => _.result);
        }

        public do_test_self(options: any) {
            options = options || {};
            _log(NS, 'do_test_self()... param=', options);

            const $param = Object.assign({}, options || {});

            return $proxy()
                .do_get('#', '0', 'test-self', $param)
                .then((_: any) => _.result);
        }
    })();

    //! create & register service.
    return _$(name, thiz);
};

export default maker;
