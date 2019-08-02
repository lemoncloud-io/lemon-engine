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

- [x] 190725 no redis, but es. read description via dynamo directly. (`http ':8086/mail/93371/analyze'`)


----------------
# VERSION INFO #

| Version   | Description
|--         |--
| 2.2.0     | support enhanced type definitions.
| 2.1.8     | support `do_read_deep` for direct reading via dynamodb.
| 2.1.7     | cleanup logs.
| 2.1.6     | support method `PATCH` in `web-proxy`. required `backbone#2.1.4`.
| 2.1.5     | custom web-proxy by `_$.createWebProxy()`.
| 2.1.4     | support relaying headers in `web-proxy`. required `backbone#2.1.3`.
| 2.1.3     | fix ts() error.
| 2.1.1     | improve type hint
| 2.1.0     | refactoring to typescript.
| 2.0.4     | add `agw-proxy` as `AG`. @190509.
| 2.0.0     | rename to `lemon-engine`, and set to public.
