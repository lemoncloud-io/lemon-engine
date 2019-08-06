/**
 * Protocol Proxy Service Exports
 * - proxy call to lemon-protocol-api service.
 *
 *
 * @see lemon-protocol-api/api/protocol-api.js
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
import queryString from 'query-string';
import URL from 'url';

import { EnginePluggable, EnginePluginBuilder } from '../common/types';
import httpProxy, { HttpProxy } from './http-proxy';

export interface ProtocolProxy extends EnginePluggable {
    /**
     * get the current endpoint address.
     */
    endpoint: () => string;

    do_execute: (url: any) => any;
    do_post_execute: (url: any, body: any) => any;
    do_notify: (url: any, callback: any) => any;
    do_post_notify: (url: any, body: any, callback: any) => any;
    do_queue: (url: any) => any;
    do_post_queue: (url: any, body: any) => any;
    build_url: ($url: any) => any;
}

const maker: EnginePluginBuilder<ProtocolProxy> = (_$, name, options) => {
    name = name || 'PR';

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
    const PROXY = { type: '', host: '' };
    const ENDPOINT = $U.env('PROTOCOL_PROXY_API', typeof options == 'string' ? options : '');
    const $proxy = function() {
        const NAME = 'X' + name; // service name.
        const $SVC = _$(NAME, null as HttpProxy);
        if ($SVC) return $SVC;

        //! make instance.
        if (!ENDPOINT) throw new Error('env:PROTOCOL_PROXY_API is required!');

        const aa = ENDPOINT.split('/'); // split 'http://localhost:8092/protocol'
        PROXY.type = aa.pop();
        PROXY.host = aa.join('/');
        _log(NS, 'proxy:' + name + ' config. host=', PROXY.host, ', type=', PROXY.type);
        return httpProxy(_$, NAME, PROXY.host); // re-use proxy by name
    };

    /** ****************************************************************************************************************
     *  Main Implementation.
     ** ****************************************************************************************************************/
    const thiz = new (class implements ProtocolProxy {
        public name = () => `protocol-proxy:${name}`;
        public endpoint = () => ENDPOINT;

        /**
         * Prepare URL string.
         */
        protected chain_prepare_url = (url: any, body?: any, callback?: any) => {
            if (!url) return Promise.reject(new Error('url is required!'));
            const url_str = url && typeof url === 'object' ? this.build_url(url) : url;
            const that: any = { url: url_str };
            if (body !== undefined) that.body = body; // data body to post.
            if (callback !== undefined)
                that.callback = typeof callback === 'object' ? this.build_url(callback) : callback; // callback url (ONLY for SNS)
            return Promise.resolve(that);
        };

        /**
         * Validate URL.
         *
         * @param url (string/object)
         */

        protected chain_validate_url = (that: any) => {
            //! parse URL string if required!.
            const $url = (url => {
                if (typeof url == 'object') return url;
                else if (typeof url == 'string') return URL.parse(url, false);
                else throw new Error('Unknown data-type of url. type:' + typeof url);
            })(that.url || '');
            // parse url
            const protocol = $url.protocol || '';
            const service = $url.hostname || '';

            //1-1. FALSE: protocol is not lemon:
            if (protocol != 'lemon:') return Promise.reject(new Error('protocol should be lemon:. but ' + protocol));

            //1-2. FALSE: service not exist
            if (!service) return Promise.reject(new Error('.service is required!'));

            //! returns.
            return that;
        };

        /**
         * Synchronized Call to URL.
         * - 동기화 실행으로, 내부적으로 Http/Lambda 호출로 Promise() 된 실행 결과를 얻을 수 있음.
         *
         * example:
         * - do_execute('lemon://imweb-pools/goods/0/next-id') => GET 'lemon-imweb-pools-api/goods/0/next-id'
         * - do_execute('lemon://imweb-pools/goods/0/next-id#') => POST 'lemon-imweb-pools-api/goods/0/next-id'
         *
         * @param {string|object} url
         */
        public do_execute(url: any) {
            _log(NS, `do_execute()....`);
            if (!url) return Promise.reject(new Error('url is required!'));
            // // validate url
            // if (!chain_validate_url(url)) return Promise.reject(url);
            // // force url to be 'string' type before sending it
            // const url_str = typeof url === 'object' ? build_url(url) : url;
            // http-proxy.do_get (TYPE, ID, CMD, $param, $body)
            // return $proxy().do_get(PROXY.type, '!', 'execute', {url:url_str});
            return this.chain_prepare_url(url)
                .then(this.chain_validate_url)
                .then(_ => {
                    const url = _.url || '';
                    return $proxy().do_get(PROXY.type, '!', 'execute', { url });
                });
        }

        /**
         * Synchronized Call to URL for post
         * - 동기화 실행으로, 내부적으로 Http/Lambda 호출로 Promise() 된 실행 결과를 얻을 수 있음.
         *
         * @param {string|object} url
         * @param {string|object} body
         * @returns {Promised}
         */
        public do_post_execute(url: any, body: any) {
            _log(NS, `do_post_execute()....`);
            if (!url) return Promise.reject(new Error('url is required!'));

            // // validate url
            // if (!chain_validate_url(url)) return Promise.reject(url);
            // // force url to be 'string' type before sending it
            // const url_str = typeof url === 'object' ? build_url(url) : url;
            // // http-proxy.do_get (TYPE, ID, CMD, $param, $body)
            // return $proxy().do_post(PROXY.type, '!', 'execute', {url:url_str}, body);
            return this.chain_prepare_url(url, body)
                .then(this.chain_validate_url)
                .then(_ => {
                    const url = _.url || '';
                    const body = _.body || '';
                    return $proxy().do_post(PROXY.type, '!', 'execute', { url }, body);
                });
        }

        /**
         * Asynchronized Call to URL.
         * - 비동기식 실행으로, 내부적으로 SNS를 활용하기도 한다.
         *
         * @param {string|object} url
         * @param {string|object} callback		SNS Notification 실행후, 결과 처리를 받기 위해서 추가됨 @181125
         * @returns {Promised}
         */
        public do_notify(url: any, callback: any) {
            _log(NS, `do_notify()....`);
            if (!url) return Promise.reject(new Error('url is required!'));

            // // validate url
            // if (!chain_validate_url(url)) return Promise.reject(url);
            // // force url to be 'string' type before sending it
            // const url_str = typeof url === 'object' ? build_url(url) : url;
            // // http-proxy.do_get (TYPE, ID, CMD, $param, $body)
            // return $proxy().do_get(PROXY.type, '!', 'notify', {url:url_str});
            return this.chain_prepare_url(url, '', callback)
                .then(this.chain_validate_url)
                .then(_ => {
                    const url = _.url || '';
                    // const body = _.body||'';
                    const callback = _.callback || '';
                    return $proxy().do_get(PROXY.type, '!', 'notify', { url, callback });
                });
        }

        /**
         * Asynchronized Call to URL for post
         * - 비동기식 실행으로, 내부적으로 SNS를 활용하기도 한다.
         *
         * @param {string|object} url
         * @param {string|object} body
         * @param {string|object} callback		SNS Notification 실행후, 결과 처리를 받기 위해서 추가됨 @181125
         * @returns {Promised}
         */
        public do_post_notify(url: any, body: any, callback: any) {
            _log(NS, `do_post_notify()....`);
            if (!url) return Promise.reject(new Error('url is required!'));

            // // validate url
            // if (!chain_validate_url(url)) return Promise.reject(url);
            // // force url to be 'string' type before sending it
            // const url_str = typeof url === 'object' ? build_url(url) : url;
            // // http-proxy.do_post (TYPE, ID, CMD, $param, $body)
            // return $proxy().do_post(PROXY.type, '!', 'notify', {url:url_str}, body);
            return this.chain_prepare_url(url, body, callback)
                .then(this.chain_validate_url)
                .then(_ => {
                    const url = _.url || '';
                    const body = _.body || '';
                    const callback = _.callback || '';
                    // return $proxy().do_post(PROXY.type, '!', 'notify', {url}, body);				//! original code.
                    // ! 기존의 호환성 유지를 위해서, 변경된 규칙은 body에 {url, body, callback} 구조체로 보낸다.
                    return $proxy().do_post(PROXY.type, '!', 'notify', '', _); //! support callback @181125.
                });
        }

        /**
         * Asynchronized Call to URL via SQS
         * - 비동기식 실행으로, 내부적으로 SQS를 활용하기도 한다.
         *
         * @param {string|object} url
         * @returns {Promised}
         */
        public do_queue(url: any) {
            _log(NS, `do_queue()....`);
            if (!url) return Promise.reject(new Error('url is required!'));

            // // validate url
            // if (!chain_validate_url(url)) return Promise.reject(url);
            // // force url to be 'string' type before sending it
            // const url_str = typeof url === 'object' ? build_url(url) : url;
            // // http-proxy.do_get (TYPE, ID, CMD, $param, $body)
            // return $proxy().do_get(PROXY.type, '!', 'notify', {url:url_str});
            return this.chain_prepare_url(url)
                .then(this.chain_validate_url)
                .then(_ => {
                    const url = _.url || '';
                    // const body = _.body||'';
                    return $proxy().do_get(PROXY.type, '!', 'queue', { url });
                });
        }

        /**
         * Asynchronized Call to URL for post via SQS
         * - 비동기식 실행으로, 내부적으로 SQS를 활용하기도 한다.
         *
         * @param {string|object} url
         * @param {string|object} body
         * @returns {Promised}
         */
        public do_post_queue(url: any, body: any) {
            _log(NS, `do_post_queue()....`);
            if (!url) return Promise.reject(new Error('url is required!'));

            // // validate url
            // if (!chain_validate_url(url)) return Promise.reject(url);
            // // force url to be 'string' type before sending it
            // const url_str = typeof url === 'object' ? build_url(url) : url;
            // // http-proxy.do_post (TYPE, ID, CMD, $param, $body)
            // return $proxy().do_post(PROXY.type, '!', 'notify', {url:url_str}, body);
            return this.chain_prepare_url(url, body)
                .then(this.chain_validate_url)
                .then(_ => {
                    const url = _.url || '';
                    const body = _.body || '';
                    // return $proxy().do_post(PROXY.type, '!', 'notify', {url}, body);				//! original code.
                    // ! 기존의 호환성 유지를 위해서, 변경된 규칙은 body에 {url, body} 구조체로 보낸다.
                    return $proxy().do_post(PROXY.type, '!', 'queue', '', { url, body });
                });
        }

        /**
         * 프로토콜 형식 다음과 같음.
         * `lemon://<sid?>@<service-name>/<type>/<id?>/<cmd?>?<param>#<body>`
         *
         * sid           : site/session-id 로 서비스를 실행할 계정
         * service-name  : 실행할 서비스의 이름 (예: `messages` => `lemon-messages-api`)
         * type          : 서비스내 API의 이름 (예: `user`)
         * id            : 선택) 서비스 API의 ID 값.
         * cmd           : 선택) 서비스 API의 CMD 값.
         * param         : QueryString 형태의 전달 파라미터.
         * body          : QueryString (또는 json 형식) 형태의 body 파라미터. (json 일때는 '{[,]}'으로 감쌈)
         */
        public build_url($url: any) {
            $url = $url || {};
            const PROTOCOL = 'lemon://';
            const sid = $url.sid || $url.SID;
            const service = $url.service || $url.SERVICE;
            const type = $url.type || $url.TYPE;
            const id = $url.id || $url.ID;
            const cmd = $url.cmd || $url.CMD;
            const $param = $url.param || $url.$param || $url.PARAM;
            const param = typeof $param === 'object' ? queryString.stringify($param) : $param;
            const $body = $url.body || $url.$body || $url.BODY;
            const body = typeof $body === 'object' ? queryString.stringify($body) : $body;

            //! as URL string.
            const url =
                PROTOCOL + // Madatory => lemon://
                (sid ? encodeURIComponent(sid) + '@' : '') + // Optional => sid@
                service + // Madatory => service
                (type ? '/' + encodeURIComponent(type) : '/') + // Partial Madatory => /type
                (id ? '/' + encodeURIComponent(id) : '') + // Optional	=> /id
                (cmd ? '/' + encodeURIComponent(cmd) : '') + // Optional => /cmd
                (param ? '?' + param : '') + // Optional => ?param
                (body ? '#' + body : ''); // Optional => #body

            return url;
        }
    })();

    //! create & register service.
    return _$(name, thiz);
};

export default maker;
