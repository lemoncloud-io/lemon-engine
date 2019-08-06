/**
 * CRON Proxy Service Exports
 * - proxy call to cron(CloudWatch Rule) service.
 *
 *
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
import { EnginePluggable, EnginePluginBuilder } from '../common/types';
import httpProxy, { HttpProxy } from './http-proxy';

export interface CronProxy extends EnginePluggable {
    /**
     * get the current endpoint address.
     */
    endpoint: () => string;

    do_list_rules: (limit: any, prefix: any, token: any) => any;
    do_describe_rule: (name: any) => any;
    do_enable_rule: (name: any, enabled: any) => any;
    do_save_rule: (name: any, node: any) => any;
}

const maker: EnginePluginBuilder<CronProxy> = (_$, name, options) => {
    name = name || 'CR';

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
    const ENDPOINT = $U.env('CR_ENDPOINT', typeof options == 'string' ? options : '');
    const $proxy = function() {
        if (!ENDPOINT) throw new Error('env:CR_ENDPOINT is required!');
        const SVC = 'X' + name;
        const $SVC = _$(SVC, null as HttpProxy);
        return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT); // re-use proxy by name
    };

    /** ****************************************************************************************************************
     *  Main Implementation.
     ** ****************************************************************************************************************/
    const thiz = new (class implements CronProxy {
        public name = () => `cron-proxy:${name}`;
        public endpoint = () => ENDPOINT;

        /**
         * List Rules
         */
        public do_list_rules(limit: any, prefix: any, token: any) {
            return $proxy().do_get('rules', '', '', { limit, prefix, token }, undefined);
            // .then((_: any) => _.result);                //WARN! - cron-api 에서 전달을 .resuld에 안함.
        }
        /**
         * Details of rule
         */
        public do_describe_rule(name: any) {
            return $proxy().do_get('rules', name, undefined, undefined, undefined);
            // .then((_: any) => _.result);                //WARN! - cron-api 에서 전달을 .resuld에 안함.
        }
        /**
         * enable/disable rule.
         */
        public do_enable_rule(name: any, enabled: any) {
            return $proxy().do_get('rules', name, enabled ? 'enable' : 'disable', undefined, undefined);
            // .then((_: any) => _.result);                //WARN! - cron-api 에서 전달을 .resuld에 안함.
        }
        /**
         * save(or update) rule.
         */
        public do_save_rule(name: any, node: any) {
            return $proxy().do_post('rules', name, '', undefined, node);
            // .then((_: any) => _.result);                //WARN! - cron-api 에서 전달을 .resuld에 안함.
        }
    })();

    //! create & register service.
    return _$(name, thiz);
};

export default maker;
