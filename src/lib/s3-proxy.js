/**
 * S3 Proxy Service Exports
 * - proxy call to s3 service.
 *
 * 
 * 
 * author: Tony Sung <tony@lemoncloud.io>
 * date : 2018-08-08
 *
 * Copyright (C) 2018 LemonCloud Co Ltd. - All Rights Reserved.
 */
module.exports = (function (_$, name) {
	"use strict";
	name = name || 'S3';

	const $U = _$.U;                                // re-use global instance (utils).
	const $_ = _$._;                             	// re-use global instance (_ lodash).

	if (!$U) throw new Error('$U is required!');
	if (!$_) throw new Error('$_ is required!');

	const NS = $U.NS(name, 'yellow');				// NAMESPACE TO BE PRINTED.

	//! load common functions
	const _log = _$.log;
	const _inf = _$.inf;
	const _err = _$.err;

	//! prepare instance.
	const thiz = {};

	//! item functions.
	thiz.do_upload 		= do_upload;
	thiz.do_get_object 	= do_get_object;
	thiz.do_save 	    = do_save;

	//! test function.
	thiz.do_test_self   = do_test_self;

	//! register service.
	_$(name, thiz);

	/** ****************************************************************************************************************
	 *  Internal Proxy Function
	 ** ****************************************************************************************************************/
	const ENDPOINT = $U.env('S3_ENDPOINT');
	const httpProxy = require('./http-proxy');
	const $proxy = function(){
		if (!ENDPOINT) throw new Error('env:S3_ENDPOINT is required!');
		const SVC = 'X'+name;
        const $SVC = _$(SVC);
		return $SVC ? $SVC : httpProxy(_$, SVC, ENDPOINT);		// re-use proxy by name
	}

		
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
	function do_upload(bucketId, fileName, fileStream, contentType){
		if (!bucketId) return Promise.reject(new Error('bucket is required!'));
		if (!fileName) return Promise.reject(new Error('filename is required!'));
        if (!fileStream) return Promise.reject(new Error('filestream is required!'));
        contentType = contentType||'';

		return $proxy().do_post(bucketId, '0', 'upload', undefined, {fileName, fileStream, contentType})
		.then(_ => _.result);
	}

    /**
     * Get Data
     * 
     * @param {*} bucketId          bucket-id
     * @param {*} fileName          file-name path
     */
	function do_get_object(bucketId, fileName){
		if (!bucketId) return Promise.reject(new Error('bucket is required!'));
		if (!fileName) return Promise.reject(new Error('filename is required!'));

		return $proxy().do_post(bucketId, '0', 'get-object', undefined, {fileName})
		.then(_ => _.result);
    }


    /**
     * Use `s3-api.do_post_multipart()`.
     * 
     * @param {*} bucket        bucket-name (see backbone)
     * @param {*} name          parent path.
     * @param {*} file          file (base64 encoded or ...)
     * @param {*} type          content-type
     * @param {*} path          parent folder.
     */
	function do_save(bucket, name, file, type, path){
		if (!bucket) return Promise.reject(new Error('bucket is required!'));
		if (!name) return Promise.reject(new Error('filename is required!'));
        if (!file) return Promise.reject(new Error('filestream is required!'));
        path = path||'';
        type = type||'';

		return $proxy().do_post(bucket, '0', 'multipart', undefined, {path, name, file, type})
		.then(_ => _.result);
	}
    
    //! self test.
	function do_test_self (options){
		options = options||{};
		_log(NS, 'do_test_self()... param=', options);

		const $param = Object.assign({}, options||{});
		return $proxy().do_get('#', '0', 'test-self', $param)
		.then(_ => _.result);
	}

	//! returns.
	return thiz;
});

