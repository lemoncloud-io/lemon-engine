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
    name : 'LEMON'                      // name of scope
    ,env : process.env||{}              // environment settings for backbone service url.
}

//! load engine with environment scope.
const engine = require('lemon-engine')($scope);

//! instance manager in scope of $scope
const _$ = engine._$;

// deefine properties.
const FIELDS = [
    'id', 'type', 'parent', 'name', ...
];
const ES_FIELDS = FIELDS;

//! config engines (as example)
const $LEM = _$.LEM(_$, '_'+name, {
    ID_TYPE         : '#STRING',        // WARN! '#' means no auto-generated id.
    ID_NEXT         : 1000,             // ID Starts
    FIELDS          : FIELDS,           // Properties
    DYNA_TABLE      : 'Lemons',         // DynamoDB Table
    REDIS_PKEY      : 'CMMS',           // REDIS PKEY
    ES_INDEX        : 'lemons-v1',      // ES Index Name
    ES_TYPE         : 'none',           // ES Type Name (deprecated since ES6)
    ES_FIELDS       : ES_FIELDS,        // ES Fields List.
    NS_NAME         : name,             // Notify Service Name. (null means no notifications)
    ES_MASTER       : 1,                // ES Master NODE.
    ES_VERSION      : 6,                // ES Target Version (6 means 6.x)
    CLONEABLE       : true,             // Clonable with parent/cloned property.
    PARENT_IMUT     : false,            // Immutable of parent property (2018.03.15)
    ES_TIMESERIES   : false,            // As time-Series data, useful when saving time-series.
    XECURE_KEY      : 'lemon',          // Encryption Key (use '*' prefix at property name: ver 0.3.22)
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
