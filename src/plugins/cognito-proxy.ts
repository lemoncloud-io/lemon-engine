/* eslint-disable prettier/prettier */
/**
 * Cognito Proxy Service Exports
 * - proxy call to Cognito service.
 *
 *
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
import { EngineCore, EnginePluggable, EnginePluginBuilder } from '../common/types';
import httpProxy from './http-proxy';

const maker: EnginePluginBuilder = function(_$: EngineCore, name?: string, options?: any): EnginePluggable {
    name = name || 'CS';

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
    const thiz = function(){} as EnginePluggable;

    //! item functions.
    thiz.do_get_user = do_get_user;
    thiz.do_get_enable_user = do_get_enable_user;
    thiz.do_get_disable_user = do_get_disable_user;
    thiz.do_get_confirm_user = do_get_confirm_user;
    thiz.do_list_user = do_list_user;
    thiz.do_update_user = do_update_user;

    thiz.do_list_group = do_list_group;
    thiz.do_get_group = do_get_group;
    thiz.do_add_user_to_group = do_add_user_to_group;
    thiz.do_create_group = do_create_group;

    //! register service.
    _$(name, thiz);

    /** ****************************************************************************************************************
     *  Internal Proxy Function
     ** ****************************************************************************************************************/
    const ENDPOINT = $U.env('CS_ENDPOINT');
    const $proxy = function() {
        if (!ENDPOINT) throw new Error('env:CS_ENDPOINT is required!');
        const SVC = 'X' + name;
        const $SVC = _$(SVC);
        return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT); // re-use proxy by name
    };

    /** ****************************************************************************************************************
     *  Main Implementation.
     ** ****************************************************************************************************************/
    function do_get_user(userPoolId: any, userSub: any) {
        if (!userPoolId) return Promise.reject(new Error('userPoolId is required!'));
        if (!userSub) return Promise.reject(new Error('userSub is required!'));

        const options: any = null; // optional values.
        const $param = Object.assign({}, options || {});
        // $param.size = size;

        return $proxy()
            .do_get(userPoolId, userSub, undefined, $param)
            .then((_: any) => _.result);
    }

    function do_get_enable_user(userPoolId: any, userSub: any) {
        if (!userPoolId) return Promise.reject(new Error('userPoolId is required!'));
        if (!userSub) return Promise.reject(new Error('userSub is required!'));

        return $proxy()
            .do_get(userPoolId, userSub, 'enable')
            .then((_: any) => _.result);
    }

    function do_get_disable_user(userPoolId: any, userSub: any) {
        if (!userPoolId) return Promise.reject(new Error('userPoolId is required!'));
        if (!userSub) return Promise.reject(new Error('userSub is required!'));

        return $proxy()
            .do_get(userPoolId, userSub, 'disable')
            .then((_: any) => _.result);
    }

    function do_get_confirm_user(userPoolId: any, userSub: any) {
        if (!userPoolId) return Promise.reject(new Error('userPoolId is required!'));
        if (!userSub) return Promise.reject(new Error('userSub is required!'));

        return $proxy()
            .do_get(userPoolId, userSub, 'confirm')
            .then((_: any) => _.result);
    }

    function do_list_user(userPoolId: any, filterName: any, filterValue: any, limit: any) {
        if (!userPoolId) return Promise.reject(new Error('userPoolId is required!'));
        // if (!userSub) return Promise.reject('userSub is required!');

        const options: any = null; // optional values.
        const $param = Object.assign({}, options || {});
        if (limit) $param.limit = limit;
        if (filterName) $param[filterName] = filterValue;

        return $proxy()
            .do_get(userPoolId, undefined, undefined, $param)
            .then((_: any) => _.result);
    }

    function do_update_user(userPoolId: any, userSub: any, $attr: any) {
        if (!userPoolId) return Promise.reject(new Error('userPoolId is required!'));
        if (!userSub) return Promise.reject(new Error('userSub is required!'));
        if (!$attr) return Promise.reject(new Error('$attr is required!'));

        const options: any = null; // optional values.
        const $param = Object.assign({}, options || {});
        const $body = Object.assign({}, $attr || {});

        return $proxy()
            .do_put(userPoolId, userSub, undefined, $param, $body)
            .then((_: any) => _.result);
    }

    function do_list_group(userPoolId: any, limit: any) {
        if (!userPoolId) return Promise.reject(new Error('userPoolId is required!'));

        const options: any = null; // optional values.
        const $param = Object.assign({}, options || {});
        if (limit) $param.limit = limit;

        return $proxy()
            .do_get(userPoolId, '!', undefined, $param)
            .then((_: any) => _.result);
    }

    function do_get_group(userPoolId: any, groupId: any) {
        if (!userPoolId) return Promise.reject(new Error('userPoolId is required!'));
        if (!groupId) return Promise.reject('groupId is required!');

        const options: any = null; // optional values.
        const $param = Object.assign({}, options || {});

        return $proxy()
            .do_get(userPoolId, '!' + groupId, undefined, $param)
            .then((_: any) => _.result);
    }

    function do_add_user_to_group(userPoolId: any, groupId: any, userId: any) {
        if (!userPoolId) return Promise.reject(new Error('userPoolId is required!'));
        if (!groupId) return Promise.reject('groupId is required!');
        if (!userId) return Promise.reject('userId is required!');

        const options: any = null; // optional values.
        const $param = Object.assign({}, options || {});
        const $body = { user: userId };

        return $proxy()
            .do_post(userPoolId, '!' + groupId, 'user', $param, $body)
            .then((_: any) => _.result);
    }

    function do_create_group(userPoolId: any, groupName: any, description: any) {
        if (!userPoolId) return Promise.reject(new Error('userPoolId is required!'));
        if (!groupName) return Promise.reject('groupName is required!');

        const options: any = null; // optional values.
        const $param = Object.assign({}, options || {});

        const $body = { description };

        return $proxy()
            .do_post(userPoolId, '!' + groupName, undefined, $param, $body)
            .then((_: any) => _.result);
    }

    //! returns.
    return thiz;
}

export default maker;
