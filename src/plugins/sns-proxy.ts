/**
 * SNS Proxy Service Exports
 * - proxy call to sns service.
 *
 *
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
import { EnginePluggable, EnginePluginBuilder } from '../common/types';
import httpProxy, { HttpProxy } from './http-proxy';

export interface SNSProxy extends EnginePluggable {
    /**
     * get the current endpoint address.
     */
    endpoint: () => string;

    do_publish: (snsId: any, subject: any, payload: any) => string;
    do_test_self: (options: any) => any;
}

const maker: EnginePluginBuilder<SNSProxy> = (_$, name, options) => {
    name = name || 'SN';

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
    const ENDPOINT = $U.env('SN_ENDPOINT', typeof options == 'string' ? options : '');
    const $proxy = function() {
        if (!ENDPOINT) throw new Error('env:SN_ENDPOINT is required!');
        const SVC = 'X' + name;
        const $SVC = _$(SVC, null as HttpProxy);
        return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT); // re-use proxy by name
    };

    /** ****************************************************************************************************************
     *  Main Implementation.
     ** ****************************************************************************************************************/
    const thiz = new (class implements SNSProxy {
        public name = () => `sns-proxy:${name}`;
        public endpoint = () => ENDPOINT;

        public do_publish(snsId: any, subject: any, payload: any) {
            if (!snsId) return Promise.reject('snsId is required!');
            if (!subject) return Promise.reject('subject is required!');
            if (!payload) return Promise.reject('payload is required!');

            const options: any = null; // optional values.
            const $param = Object.assign({}, options || {});
            $param.subject = subject;

            return $proxy()
                .do_post(snsId, '0', undefined, $param, payload)
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
