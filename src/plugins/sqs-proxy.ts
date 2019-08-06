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
import { EnginePluggable, EnginePluginBuilder } from '../common/types';
import httpProxy, { HttpProxy } from './http-proxy';

export interface SQSProxy extends EnginePluggable {
    /**
     * get the current endpoint address.
     */
    endpoint: () => string;

    do_receiveMessage: (TYPE: any, size: any) => any;
    do_sendMessage: (TYPE: any, $attr: any, $data: any) => any;
    do_deleteMessage: (TYPE: any, handle: any) => any;
    do_statistics: (TYPE: any, handle: any) => any;
    do_test_self: (options: any) => any;
}

const maker: EnginePluginBuilder<SQSProxy> = (_$, name, options) => {
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
    const ENDPOINT = $U.env('SS_ENDPOINT', typeof options == 'string' ? options : '');
    const $proxy = function() {
        if (!ENDPOINT) throw new Error('env:SS_ENDPOINT is required!');
        const SVC = 'X' + name;
        const $SVC = _$(SVC, null as HttpProxy);
        return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT); // re-use proxy by name
    };

    /** ****************************************************************************************************************
     *  Main Implementation.
     ** ****************************************************************************************************************/
    const thiz = new (class implements SQSProxy {
        public name = () => `sqs-proxy:${name}`;
        public endpoint = () => ENDPOINT;

        public do_receiveMessage(TYPE: any, size: any) {
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

        public do_sendMessage(TYPE: any, $attr: any, $data: any) {
            if (!TYPE) return Promise.reject('TYPE is required!');
            if (!$attr) return Promise.reject('$attrs is required!');
            if (!$data) return Promise.reject('$data is required!');

            const $param = Object.assign({}, $attr || {});

            return $proxy()
                .do_put(TYPE, '0', undefined, $param, $data)
                .then((_: any) => _.result);
        }

        public do_deleteMessage(TYPE: any, handle: any) {
            if (!TYPE) return Promise.reject('TYPE is required!');
            if (!handle) return Promise.reject('handle is required!');

            const options: any = null; // optional values.
            const $param = Object.assign({}, options || {});

            return $proxy()
                .do_delete(TYPE, handle, undefined)
                .then((_: any) => _.result);
        }

        public do_statistics(TYPE: any, handle: any) {
            if (!TYPE) return Promise.reject('TYPE is required!');

            const options: any = null; // optional values.
            const $param = Object.assign({}, options || {});

            return $proxy()
                .do_get(TYPE, '0', 'stat')
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
