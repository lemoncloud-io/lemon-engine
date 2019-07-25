# lemon-engine

레몬 코어 엔진으로, 노드 동기화 관련 핵심 모듈

- npm 패키지로 `lemon-engine`를 배포시킴.
- 백엔드 서버에 `lemon-backend-api` 별도 실행 필요!

## Overview

- NoSQL (DynamoDB) <-> ElastiSearch <-> Redis 데이터 동기화
- DynamoDB 업데이트시 -> 업데이트 Stream 수신 -> 변경 데이터 추적 -> ES 와 동기화.


## Usage (사용법)

- install with npm `npm install lemon-engine --save`

- create internal Service with data model

```js
import engine from 'lemon-engine';

//! create engine in global scope.
const $engine = engine(global, { env: process.env });

// deefine properties.
const FIELDS = [
    'id', 'type', 'parent', 'name', ...
];
const ES_FIELDS = FIELDS;

//! config engines (as example)
const $model = $engine.createModel(`${name}`, {
    ID_TYPE         : '#STRING',        // WARN! '#' means no auto-generated id.
    ID_NEXT         : 0,                // ID Starts
    FIELDS          : FIELDS,           // Properties
    DYNA_TABLE      : 'LemonTable',     // DynamoDB Table
    REDIS_PKEY      : '#TDQ',           // '#' means no use redis, but elastic as cache.
    ES_INDEX        : 'lemons-v1',      // ES Index Name
    ES_TYPE         : 'none',           // ES Type Name (deprecated since ES6)
    ES_FIELDS       : ES_FIELDS,        // ES Fields List.
    NS_NAME         : name,             // Notify Service Name. (null means no notifications)
    ES_MASTER       : 1,                // ES Master NODE.
    ES_VERSION      : 6,                // ES Target Version (6 means 6.x)
    CLONEABLE       : true,             // Clonable with parent/cloned property.
    PARENT_IMUT     : false,            // Immutable of parent property (2018.03.15)
    ES_TIMESERIES   : false,            // As time-Series data, useful when saving time-series.
    XECURE_KEY      : 'lemon',          // (optional) Encryption Key (use '*' prefix at property name: ver 0.3.22)
});
```

- build CRUD common service functions.

```js
//! search by param
// ex) { id: 1234 } => search by `id == 1234`.
const do_search = (id, param) => {
    _log(NS, `do_search(${id})... param=`, $U.json(param));
    return $model.do_search(id, param);
};
```


## Installation (설치법)

- `lemon-backend-api` 백본 서비스 구성
- `npm run deploy` 로 AWS Cloud Lambda 에 자동 배포


## NPM 모듈 배포

배포하기 순서

1. `package.json` 의 `version` 정보를 변경
1. `$ npm run publish` 실행 (단, npm 로그인 필요!)
1. [lemon-engine](https://www.npmjs.com/package/lemon-engine) 으로 배포됨.


## TODO

- [ ] 190725 no redis, but es. read description via dynamo directly. (`http ':8086/mail/93371/analyze'`)


----------------
# VERSION INFO #

| Version   | Description
|--         |--
| 2.1.7     | cleanup logs.
| 2.1.6     | support method `PATCH` in `web-proxy`. required `backbone#2.1.4`.
| 2.1.5     | custom web-proxy by `_$.createWebProxy()`.
| 2.1.4     | support relaying headers in `web-proxy`. required `backbone#2.1.3`.
| 2.1.3     | fix ts() error.
| 2.1.1     | improve type hint
| 2.1.0     | refactoring to typescript.
| 2.0.4     | add `agw-proxy` as `AG`. @190509.
| 2.0.0     | rename to `lemon-engine`, and set to public.
| 1.0.22    | improve log
| 1.0.21    | `environ.TS` for time-stamp.
| 1.0.20    | add $exist for elasticsearch to check existing field
| 1.0.19    | add do_queue_protocol in protocol-proxy
| 1.0.18    | add highlight $H for elasicsearch
| 1.0.17    | add 'qs_parse', 'qs_stringify' in utility
| 1.0.16    | `cron-proxy` support `Rules` in CloudWatch.
| 1.0.15    | reserved search param page/ipp.
| 1.0.14    | impromve ES6 index initializer. see `do_initialize()`
| 1.0.13    | support callback(url) as `$protocol().do_post_notify_protocol(url, body, callback)` vis SNS.
| 1.0.12    | bug: _current_time error in records
| 1.0.11    | bug: save when 404 NOT FOUND
| 1.0.10    | improve validate_properties.
| 1.0.9     | `ES_TIMESERIES` - onRecords, do not update cache if timeseries.
| 1.0.8     | `ES_TIMESERIES` to support Time-Series Data (ex: item-trace)
| 1.0.6     | hot-fix of iota.
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

