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
# VERSION INFO #

| Version   | Description
|--         |--
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

