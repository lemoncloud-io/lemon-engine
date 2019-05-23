/* eslint-disable prettier/prettier */
/**
 * S3 Proxy Service Exports
 * - proxy call to s3 service.
 *
 *
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
import { EngineService, EnginePluginService, EnginePluginMaker } from '../common/types';
import httpProxy from './http-proxy';

const maker: EnginePluginMaker = function(_$: EngineService, name?: string, options?: any): EnginePluginService {
    name = name || 'S3';

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
    thiz.do_upload = do_upload;
    thiz.do_get_object = do_get_object;
    thiz.do_save = do_save;

    //! test function.
    thiz.do_test_self = do_test_self;

    //! register service.
    _$(name, thiz);

    /** ****************************************************************************************************************
     *  Internal Proxy Function
     ** ****************************************************************************************************************/
    const ENDPOINT = $U.env('S3_ENDPOINT');
    const $proxy = function() {
        if (!ENDPOINT) throw new Error('env:S3_ENDPOINT is required!');
        const SVC = 'X' + name;
        const $SVC = _$(SVC);
        return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT); // re-use proxy by name
    };

    /** ****************************************************************************************************************
     *  Main Implementation.
     ** ****************************************************************************************************************/
    /**
     * Upload to S3.
     *
     * @param {*} bucketId          bucket-id
     * @param {*} fileName          file-name path
     * @param {*} fileStream
     * @param {*} contentType
     */
    function do_upload(bucketId: any, fileName: any, fileStream: any, contentType: any) {
        if (!bucketId) return Promise.reject(new Error('bucket is required!'));
        if (!fileName) return Promise.reject(new Error('filename is required!'));
        if (!fileStream) return Promise.reject(new Error('filestream is required!'));
        contentType = contentType || '';

        return $proxy()
            .do_post(bucketId, '0', 'upload', undefined, { fileName, fileStream, contentType })
            .then((_: any) => _.result);
    }

    /**
     * Get Data
     *
     * @param {*} bucketId          bucket-id
     * @param {*} fileName          file-name path
     */
    function do_get_object(bucketId: any, fileName: any) {
        if (!bucketId) return Promise.reject(new Error('bucket is required!'));
        if (!fileName) return Promise.reject(new Error('filename is required!'));

        return $proxy()
            .do_post(bucketId, '0', 'get-object', undefined, { fileName })
            .then((_: any) => _.result);
    }

    /**
     * Use `s3-api.do_post_multipart()`.
     *
     * @param {string} bucket        bucket-name (see backbone)
     * @param {string} name          parent path.
     * @param {base64} file          file (base64 encoded or ...)
     * @param {string} type          content-type
     * @param {string} path          parent folder.
     * @param {object} tags     Tagging
     */
    function do_save(bucket: any, name: any, file: any, type: any, path: any, tags: any) {
        if (!bucket) return Promise.reject(new Error('bucket is required!'));
        if (!name) return Promise.reject(new Error('filename is required!'));
        if (!file) return Promise.reject(new Error('filestream is required!'));
        path = path || '';
        type = type || '';

        const body: any = { path, name, file, type };
        if (tags) body.tags = tags;
        return $proxy()
            .do_post(bucket, '0', 'multipart', undefined, body)
            .then((_: any) => _.result);
    }

    //! self test.
    function do_test_self(options: any) {
        options = options || {};
        _log(NS, 'do_test_self()... param=', options);

        const $param = Object.assign({}, options || {});
        return $proxy()
            .do_get('#', '0', 'test-self', $param)
            .then((_: any) => _.result);
    }

    //! returns.
    return thiz;
}

export default maker;
