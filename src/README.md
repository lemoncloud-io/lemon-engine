# {{name}}

{{description}}

# Install by NPM

```bash
# install module
$ npm install lemo-engine --save

# update module
$ npm update lemo-engine --save
```

# Usage

- Create internal Service, then build api.

```js
//! define instance scope.
const $scope = {
	name : 'LEMON-MESSAGES'                         // name of scope
	,env : process.env								// environment setting (see below)
}

//! load engine with configuration.
const handler = require('lemo-engine')($scope);

//! instance manager in scope of $scope
const _$ = handler._$;

// data properties.
const FIELDS = [
    'id', 'type', 'parent', 'name', 'message'
];
const ES_FIELDS = FIELDS;

//! create engine for Messages.
const $LEM = _$.LEM(_$, '_'+name, {
    ID_TYPE         : '#STRING',			        // WARN! '#' means no auto-generated id.
    ID_NEXT         : 1000,                         // ID Starts
    FIELDS          : FIELDS,                       // Properties
    DYNA_TABLE      : 'Messages',                   // DynamoDB Table
    REDIS_PKEY      : 'CMMS',                       // REDIS PKEY
    ES_INDEX        : 'messages-v1',				// ES Index Name
    ES_TYPE         : 'messages',					// ES Type Name
    ES_FIELDS       : ES_FIELDS,                    // ES Fields List.
    NS_NAME         : name,                         // Notify Service Name. (null means no notifications)
    ES_MASTER	    : 1,							// ES Master NODE.
    ES_VERSION      : 6,                            // ES Version 6.x.
    CLONEABLE       : true,                         // 복제 가능하며, parent/cloned 필드를 지원함.
    PARENT_IMUT     : false,						// parent-id 변경 가능함(2018.03.15)
    ES_TIMESERIES   : false,                        // Time-Series 데이터로, 시계열 정보를 저장할때 이용함.
	XECURE_KEY      : 'lemon',					    // Encryption Key (use '*' prefix at property name: ver 0.3.22)
});
```

## Environment

- Define Environment for each core service endpoint via http

```yml
#-----------------------------------
# default
default_env: &default_env
  LC: 1                   # line-coloring
  TS: 1                   # line with timestamp.
  SRC: './src/'

  # DynamoDB backbone api
  DS_ENDPOINT:  'http://localhost:8081/dynamo'
  # ElasticSearch backbone api
  ES_ENDPOINT:  'http://localhost:8081/elastic'
  # Redis backbone api
  RS_ENDPOINT:  'http://localhost:8081/redis'
```

----------------
# WARN APPEND BELOW WITH PARENT'S README.md #
