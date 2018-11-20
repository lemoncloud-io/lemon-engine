# lemon-engine

레몬 코어 엔진으로, 백엔드 서버에 `lemon-backend-api` 가 있어야 함.

* npm 패키지로 `lemoncloud-engine-js`를 배포시킴.

## REQUIREMENT

모듈 개발용 메인 소스로 다음과 같은 프로세스로 개발

1. 여기에 메인 소스가 관리됨.
1. 자체 Unit Test가 작동하여야 함.
1. public 소스는 `npm publish`를 통해서 배포되며, 배포 모듈은 `lemon-engine-js` 임.
1. 버전은 package.json에 업데이트 시켜줌.


# NPM 모듈 배포

배포하기 순서

1. package.json 의 version 정보를 변경
1. `$ npm run publish` 실행
1. [lemoncloud-engine-js](https://www.npmjs.com/package/lemoncloud-engine-js) 으로 배포됨.


# LOCAL 실행

* Proxy 서버의 개발/디버깅 목적으로 이 엔진을 로컬에서 실행 가능함

```bash
# run backend api 
$ cd ../lemon-backend-api && npm run server-local

# run lemon-engine with proxy service
$ nodemon express --port 8082

# test api
$ http localhost:8082/user/
```


----------------
# 개발 참고 

Feature 추가 관련 도움말.

## 암호화 필드 사용 (ver: 0.3.22)

- 암호화는 지원을 위한 방법은 아래와 같음.
- 그러면, DynamoDB에는 암호화된 값이 저장되며, api 에서는 자동으로 복호화된 값을 얻을 수 있음.

```js
// 필드명 앞에 '*'를 붙여준다.
FIELDS = [..., '*passwd']

// LEM() 설정에서, 암호키를 설정함. 기본값은 아래와 같음.
const $LEM = LEM(_$, '_'+name, {			// use '_' prefix for LEM instance. 
    ...
    XECURE_KEY  : ('LM~1212@'+name),		// Encryption Key (use '*' prefix at property name)
    ...
});

//! do_read() 부분에, 아래와 같이 do_readX 를 이용함.
thiz.do_read = (_id, $params) => {
    ....
    .then(0 ? $LEM.do_read : $LEM.do_readX)			// use do_readX for decryption.
    ...
}
```


----------------
# VERSION INFO #

| Version   | Description
|--         |--
| 1.0.5     | use elasticsearch as 1st cache. see `REDIS_PKEY = '#'`.
| 1.0.4     | optimized 'do_readX' for xecured property.
| 1.0.3     | add 'do_post_execute_notify'
| 1.0.2     | `do_saveES()` direct save into ES.
| 1.0.1     | updated package dependencies
| 1.0.0     | support in-memory cache for node transaction.
| 0.3.25    | `s3-proxy` support `tags` for S3 Tagging.
| 0.3.24    | add `s3-proxy` as `S3`. @180913.
| 0.3.23    | cognito: `do_get_confirm_user()`. @180911.
| 0.3.22    | support xecured fields see `XECURE_KEY`. @180801.
| 0.3.21    | add 'do_post_execute_protocol'
| 0.3.20    | try to parse body for `http-proxy`.
| 0.3.19    | get stringified param and body for `protocol-proxy`.
| 0.3.18    | add `protocol-proxy`.
| 0.3.17    | optimize `http-proxy`.
| 0.3.16    | optimize log msg.
| 0.3.15    | add ses-proxy as `SE`.
| 0.3.14    | add sqs stat as `$SS.do_statistics()`.
| 0.3.13    | lambda-proxy as 'LS'. set `LS_ENDPOINT`.
| 0.3.12    | optimize 404 error message.
| 0.3.11    | allow ipp to be set 0. 
| 0.3.10    | sns-proxy as 'SN'
| 0.3.9     | support ES6 with `ES_VERSION = 6`.
| 0.3.8     | minor fix for log of redis:my_save_node
| 0.3.7     | mysql id-generator configuration (see `$LEM.do_next_id()`).
| 0.3.6     | fix ElasticSearch create index error due to 'string'.
| 0.3.5     | support as `_$.httpProxy(_$, name, uri)`.
| 0.3.4     | fix require error.
| 0.3.3     | add httpProxy service. (use `_$.createHttpProxy(name, endpoint)`)
| 0.3.2     | cognito service - manager user/group.
| 0.3.1     | remove MMS,user,group service. and add cognito service.
| 0.2.13    | cognito-proxy as 'CS'
| 0.2.12    | try to create node in dynamo if error of "an attribute that does not exist in the item"
| 0.2.5     | web-proxy as 'WS'
| 0.2.4     | record event handler
| 0.2.3     | sqs-proxy as 'SS'
| 0.2.0     | support scope during initialize

