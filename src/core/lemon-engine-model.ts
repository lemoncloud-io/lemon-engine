/* eslint-disable prettier/prettier */
/**
 * Lemon Engine Model Of Node (LEMON)
 * - Lemon Engine Model Implementation as common core module.
 * - 노드의 라이프싸이클을 관리하기 위한 핵심 모델 구현.
 *
 * ---------------------------
 * ## Environment
 *  - DynamoDB       : Main NoSQL Database storage w/ stream.
 *  - Redis          : Internal Quick Cache storage. (Optional)
 *  - ElasticSearch  : Search & Query Service instead of DynamoDB query.
 *  - SQS (Optional) : Queue task schedule (or buffering).
 *  - SNS (Optional) : Notification Service.
 *  - In Memory Cache: Internal Cache Memory for short time cache (@181002)
 *
 *
 * ---------------------------
 * ## Node LifeCycle
 *  - Prepared  : 생성된기 전 단계 (ID생성) Next :=> Created
 *  - Created   : 생성되고 활성화 단계.     Next :=> Updated, Deleted
 *  - Updated   : 이후 업데이트된 상태.     Next :=> Deleted.
 *  - Deleted   : 삭제된 상태.            Next :=> Prepared.
 *
 *
 * ---------------------------
 * ## Node State (Condition)
 *  - created_at : millisecond value of UTC+0. (0 means NULL).
 *  - updated_at : !IMPORTANT! used to track the updated event.
 *  +-----------------------------------------------------------+
 *  | State     | created_at    | updated_at    | deleted_at    |
 *  |-----------|---------------|---------------|---------------|
 *  | Prepared  | NULL (or 0)   | current       | current       |
 *  | Created   | current(ms)   | current       | NULL          |
 *  | Updated   | _             | current       | _             |
 *  | Deleted   | _             | current       | current       |
 *  +-----------------------------------------------------------+
 *
 *
 * ---------------------------
 * ## Method 에 대한 정의.
 *  # 함수의 기본형은 function(id, $node) 이며, 또는 function({id, ...}) 형태도 유효하다
 *  - prepare()     : 데이터 저장을 위한 저장소를 준비. (id가 있을경우 사용하고, 아니면 새로 생성됨) (상태 := Prepared) !중요! DEFAULT 값으로 초기화 됨.
 *  - create()      : 초기 데이터를 생성하는 것으로, 입력 파라미터로 데이터를 저장 시켜 줌. (기본값외의 값이 설정되면, event 로 변경 추적 가능함)
 *                     : 추가 사항! 기존 저장된 노드는 없고, 새로운 ID가 주어진 상태에서 create() 호출하면, 새로운 노드를 생성한다.
 *                     : _force_create = true 일 경우, 상태 무시하고 create로 변경함.
 *  - clone()       : 해당 노드를 클론 함, 입력 파라미터로 클론한 노드의 데이터 초기화 시켜줌 (parent, cloned 를 활용함: see below)
 *  - update()      : 업데이트할 항목만 있음. (때론, 원본과 비교하여 변경된 값을 추적하여 저장할 수 있음)
 *  - increment()   : Atomic Update. {"stock":1,"count":-1} => stock += 1, count -= 1.
 *  - read()        : 현재 노드의 전체 데이터를 읽음. 만일 입력으로 $node 가 있을 경우, Projection 된 부분만 읽어옴 (일부 데이터만). see: auto_populate
 *  - delete()      : 해당 노드를 지운다 (실제로 지우지는 않고 Deleted 상태가 됨).
 *  - destroy()     : 해당 노드를 완전히 지운다 (진짜로 지음).
 *  - search()      : 검색 지원. => ES 에서 지원 함 (Mini Lang). {"name":"<1", "is_soldout":1}
 *  - initialize()  : 주위! Table 생헝하는 등의 자원을 생성한다.
 *  - terminate()   : 주위! 생성된 Table 을 지우는 등, 자원을 제거한다.
 *  - test_self()   : Unit 테스트를 진행한다.
 *
 *  # Dynamo/Kinesis 등 AWS 스트림 전용 처리기.
 *  - on_records()  : Dynamo 에서 Records 정보가 업데이트되어 발생한 이벤트 처리.
 *
 *  # Notify Event 처리 관련.
 *  - notify()      : notify event (async)를 발생시키고, 이벤트 처리기를 호출한다.
 *  - subscribe()   : notify event (async)를 수신할 수 있는 처리기를 등록한다.
 *
 *
 * ---------------------------
 * ## Node DataFlow : Save -> Stream -> Sync Cache -> Notify.
 *  1. Node 가 업데이트되면, 항상 DynamoDB 에 저장한다.
 *      - SQS 가 있다는 가정하에, Table 의 업데이트 순서가 보장. (문제점: updated_at의 실제 저장 시점이 시간순으로 안될 수도....)
 *
 *  2. DynamoDB가 업데이트가 되면, 자동으로 Stream 으로 업데이트 이벤트가 발생함.
 *      - Local 에서는 Stream 의 Trigger 작동을 수동으로 돌림 (dynamo-stream).
 *      - AWS 에서는 Stream 을 Lambda 로 연결 (Trim Horizon).
 *        ex) event.Records.forEach( record => record.dynamodb[''] )
 *
 *  3. Stream 를 통해서, 업데이트 Node 정보와 캐쉬된 Node 를 비교.
 *      - Redis.updated_at 과 Stream.updated_at 를 비교
 *      - Redis 에서 전체 노드를 읽어들이면 느리므로, updated_at만 따로 저장.
 *
 *  4. 캐쉬된 Node.updated_at <= 업데이트 Node.updated_at 일 경우, 캐쉬를 업데이트 한다.
 *      - hash(node) != redis.object_hash 이면, 업데이트!
 *
 *  5. Stream 내용을 이용하여, 변경된 값을 추적하고 -> Notify 할 수 있을 수 있다.
 *      - Head: state, body: updated set.
 *
 *
 * ---------------------------
 * ## In Memory Cache  @181002.
 * [Problem]
 * - Transaction broken as do_read() -> do_update() -> do_read(). due to redis read/write timing.
 * [Solution]
 *  1. Use internal short memory for node cache with cached_at time (prevent long-term cache, time-out 2 sec)
 *  2. Validate primitive types of node-attributes => do update only the updated fields.
 *
 *
 *
 * ---------------------------
 * ## Event (Records) 처리 방법.
 *  1. on_records() 를 통해서, Records[] 정보가 전달됨.. _.each(records, (record) => ...)
 *  2. INSERT/REMOVE 일 경우, 그냥 업데이트 실행.
 *  3. MODIFY 일 경우:
 *      - new.updated_at >= redis.updated_at ? 다음 단계 : 무시.      (시간 비교)
 *      - hash(new) != redis.object_hash ? 다음 단계 : 무시.          (hash비교하여, redis에서 전체 node를 읽어들이는 오버해드 없앰)
 *      - save_node (new)
 *  4. Notify Event
 *
 *
 * ---------------------------
 * ## Clone 처리 방법.
 *  1. 해당 Node ID 에서, Clone 을 실행.
 *  2. 입력으로 {parent} 정보를 지정할 수 있음. (없을 경우 현재 Node ID 가 parent 됨).
 *      - parent 는 같은 타입의 valid 한 노드일 경우 가능.
 *      - Circular 를 방지하기 위해서, parent 는 grand-parent 가 Null 인 경우에 가능.
 *      - 형제들: 복제된 Node 가 같은 parent 를 공유.
 *      - 자식들: 복제된 Node 가 해당 Node 를 parent 로 가짐.
 *  3. cloned 는 현재 Node ID 로 설정.
 *      - 복제되면, 추가적으로 that 파라미터에 다음 내용이 추가됨 (if applicable)
 *      - that.parent := node.parent.
 *      - that.cloned := node.cloned.
 *  4. parent/cloned 는 Immutable 으로, 생성 시점에 지정되며, 이후 변경 불가!!!.
 *
 *
 * ---------------------------
 * ## Notify 처리 방법.
 *  1. bootup: 내부 핸들러는 부팅때 등록하며, callback 함수로 전달 됨. 형식) subscribe(ID, handler).
 *  2. Notify ID 형식은 "서비스 NS+Name" 으로 고유한 값을 가진다. 예) LEM:hello => LEM 모듈에서 hello 라는 것.
 *  3. 외부 핸들러는 http URL 전달로 등록 가능. (json 데이터 통신)
 *      - 그런데, serverless 에서는 내부 저장 유지가 안되므로, 외부 설정이 필요할듯. (TBD)
 *  4. Core/Meta 로 분리될 경우, Core 가 업데이트 되었을 때에만 상위로 Notify 를 발생. (ex: ICS -> IIS -> Outter)
 *
 *
 * ---------------------------
 * ## 이름규칙 (Naming Rules)
 *  - item vs item-core : item_id를 id (PK)으로 공유해서 사용한다.
 *  - item vs deal : id가 서로 다르게 관리됨 (item_id vs deal_id)
 *  - NoSQL 디비에 저장되는 테이블은 자바 이름 규칙: 예) ItemCoreTable, ItemMetaTable.
 *  - NoSQL 데이터 변수 이름 규치: 소문자,'_' 구분자. 예) stock, stock_count.
 *
 *
 * ---------------------------
 * ## 변수 이름 사용 규칙.
 *  - $node: NoSQL로 표현되는 데이터의 묶음. (비슷한 의미에서 tuple)
 *  - xxxx : primitive variable.
 *  - $xxxx : object variable (internal). ex) prod.$item
 *  - CAPITAL : object variable (external). ex) prod.ITEM
 *  - Single CAPITAL char : Reserved variable like version. ex) V: Version, R: Revision.
 *  - do_xxxx() : public promised function to export.
 *  - my_xxxx() : private promised function locally.
 *  - my_chain_xxxx() : internal promised function.
 *  - on_xxxx() : event consumer.
 *
 *
 * ---------------------------
 * ## Node 버전 관리 규칙
 *  - Version 은 V, Revision 은 R 으로 저장함 (모두 Number 형)
 *  - Create() 실행시, V := version, R := 0 으로 설정함.
 *  - Update()/Increment() 실행시 항상 R := R + 1 으로 증분시킴.
 *  - Version 은 노드 저장 엔진의 버전을 따라감.
 *
 * ---------------------------
 * ## HISTORY
 *  - 1.0.8 시계열데이터를 ES_TIMESERIES로 지원함 => save() 자동 timestamp 저장하고, DynamoTable 에는 마지막 상태만 저장.
 *
 * ---------------------------
 * ## TODO LIST - LEMON
 *  - 중요 자원의 History 저장 기능 (Reason CODE, Data) => S3/File/RDB/LogStash.
 *  - Log with CloudWatch : http://resources.intenseschool.com/amazon-aws-how-to-monitor-log-files-using-cloudwatch-logs/
 *  - ElasticSearch: ES_FIELDS 항목에서 계산된 결과를 저장 예) deleted := deleted_at > 0
 *  ! FIELDS 지정할때 데이터 타입(Number, String, Array, Object) 가능하도록.
 *
 *
 * ---------------------------
 * ## Example Record.
 [ { eventID: '1d444306013fa3c9f49d7acc3b34cdec',
    eventName: 'INSERT',
    eventVersion: '1.1',
    eventSource: 'aws:dynamodb',
    awsRegion: 'ap-northeast-2',
    dynamodb:
     { ApproximateCreationDateTime: 1502532780,
       Keys: [Object],
       NewImage: [Object],
       SequenceNumber: '300000000000596866043',
       SizeBytes: 18,
       StreamViewType: 'NEW_AND_OLD_IMAGES' },
    eventSourceARN: 'arn:aws:dynamodb:ap-northeast-2:820167020551:table/TestTable/stream/2017-08-12T09:51:57.928' } ]
 *
 *
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
import { EnginePluggable, EnginePluginBuilder, GeneralFuntion } from '../common/types';
import DynamoDBValue from './dynamodb-value'; // DynamoDB Data Converter.
import crypto from "crypto";    //! to avoid Deprecated warning.

import notifier from '../plugins/notify-service';
import { MysqlProxy } from '../plugins/mysql-proxy';
import { DynamoProxy } from '../plugins/dynamo-proxy';
import { RedisProxy } from '../plugins/redis-proxy';
import { Elastic6Proxy } from '../plugins/elastic6-proxy';

export interface LemonEngineModel extends EnginePluggable {
    //! say hello()
    hello: GeneralFuntion;

    // search items by query.
    do_search: GeneralFuntion;
    // read-back $node by id.
    do_read: GeneralFuntion;
    // read-back $node by id (with decryption).
    do_readX: GeneralFuntion;
    // Read Node in deep - read direct from dynamo.
    do_read_deep: GeneralFuntion;
    // update $node by id. (updated_at := now)
    do_update: GeneralFuntion;
    // increment by count ex) stock = stock + 2.
    do_increment: GeneralFuntion;
    // mark deleted by id (deleted_at := now)
    do_delete: GeneralFuntion;
    // destroy $node by id (real deletion).
    do_destroy: GeneralFuntion;
    // get the next generated-id if applicable.
    do_next_id: GeneralFuntion;

    //! prepare dummy $node with new id. (created_at := 0, deleted_at=now)
    do_prepare: GeneralFuntion;
    //! create $node with given id (created_at := now, updated_at := now, deleted_at=0).
    do_create: GeneralFuntion;
    //! clone the current node. (parent, clones)
    do_clone: GeneralFuntion;

    // initialize environment based on configuration.
    do_initialize: GeneralFuntion;
    // terminate environment based on configuration.
    do_terminate: GeneralFuntion;

    // records events.
    on_records: GeneralFuntion;
    // trigger notify event.
    do_notify: GeneralFuntion;
    // subscribe notify event.
    do_subscribe: GeneralFuntion;

    // test self
    do_test_self: GeneralFuntion;
    // save directly to elastic-search.
    do_saveES: GeneralFuntion;
    // manual clear redis.
    do_cleanRedis: GeneralFuntion;
}

const buildModel: EnginePluginBuilder<LemonEngineModel> = (_$, name, options) => {
    const NS_NAME = name || 'LEM';

    const $U = _$.U;                                // re-use global instance (utils).
    const $_ = _$._;                                // re-use global instance (_ lodash).
    const $MS = _$('MS') as MysqlProxy;             // re-use global instance (mysql-service).
    const $DS = _$('DS') as DynamoProxy;            // re-use global instance (dynamo-service).
    const $RS = _$('RS') as RedisProxy;             // re-use global instance (redis-service).
    const $ES5 = _$('ES') as Elastic6Proxy;         // re-use global instance (elasticsearch-service).
    const $ES6 = _$('ES6') as Elastic6Proxy;        // re-use global instance (elastic6-service).

    if (!$U) throw new Error('$U(utilities) is required!');
    if (!$_) throw new Error('$_(underscore) is required!');
    if (!$MS) throw new Error('$MS is required!');
    if (!$DS) throw new Error('$DS is required!');
    if (!$RS) throw new Error('$RS is required!');
    // if (!$ES5) throw new Error('$ES is required!');
    if (!$ES6) throw new Error('$ES6 is required!');

    //! load common(log) functions
    const _log = _$.log;
    const _inf = _$.inf;
    const _err = _$.err;

    //! NAMESPACE
    const NS = $U.NS(NS_NAME, "green");                    // NAMESPACE TO BE PRINTED.

    /** ****************************************************************************************************************
     *  Public Common Interface Exported.
     ** ****************************************************************************************************************/
    //! prepare instance.
    const ERR_NOT_IMPLEMENTED = (id: string) => {throw new Error(`NOT_IMPLEMENTED - ${NS}:${JSON.stringify(id)}`)};
    const thiz = new class implements LemonEngineModel {
        public name = ()=> `model:${name}`;
        public hello: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_prepare: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_create: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_clone: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_search: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_read: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_readX: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_update: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_increment: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_delete: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_destroy: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_initialize: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_terminate: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public on_records: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_notify: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_subscribe: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_test_self: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_next_id: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_read_deep: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_saveES: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_cleanRedis: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_prepare_chain: GeneralFuntion = ERR_NOT_IMPLEMENTED;
        public do_finish_chain: GeneralFuntion = ERR_NOT_IMPLEMENTED;
    }
    //! register as service only if valid name.
    if (!name.startsWith('_')) _$(name, thiz);

    /** ****************************************************************************************************************
     *  Main Implementation.
     ** ****************************************************************************************************************/
    const CONF_GET_VAL      = (name: string, defval: any) => typeof options === 'object' && options[name] !== undefined ? options[name] : defval;
    const CONF_VERSION      = CONF_GET_VAL('VERSION', 1);                   // initial version number(name 'V').
    const CONF_REVISION     = CONF_GET_VAL('REVISION', 1);                  // initial revision number(name 'R').
    const CONF_VERSION_NAME = CONF_GET_VAL('VERSION_NAME', 'V');            // version name (Default 'V')       // if null, then no version.
    const CONF_REVISION_NAME= CONF_GET_VAL('REVISION_NAME', 'R');           // revision name (Default 'R')
    const CONF_ID_INPUT     = CONF_GET_VAL('ID_INPUT', 'id');               // default ID Name. (for input parameter)
    const CONF_ID_NAME      = CONF_GET_VAL('ID_NAME', 'id');                // ID must be Number/String Type value. (for DynamoDB Table)
    const CONF_ID_TYPE      = CONF_GET_VAL('ID_TYPE', 'test');              // type name of sequence for next-id.
    const CONF_ID_NEXT      = CONF_GET_VAL('ID_NEXT', 0);                   // start number of sequence for next-id.
    const CONF_DYNA_TABLE   = CONF_GET_VAL('DYNA_TABLE', 'TestTable');      // DynamoDB Target Table Name.
    const CONF_REDIS_PKEY   = CONF_GET_VAL('REDIS_PKEY', 'TPKEY');          // Redis search prefix-key name. (optional)
    // const CONF_FIELDS       = CONF_GET_VAL('FIELDS', null);              // Fields to filter. ['id','owner','mid','parent','domain','name'];
    const CONF_DEFAULTS     = CONF_GET_VAL('DEFAULTS', null);               // Default set of fields (only effective in prepare)
    const CONF_CLONEABLE    = CONF_GET_VAL('CLONEABLE', false);             // Cloneable Setting. (it requires 'parent', 'cloned' fields).
    const CONF_CLONED_ID    = CONF_GET_VAL('CLONED_ID', 'cloned');          // default ID Name. (for input parameter)
    const CONF_PARENT_ID    = CONF_GET_VAL('PARENT_ID', 'parent');          // default ID Name. (for input parameter)
    const CONF_PARENT_IMUT  = CONF_GET_VAL('PARENT_IMUT', true);            // parent-id is imutable?

    //! CONF_ES : INDEX/TYPE required if to support search. master if FIELDS is null, or slave if FIELDS not empty.
    const CONF_ES_INDEX     = CONF_GET_VAL('ES_INDEX', 'test-v1');          // ElasticSearch Index Name. (optional)
    const CONF_ES_TIMESERIES= CONF_GET_VAL('ES_TIMESERIES', false);         // ES Timestamp for Time-Series Data (added @181120)
    const CONF_ES_TYPE      = CONF_GET_VAL('ES_TYPE', '');                  // ElasticSearch Type Name of this Table. (optional) #이게 ES6가면서 type이 의미 없어짐!.
    const CONF_ES_MASTER    = CONF_GET_VAL('ES_MASTER', CONF_ES_TIMESERIES ? 1 : 0);// ES is master role? (default true if CONF_ES_FIELDS is null). (요건 main 노드만 있고, 일부 필드만 ES에 넣을 경우)
    const CONF_ES_VERSION   = CONF_GET_VAL('ES_VERSION', 5);                // ES Version Number. (5 means backward compartible)
    // _log(NS, '! CONF_ES_TIMESERIES=', CONF_ES_TIMESERIES);

    //! Security Configurations.
    const CONF_XECURE_KEY    = CONF_GET_VAL('XECURE_KEY', null);                // Encryption/Decryption Key.

    //! Initial CONF_FIELDS, CONF_FIELDS, CONF_XEC_FIELDS.
    const [CONF_FIELDS, CONF_ES_FIELDS, CONF_XEC_FIELDS] = (()=>{           // ElasticSearch Fields definition. (null 이면 master-record)
        let CONF_FIELDS       = CONF_GET_VAL('FIELDS', null);
        let CONF_ES_FIELDS    = CONF_GET_VAL('ES_FIELDS', CONF_ES_TIMESERIES ? null : ['updated_at','name']);
        let CONF_XEC_FIELDS      = CONF_GET_VAL('XEC_FIELDS', null);
        // _log(NS, '! CONF_ES_FIELDS=', CONF_ES_FIELDS);
        const asArray = ($conf: any)=>{
            return $conf && typeof $conf == 'string' ? $conf.split(',').reduce((L: any, val: string)=>{
                val = val.trim(); if (val) L.push(val); return val;
            }, []) : $conf;
        }
        //! Validate configuration.
        if (CONF_FIELDS) {
            CONF_FIELDS = asArray(CONF_FIELDS);
            CONF_ES_FIELDS = asArray(CONF_ES_FIELDS||[]);
            CONF_XEC_FIELDS = asArray(CONF_XEC_FIELDS||[]);
            if (!Array.isArray(CONF_FIELDS)) throw new Error('FIELDS must be array!');
            if (!Array.isArray(CONF_ES_FIELDS)) throw new Error('ES_FIELDS must be array!');
            if (!Array.isArray(CONF_XEC_FIELDS)) throw new Error('XEC_FIELDS must be array!');
            //! extract special fields like xecured. ex: '*pass' is xecured-fields.
            CONF_FIELDS = CONF_FIELDS.reduce((L, field)=>{
                const xecured = field.startsWith('*');
                field = xecured ? field.substring(1) : field;
                if (!field) throw new Error('Invalid field name');
                if (xecured && CONF_XEC_FIELDS.indexOf(field) < 0) CONF_XEC_FIELDS.push(field);
                L.push(field);
                return L;
            }, []);
            CONF_ES_FIELDS = CONF_ES_FIELDS.reduce((L, field)=>{
                const xecured = field.startsWith('*');
                field = xecured ? field.substring(1) : field;
                if (!field) throw new Error('Invalid field name');
                if (xecured && CONF_XEC_FIELDS.indexOf(field) < 0) CONF_XEC_FIELDS.push(field);
                L.push(field);
                return L;
            }, []);
            CONF_XEC_FIELDS.length && _inf(NS, 'XECURED-FIELDS =', CONF_XEC_FIELDS);
        }

        //! clear if CONF_FIELDS is empty.
        const isEmpty = !CONF_FIELDS || !CONF_FIELDS.length;
        if (isEmpty){
            CONF_FIELDS = null;
            CONF_ES_FIELDS = null;
            CONF_XEC_FIELDS = null;
        } else if (CONF_ES_FIELDS && !CONF_ES_FIELDS.length){
            CONF_ES_FIELDS = CONF_ES_TIMESERIES ? CONF_FIELDS : null;
        }
        //! returns finally.
        return [CONF_FIELDS, CONF_ES_FIELDS, CONF_XEC_FIELDS];
    })();
    _log(NS, '! CONF_ES_FIELDS :=', CONF_ES_FIELDS && CONF_ES_FIELDS.join(', '));

    //! VALIDATE CONFIGURATION.
    if (CONF_ES_TIMESERIES && CONF_REDIS_PKEY && !CONF_REDIS_PKEY.startsWith('#')) throw new Error('ES_TIMESERIES - Redis should be inactive. PKEY:'+CONF_REDIS_PKEY);
    if (CONF_ES_TIMESERIES && !CONF_ES_FIELDS.length) throw new Error('ES_TIMESERIES - CONF_ES_FIELDS should be valid!');

    //! Notify Service
    const CONF_NS_NAME      = CONF_GET_VAL('NS_NAME', '');          // '' means no notification services.

    //! ES Target Service
    const $ES               = CONF_ES_VERSION > 5 ? $ES6 : $ES5;
    if (!$ES) throw new Error('$ES is required! Ver:'+CONF_ES_VERSION);

    //! DynamoDB Value Marshaller.
    const $crypto           = function(passwd: string){
        const algorithm = 'aes-256-ctr';
        if (!crypto) throw new Error('crypto module is required!');
        const thiz: any = {crypto, algorithm, passwd};
        const MAGIC = 'LM!#';
        const JSON_TAG = '#JSON:';
        thiz.encrypt = function(val: string){
            val = val === undefined ? null : val;
            // msg = msg && typeof msg == 'object' ? JSON_TAG+JSON.stringify(msg) : msg;
            //! 어느 데이터 타입이든 저장하기 위해서, object로 만든다음, 암호화 시킨다.
            const msg    = JSON.stringify({alg: algorithm, val: val});
            const buffer = new Buffer(MAGIC + (msg||''), "utf8");
            const passwd = this.passwd||'';
            const cipher = crypto.createCipher(algorithm, passwd)
            const crypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
            return crypted.toString(1 ? 'base64' : 'utf8');
        }
        thiz.decrypt = function(msg: string){
            const buffer = new Buffer(msg||'', "base64");
            const passwd = this.passwd||'';
            const decipher = crypto.createDecipher(algorithm, passwd)
            const dec  = Buffer.concat([decipher.update(buffer) , decipher.final()]).toString('utf8');
            if (!dec.startsWith(MAGIC)) {
                _err(NS, '> decrypt =', dec);
                throw new Error('invalid magic string. check passwd!');
            }
            const data = dec.substr(MAGIC.length);
            if (data && !data.startsWith('{') && !data.endsWith('}')) {
                _err(NS, '> data =', data);
                throw new Error('invalid json string. check passwd!');
            }
            var $msg = JSON.parse(data)||{};
            // _log(NS, '! decrypt['+msg+'] =', $msg);
            return $msg.val;
        }
        return thiz;
    }

    /////////////////////////
    //! Notification Service.
    const $NOT = notifier(_$, '!'+CONF_NS_NAME, {NS_NAME: CONF_NS_NAME});

    //! notify functions.
    thiz.do_notify          = $NOT.do_notify;                       // delegate to notify-service
    thiz.do_subscribe       = $NOT.do_subscribe;                    // delegate to notify-service

    /////////////////////////
    //! Local Initialization.
    if (CONF_CLONEABLE && CONF_FIELDS)
    {
        if (CONF_PARENT_ID && CONF_FIELDS.indexOf(CONF_PARENT_ID) < 0) CONF_FIELDS.push(CONF_PARENT_ID);
        if (CONF_CLONED_ID && CONF_FIELDS.indexOf(CONF_CLONED_ID) < 0) CONF_FIELDS.push(CONF_CLONED_ID);
    }

    //! ignored parameters.
    const IGNORE_FIELDS = [CONF_ID_INPUT, CONF_ID_NAME, 'created_at', 'updated_at', 'deleted_at', CONF_CLONED_ID];
    if (CONF_PARENT_IMUT && CONF_PARENT_ID) IGNORE_FIELDS.push(CONF_PARENT_ID);


    /**
     * 입력 파라미터 (id, node|param)로 부터 체인 실행을 위한 객체를 준비시킨다
     *  - prepare_chain 과 finish_chain 항상 같이 쓰임.
     *  - 재귀적으로 호출될 수 있지만, 항상 prepare/finish 는 쌍이 맞음.
     *      A: prepare()
     *         ....
     *         B: prepare()
     *            ...
     *         B: finish()
     *      A: finish()
     *  - 최초 호출자가 prepare_chain() 를 입력 파라미터에 맞게 잘 호출해야함.
     *  - 주의 사항: 같은 ID 를 사용하는 리소스는 that 를 상호 공유할 수 있음. (ex: core+meta item)
     *
     *
     * ## that 객체 사용에 대한 주의 ##
     *  - 각 attribute 는 업데이트할 항목들로, 사용자 데이터를 저장.
     *  - '_' 으로 시작하는 필드는 내부 private attribute 로 저장에 이용 안됨. (ex: _node)
     *  - '$' 으로 시작하는 필드는 내부 private object 로 저장에 이용 안됨. (ex: $item)
     *  - _id : 현재 노드 핸드러에 이용할 아이디값.
     *  - _node : 전체 원본 데이터의 값으로, 주로 캐시에 저장된 값.
     *  - _ctx : 트랜잭션을 시작하게된, 컨텍스트가 저장됨 (API 시작시 저장해둠)
     *  - _current_time : 현재 시각을 millisecond 값으로 정의됨.
     *  - _current_mode : 현재 실행 그룹에서의 실행 모드.
     *  - _method_stack[] : prepare/finish 그룹의 스택 저장.
     *  - _is_prepared  : that 객체가 이미 준비되어 있음 (이후, 초기화할 필요 없을듯)
     *  - 대문자 : 객체를 저장하는 목적.
     *  - meta : json 형태로 저장된 (디비에는 문자열로 저장됨).
     *
     *
     * @param id        node-id (Number or Object)
     * @param $node     node object (optional)
     * @param mode      function-name (optional)
     * @param ctx       context object to guard function resource.
     */
    const prepare_chain = (id: any, $node: any, mode: string, ctx?: any) => {
        id = id||0;                                 // make sure Zero value if otherwise.
        mode = mode||'';                            // make sure string.
        // mode && _log(NS, `prepare_${mode}()... `);
        // _log(NS, '>> $node@1=', $node);

        //! determine object if 1st parameter is object.
        // $node = typeof id === 'object' ? id : $U.extend(
        //     $node === undefined || (typeof $node === 'object' && !($node instanceof Promise))
        //         ? $node||{} : {params:$node}
        //     , {'_id':id});
        if (typeof id === 'object') {
            $node = !$node ? id : $U.extend(id, $node);         // override with 2nd parameter if applicable.
            // _log(NS, '>> $node@2=', $node);
        } else {
            //! initial $node.
            if ($node === undefined || $node === null){
                $node = {};
            } else if (typeof $node === 'object' && !($node instanceof Promise)){
                $node = $U.copy($node);       // make copy of node.
            } else {
                $node = {params:$node};
            }
            $node = $U.extend($node, {'_id':id});
        }

        //! prepare object.
        let that = $node;                           // re-use $node as main object.
        // _log(NS, '>> that@1=', that);

        //! Records 이벤트 처리용 데이터 준비...
        if (that.records !== undefined){
            return $U.promise(that);
        }

        //! Notify 관련 함수 처리.
        if (mode.startsWith('notify')){
            return $U.promise(that);
        }

        //! if already prepared before, then just returns.
        if (that && that._is_prepared !== undefined && that._is_prepared){
            // mode && _log(NS, `! already prepared(${mode}) `);
            that._current_mode = mode;                  // Current Running Mode.
            that._method_stack.push(mode);              // stack up. it will be out from finish()
            if (that._method_stack.length > 1000)       // WARN!
                return Promise.reject('method-stack full. size:'+that._method_stack);
            return $U.promise(that);
        }
        // _log(NS, '>> ID=', id);

        //! Check ID Type : String|Number.
        if (CONF_ID_TYPE.startsWith('#')){            // ID is not NUMBER
            id = that._id || that[CONF_ID_INPUT] || '';
        } else {                                    // ID must be Number.
            id = $U.N(that._id || that[CONF_ID_INPUT] || 0);
        }
        // _log(NS, '>> ID=', id);

        //! make sure core parameter.
        let curr_ms = that._current_time || $U.current_time_ms();
        that._id = id;                              // As Number
        that._current_time = curr_ms;               // Current Time in ms
        that._current_mode = mode;                  // Current Running Mode.
        that._method_stack = [];                    // Prepared Mode Stack.
        that._method_stack.push(mode);              // stack up. it will be out from finish()
        that._updated_node = null;                  // Updated Node if update()
        that._ctx = ctx;                            // Context for API call.
        that._node = {};                            // Prepare dummy clean node.
        that._is_prepared = true;                   // Mark Prepared Object.
        // mode && _log(NS, '> id = '+id+', current-time = '+curr_ms);
        // mode && _log(NS, `> prepared(${mode},${id})-that =`, $U.json(that));

        //! _params_count : 입력으로 들어오는 object 의 파라마터 개수. (id 등 기본 필드는 무시)
        if (that._params_count === undefined)
        {
            that._params_count = 0;
            // const IGNORE_FIELDS = [CONF_ID_INPUT, CONF_ID_NAME, 'created_at', 'updated_at', 'deleted_at'];
            that = $_.reduce(that, (that: any, val: any, key: string) => {
                if (key.startsWith('_')) return that;
                if (key.startsWith('$')) return that;
                if (IGNORE_FIELDS.indexOf(key) >= 0) return that;
                that._params_count++;
                return that;
            }, that);
        }

        // start promise.
        return $U.promise(that);
    };

    /**
     * Finish chain call.
     *  - 마지막으로, 노드에 저장된 필드를 that 에 populate 시켜줌.
     *  - that 에는 원래 읽어올 필드를 파라미터로 설정되어 있음.
     *  - 그런데, 애초에 입력 파라미터가 없을 경우(_params_count == 0), 전체 필드를 읽어옴.
     *  - that._auto_populate 가 있을 경우, 이 옵션에 따름.
     *
     */
    const finish_chain = (that: any) => {
        if (!that) return that;

        //! project back _node to that by FIELDS set.
        const MODE = that._current_mode||'';
        //! Records 이벤트 처리용 데이터 준비...
        if (that.records !== undefined) return $U.promise(that);
        //! Notify 관련 함수 처리.
        if (MODE.startsWith('notify')) return $U.promise(that);

        if (that._method_stack) that._method_stack.pop();

        //! check mode if population.
        if (MODE !== 'read' && MODE !== 'increment' && MODE !== 'create') return that;

        //! auto-populate option.
        if (that._auto_populate !== undefined && !that._auto_populate) return that;

        //! yes read mode. if no params, or master
        const node = that._node;
        if (that._params_count === 0 || that._fields_count === -1) {
            //! copy all node into that.
            that = $_.reduce(node, (that: any, val: any, key: string) => {
                if (key === 'updated_at' && that[key] !== undefined){       // keep max-value.
                    that[key] = that[key] > val ? that[key] : val;
                } else {
                    that[key] = val;
                }
                return that;
            }, that);

        } else if (that._fields_count >= 0) {
            //! copy only the filtered fields.
            that = CONF_FIELDS ? CONF_FIELDS.reduce((that: any, field: any) => {
                if (that[field] !== undefined && node[field] !== undefined) {
                    that[field] = node[field];
                }
                return that;
            }, that) : that;
        }
        return that;
    };

    /**
     *
     * @param that
     * @returns {*}
     */
    const my_prepare_id = (that: any) => {
        const ID = that._id;
        _log(NS, `- my_prepare_id(${CONF_ID_TYPE}, ${ID})....`);
        if(CONF_ID_TYPE.startsWith('#')){
            //! 이름이 '#'으로 시작하고, CONF_ID_NEXT 가 있을 경우, 내부적 ID 생성 목적으로 시퀀스를 생성해 둔다.
            if (CONF_ID_TYPE && CONF_ID_TYPE.startsWith('#') && CONF_ID_TYPE.length > 1 && CONF_ID_NEXT > 0) {
                const ID_NAME = CONF_ID_TYPE.substring(1);
                return $MS.do_get_next_id(ID_NAME)
                    .then((id: any) => {
                        _log(NS, '> created next-id['+ID_NAME+']=', id);
                        that._id = id;
                        return that;
                    })
            }
            // NOP
        } else if(CONF_ID_TYPE && !ID){
            // _log(NS, '> creating next-id by type:'+CONF_ID_TYPE);
            return $MS.do_get_next_id(CONF_ID_TYPE)
                .then((id: any) => {
                    _log(NS, '> created next-id=', id);
                    that._id = id;
                    return that;
                })
        }
        _log(NS, '> prepared-id =', ID);
        return Promise.resolve(that);      //WARN! must return that.
    };

    /**
     * CONF_FIELDS 에 정의된 항목만 노드로 활용하도록, 복사해 간다.
     *  prepare => 파라미터 필드셋 의미 없음. (다만, 기본값 설정으로 필드 설정. 파라미터셋에 초기값 리턴)
     *  create => 초기값으로 파라미터 필드셋.
     *  update => 업데이트할 필드의 개수 구함. (없으면, 이후 실제 update 실행 암함.)
     *  read => 읽어올 필드 설정해줌. (없으면, 이후 실제 read 실행 안함)
     *  clone => 복제용 파라미터 필드셋.
     *
     *  that._fields_count      : that 에서 추출한 업데이트할 필드 개수.
     *
     * @param that
     * @returns {*}
     */
    const _prepare_node = (that: any) => {
        if (!that._current_mode) throw new Error('._current_mode is required!');
        const MODE = that._current_mode;
        const DEFAULTS = CONF_DEFAULTS||{};

        let fields_count = 0;
        let node = that._node||{};
        if (!CONF_FIELDS){
            fields_count = -1;          // all fields
        } else if (MODE === 'prepare' || MODE === 'create' || MODE === 'clone') {
            node = CONF_FIELDS.reduce((node: any, field: any) => {
                if (field === CONF_ID_NAME) return node;            // ignore id.
                if (field === CONF_VERSION_NAME) return node;       // ignore version/revision number.
                if (field === CONF_REVISION_NAME) return node;       // ignore version/revision number.

                //! reset fields with or without user parameter.
                if (MODE === 'prepare') {
                    //- return default value via that.
                    if (DEFAULTS[field] !== undefined){             // if defined DEFAULTS, the use it.
                        node[field] = CONF_DEFAULTS[field];
                        //!WARN! DO NOT COPY BACK TO THAT UNLESS READ OPERATION.
                        // if (that[field] !== undefined) that[field] = node[field];    // copy back to that(????)
                    } else {
                        if (that[field] !== undefined) node[field] = that[field];    // if not defined, use parameter.
                    }

                    //! reset also version/revision.
                    if (CONF_VERSION_NAME) node[CONF_VERSION_NAME] = CONF_VERSION;
                    if (CONF_REVISION_NAME) node[CONF_REVISION_NAME] = 0;

                //! copy user parameter to node.
                } else if (MODE === 'create'){
                    //! reset only revision to 0.
                    if (CONF_REVISION_NAME) node[CONF_REVISION_NAME] = CONF_REVISION  - 1;     // it will be increased at dynamo save.

                    if (that[field] !== undefined) node[field] = that[field];
                } else {
                    if (that[field] !== undefined) node[field] = that[field];
                }
                //! increment count.
                fields_count++;

                //! returns node.
                return node;
            }, node)
        } else if (MODE === 'update' || MODE === 'increment' || MODE === 'read') {
            node = CONF_FIELDS.reduce((node: any, field: any) => {
                if (field === CONF_ID_NAME) return node;     // ignore id.
                if (that[field] !== undefined) {
                    fields_count++;
                }
                return node;
            }, node)
        }
        that._fields_count = fields_count;
        that._node = node;
        return that;      //WARN! must return that.
    };

    // Node State := Prepared
    const mark_node_prepared = (node: any, current_time: any) => {
        // if(!current_time) throw new Error('current_time is required!');
        node.created_at = 0;
        node.updated_at = current_time;
        node.deleted_at = current_time;
        return node;
    };

    // Node State := Created
    const mark_node_created = (node: any, current_time: any) => {
        // if(!current_time) throw new Error('current_time is required!');
        node.created_at = current_time;
        node.updated_at = current_time;
        node.deleted_at = 0;
        return node;
    };

    // Node State := Updated
    const mark_node_updated = (node: any, current_time: any) => {
        // if(!current_time) throw new Error('current_time is required!');
        // node.created_at = 0;
        node.updated_at = current_time;
        // node.deleted_at = 0;
        return node;
    };

    // Node State := Deleted
    const mark_node_deleted = (node: any, current_time: any) => {
        // if(!current_time) throw new Error('current_time is required!');
        // node.created_at = 0;
        node.updated_at = current_time;
        node.deleted_at = current_time;
        return node;
    };

    // 필요한 경우 ID 생성, 캐쉬된 노드 정보 읽어 옴.
    const my_prepare_node_prepared = (that: any) => {
        // if (!that._id) return Promise.reject(new Error('._id is required!'));
        if (!that._node) return Promise.reject(new Error('._node is required!'));
        if (!that._current_time) return Promise.reject(new Error('._current_time is required!'));

        //! CONF_ES_TIMESERIES 일 경우, 무조건 데이터 생성으로 간주함.
        if (CONF_ES_TIMESERIES){
            that._node = that._node||{};
            return Promise.resolve(that);
        }

        //! prepare internal node.
        const ID = that._id;
        const CURRENT_TIME = that._current_time;
        // _log(NS, '> prepared-id =', id, ', current-time =', current_time, ', node =', $U.json(node));

        //! if no id, then create new node-id.
        if (!ID) {
            that = _prepare_node(that);
            return my_prepare_id(that)
                .then((that: any) => {
                    const node = that._node||{};
                    that[CONF_ID_INPUT] = that._id;       // make sure id input.
                    node[CONF_ID_NAME] = that._id;        // make sure id field.
                    that._node = mark_node_prepared(node, CURRENT_TIME);
                    return that;
                })
        }

        //! read previous(old) node from dynamo.
        return my_read_node(that)
            .catch((e: any) => {
                const msg = e && e.message || '';
                if (msg.indexOf('404 NOT FOUND') < 0) throw e;
                _inf(NS, 'WARN! NOT FOUND. msg=', msg);
                return that;
            })
            .then((that: any) => {
                // _log(NS, '>> get-item-node old=', $U.json(that._node));
                that = _prepare_node(that);

                //!VALIDATE [PREPARED] STATE.
                const node = that._node || {};
                if (that._force_create){
                    _err(NS, 'WARN! _force_create is set!');
                } else if (!node.deleted_at){        // if not deleted.
                    _err(NS, 'INVALID STATE FOR PREPARED. ID=',ID ,', TIMES[CUD]=', [node.created_at, node.updated_at, node.deleted_at]);
                    return Promise.reject(new Error('INVALID STATE. deleted_at:'+node.deleted_at));
                }

                that[CONF_ID_INPUT] = that._id;         // make sure id input.
                node[CONF_ID_NAME] = that._id;          // make sure id field.
                that._node = mark_node_prepared(that._node, CURRENT_TIME);
                return that;
            })
    };

    // 신규 노드 생성 (또는 기존 노드 overwrite) 준비.
    const my_prepare_node_created = (that: any) => {
        if (!that._id) return Promise.reject(new Error('._id is required!'));
        if (!that._node) return Promise.reject(new Error('._node is required!'));
        if (!that._current_time) return Promise.reject(new Error('._current_time is required!'));

        //! CONF_ES_TIMESERIES 일 경우, 무조건 데이터 생성으로 간주함.
        if (CONF_ES_TIMESERIES){
            that._node = that._node||{};
            return Promise.resolve(that);
        }

        //! 이전 데이터를 읽어온다.
        const ID = that._id;
        const CURRENT_TIME = that._current_time;
        _log(NS, '> prepared-id =', ID, ', current-time =', CURRENT_TIME);
        // _log(NS, '> prepared-id =', id, ', current-time =', current_time, ', node =', $U.json(node));

        //! read previous(old) node from dynamo.
        return my_read_node(that)
            .then((that: any) => {
                // _log(NS, '>> get-item-node old=', $U.json(that._node));
                that = _prepare_node(that);

                //!VALIDATE [CREATED] STATE.
                const node = that._node || {};
                if (that._force_create){
                    _inf(NS, 'WARN! _force_create is set!');
                } else if (!node.deleted_at){        // if not deleted.
                    _err(NS, 'INVALID STATE FOR CREATED. ID=',ID ,', TIMES[CUD]=', [node.created_at, node.updated_at, node.deleted_at]);
                    return Promise.reject(new Error('INVALID STATE. deleted_at:'+node.deleted_at));
                }

                that._node = mark_node_created(node, CURRENT_TIME);
                //!MARK [CREATED]
                return that;
            })
    };

    // 복제용 노드 (또는 기존 노드 overwrite) 준비.
    const my_prepare_node_cloned = (that: any) => {
        if (!that._id) return Promise.reject(new Error('._id is required!'));
        if (!that._node) return Promise.reject(new Error('._node is required!'));
        if (!that._current_time) return Promise.reject(new Error('._current_time is required!'));

        //! CONF_ES_TIMESERIES 일 경우, 무조건 데이터 생성으로 간주함.
        if (CONF_ES_TIMESERIES){
            that._node = that._node||{};
            return Promise.resolve(that);
        }

        const ID = that._id;
        const node = that._node;
        const CURRENT_TIME = that._current_time;
        // _log(NS, '> cloned-id =', ID, ', current-time =', CURRENT_TIME, ', node =', $U.json(node));

        //! read previous(old) node from dynamo.
        return my_read_node(that)
            .then((that: any) => {
                // _log(NS, '>> get-item-node old=', $U.json(that._node));
                that = _prepare_node(that);
                that._node = mark_node_created(that._node, CURRENT_TIME);           // as created for cloning.
                return that;
            })
    };

    // 노드 업데이트 준비
    const my_prepare_node_updated = (that: any) => {
        if (!that._id) return Promise.reject(new Error('._id is required!'));
        if (!that._node) return Promise.reject(new Error('._node is required!'));
        if (!that._current_time) return Promise.reject(new Error('._current_time is required!'));

        //! CONF_ES_TIMESERIES 일 경우, 무조건 데이터 생성으로 간주함.
        if (CONF_ES_TIMESERIES){
            that._node = that._node||{};
            return Promise.resolve(that);
        }

        const ID = that._id;
        const node = that._node;
        const CURRENT_TIME = that._current_time;
        // _log(NS, '> updated-id =', ID, ', current-time =', CURRENT_TIME, ', node =', $U.json(node));

        //! check if available fields.
        that = _prepare_node(that);
        //! ignore if no need to update due to FIELDS config.
        if (that._fields_count === 0) {
            // _log(NS, `! my_update_node() no need to update... fields_count=`+that._fields_count);
            return that;
        }

        //! if no node, read previous(old) node from dynamo.
        return my_read_node(that)
            .then((that: any) => {
                // _log(NS, '>> get-item-node old=', $U.json(that._node));
                that._node = mark_node_updated(that._node, CURRENT_TIME);
                return that;
            })
    };

    // 삭제된 노드 준비.
    const my_prepare_node_deleted = (that: any) => {
        if (!that._id) return Promise.reject(new Error('._id is required!'));
        if (!that._node) return Promise.reject(new Error('._node is required!'));
        if (!that._current_time) return Promise.reject(new Error('._current_time is required!'));

        //! CONF_ES_TIMESERIES 일 경우, 무조건 데이터 생성으로 간주함.
        if (CONF_ES_TIMESERIES){
            that._node = that._node||{};
            return Promise.resolve(that);
        }

        const ID = that._id;
        // const node = that._node;
        const CURRENT_TIME = that._current_time;
        // _log(NS, '> deleted-id =', ID, ', current-time =', CURRENT_TIME, ', node =', $U.json(node));

        //! if no node, read previous(old) node from dynamo.
        return my_read_node(that)
            .then((that: any) => {
                // _log(NS, '>> get-item-node old=', $U.json(that._node));
                that = _prepare_node(that);
                that._node = mark_node_deleted(that._node, CURRENT_TIME);
                return that;
            })
    };

    /**
     * Dynamo DB 처리 부분.
     * - 메인 DB 이므로, that._node 에 저장된 부분을 최종적으로 저장한다.
     *
     */
    const $dynamo = {
        //! read
        do_read_dynamo : (that: any) =>
        {
            if (!that._id) return Promise.reject(new Error('._id is required!'));         // new Error() for stack-trace.
            const ID = that._id;
            _log(NS, `- dynamo: read(${ID})....`);
            const idType = CONF_ID_TYPE.startsWith('#') ? 'String' :'';
            return $DS.do_get_item(CONF_DYNA_TABLE, {[CONF_ID_NAME]:ID, idType})
                .then((node: any) => {
                    _log(NS, `> dynamo: node(${ID}) res=`, $U.json(node));
                    that._node = node;
                    return that;
                })
        },

        //! update
        do_update_dynamo : (that: any) =>
        {
            if (!that._id) return Promise.reject(new Error('._id is required!'));
            if (!that._node) return Promise.reject(new Error('._node is required!'));
            // if (!that._current_time) return Promise.reject(new Error('._current_time is required!'));

            const ID = that._id;
            const node = that._node;
            // const current_time = that._current_time;

            _log(NS, `- dynamo: update(${ID})....`);
            // _log(NS, '> node-id =', id, ', current-time =', current_time);

            //! copy attributes into node.
            let node2: any = {};
            let updated_count = 0;
            // const IGNORE_FIELDS = [CONF_ID_INPUT,CONF_ID_NAME,'created_at','updated_at','deleted_at',CONF_PARENT_ID,CONF_CLONED_ID];
            const $xec = CONF_XECURE_KEY ? $crypto(CONF_XECURE_KEY) : null;
            for(let n in that){
                if (!n) continue;
                if (!that.hasOwnProperty(n)) continue;
                n = ''+n;
                if (n.startsWith('_') || n.startsWith('$')) continue;
                if (IGNORE_FIELDS.indexOf(n) >= 0) continue;
                if (CONF_FIELDS && CONF_FIELDS.indexOf(n) < 0) continue;        // Filtering Fields
                //TODO:IMPROVE - 변경된 것만 저장하면, 좀 더 개선될듯..
                if (n){
                    node2[n] = that[n];
                    node[n]  = that[n];
                    updated_count++;
                    //! encrypt if xecured fields.
                    if ($xec && CONF_XEC_FIELDS && CONF_XEC_FIELDS.indexOf(n) >= 0){
                        node[n]  = that[n] ? $xec.encrypt(that[n]) : '';
                        node2[n] = node[n];
                    }
                }
            }
            node2.updated_at = node.updated_at;         // copy time field.
            _log(NS, '> dynamo: updated['+ID+']['+updated_count+'] =', $U.json(node2));

            //! save back into main.
            that._updated_node = null;
            that._updated_count = updated_count;

            //! if no update, then just returns. (
            if (!updated_count) {
                if (CONF_FIELDS) return that;           // ignore reject.
                return Promise.reject(new Error('nothing to update'));
            }

            //! Update Revision Number. R := R + 1
            if (node[CONF_REVISION_NAME] !== undefined) node[CONF_REVISION_NAME] = $U.N(node[CONF_REVISION_NAME],0) + 1;

            //! then, save into DynamoDB (update Revision Number. R := R + 1)
            return $DS.do_update_item(CONF_DYNA_TABLE, {[CONF_ID_NAME]: ID}, node2, CONF_REVISION_NAME ? {[CONF_REVISION_NAME]:1} : null)
                .then((_: any) => {
                    that._updated_node = node2;          // SAVE INTO _updated.
                    that._node = Object.assign(that._node, node2);
                    _log(NS, `> dynamo: updated(${ID}) res=`, $U.json(_));
                    return that;
                })
        },

        //! save
        do_save_dynamo : (that: any) =>
        {
            if (!that._id) return Promise.reject(new Error('._id is required!'));
            if (!that._node) return Promise.reject(new Error('._node is required!'));
            // if (!that._current_time) return Promise.reject(new Error('._current_time is required!'));

            const ID = that._id;
            const node = that._node;
            const MODE = that._current_mode||'';
            const CURRENT_TIME = that._current_time;

            _log(NS, `- dynamo: save(${ID})....`);

            //! override attributes into node.
            // const IGNORE_FIELDS = [CONF_ID_INPUT,CONF_ID_NAME,'created_at','updated_at','deleted_at',CONF_PARENT_ID,CONF_CLONED_ID];
            if (MODE !== 'prepare')         //WARN! in prepare mode, node was already populated with default value. (so do not override)
            {
                const $xec = CONF_XECURE_KEY ? $crypto(CONF_XECURE_KEY) : null;
                for (let key in that){
                    if (!key) continue;
                    if (!that.hasOwnProperty(key)) continue;
                    key = `${key}`;
                    if (key.startsWith('_') || key.startsWith('$')) continue;
                    if (IGNORE_FIELDS.indexOf(key) >= 0) continue;
                    if (CONF_FIELDS && CONF_FIELDS.indexOf(key) < 0) continue;        // Filtering Fields
                    node[key] = that[key];
                    //! encrypt if xecured fields.
                    if ($xec && CONF_XEC_FIELDS && CONF_XEC_FIELDS.indexOf(key) >= 0){
                        node[key] = that[key] ? $xec.encrypt(that[key]) : '';
                    }
                }
            }
            //! Update Revision Number. R := R + 1
            if (node[CONF_REVISION_NAME] !== undefined) node[CONF_REVISION_NAME] = $U.N(node[CONF_REVISION_NAME],0) + 1;
            _log(NS, '> save@node-id =', ID, ', current-time =', CURRENT_TIME, ', node :=', $U.json(node));

            //! then, save into DynamoDB
            return $DS.do_create_item(CONF_DYNA_TABLE, {[CONF_ID_NAME]: ID}, node)
                .then((_: any) => {
                    _log(NS, `> dynamo: saved(${ID}) res=`, $U.json(_));
                    return that;
                })
        },

        //! increment
        do_increment_dynamo : (that: any) =>
        {
            if (!that._id) return Promise.reject(new Error('._id is required!'));
            if (!that._node) return Promise.reject(new Error('._node is required!'));
            // if (!that._current_time) return Promise.reject(new Error('._current_time is required!'));

            const ID = that._id;
            const node = that._node;
            // const current_time = that._current_time;

            _log(NS, `- dynamo: increment(${ID})....`);
            // _log(NS, '> node-id =', id, ', current-time =', current_time);

            //! copy attributes into node.
            let node2: any = {};
            let updated_count = 0;
            // const IGNORE_FIELDS = [CONF_ID_INPUT,CONF_ID_NAME,'created_at','updated_at','deleted_at'];
            for(let n in that){
                if(!that.hasOwnProperty(n)) continue;
                n = ''+n;
                if (n.startsWith('_')) continue;
                if (n.startsWith('$')) continue;
                if (IGNORE_FIELDS.indexOf(n) >= 0) continue;
                if (CONF_FIELDS && CONF_FIELDS.indexOf(n) < 0) continue;        // Filtering Fields
                //TODO:IMPROVE - 변경된 것만 저장하면, 좀 더 개선될듯..
                if (n){
                    node2[n] = that[n];
                    node[n] = $U.N(node[n],0) + $U.N(that[n]);
                    updated_count++;
                }
            }
            node2.updated_at = node.updated_at;         // copy time field.
            _log(NS, '> dynamo: incremented['+ID+'] :=', $U.json(node2));

            //! save back into main.
            that._updated_node = null;
            that._updated_count = updated_count;

            //! if no update, then just returns. (
            if (!updated_count) {
                if (CONF_FIELDS) return that;           // ignore reject.
                return Promise.reject(new Error('nothing to update'));
            }

            //! Update Revision Number. R := R + 1
            if (node[CONF_REVISION_NAME] !== undefined) node[CONF_REVISION_NAME]= $U.N(node[CONF_REVISION_NAME], 0) + 1;

            //! then, save into DynamoDB (update Revision Number. R := R + 1)
            return $DS.do_increment_item(CONF_DYNA_TABLE, {[CONF_ID_NAME]: ID}, node2, CONF_REVISION_NAME ? {[CONF_REVISION_NAME]:1} : null)
                .then((_: any) => {
                    _log(NS, `> dynamo: increment(${ID}) res=`, $U.json(_));
                    that._updated_node = node2;          // SAVE INTO _updated.
                    // that._node = Object.assign(that._node, node2);   //WARN! - DO NOT ASSIGN AGAIN. ARLEADY DONE IN ABOVE.
                    return that;
                })
        },

        //! delete
        do_delete_dynamo : (that: any) =>
        {
            const ID = that._id;
            if (!ID) return Promise.reject(new Error('._id is required!'));
            _log(NS, `- dynamo: delete(${ID})....`);

            //! do delete command.
            return $DS.do_delete_item(CONF_DYNA_TABLE, {[CONF_ID_NAME]:ID})
                .then((node: any) => {
                    _log(NS, `> dynamo: deleted(${ID}) res=`, $U.json(node));
                    that._node = node||{};
                    return that;
                })
        }
    };


    /**
     * Redis
     * - Dynamo와 중간에서 메인 캐시 역활을 함.
     * - 상호 효과적인 동기화를 위해서, updated_at과 hash값을 활용함.
     * - PKEY = '#' 일 경우, $elasticsearch가 그 역활을 대신하도록 함.
     *
     * //TODO - Redis 에서 오브젝트 단위로 읽고 쓸 수 있도록 하기...
     */
    const $redis = {
        /**
         * Read node via Redis cache.
         */
        do_read_cache : (that: any) =>
        {
            const ID = that._id;
            if (!ID) return Promise.reject(new Error('._id is required!'));
            //! Redis Key 가 없다면, read 실퍠로 넘겨줘야함.
            if (!CONF_REDIS_PKEY) return Promise.reject(that);

            //NOTE - '#'으로 시작하면, elasticsearch로 대신함.
            if (CONF_REDIS_PKEY.startsWith('#')){
                //! 다만, TIMESERIES이면, DYNAMO에서 직접 읽어 온다.    @181120.
                if (CONF_ES_TIMESERIES){
                    return $dynamo.do_read_dynamo(that)                 // STEP 2. If failed, Read Node from DynamoDB.
                        .then((that: any) => {
                            const node = that._node||{};
                            if (node[CONF_ID_NAME] === undefined) return Promise.reject(new Error('404 NOT FOUND. '+CONF_DYNA_TABLE+'.id:'+(that._id||'')));
                            return that;
                        })
                }

                //! 캐시를 대신하여, ES에서 ID 로 읽어오기.
                return $elasticsearch.do_read_search(that)
                    .catch((err: any) => {
                        //! 읽은 node가 없을 경우에도 발생할 수 있으므로, Error인 경우에만 처리한다.
                        if (err instanceof Error) {
                            _err(NS, `! redis: read-search(${CONF_REDIS_PKEY}, ${ID}) err :=`, err.message||err);
                            that._error = err;
                        }
                        throw that;
                    })
            }

            //! read via redis.
            _log(NS, `- redis: get-item(${ID})....`);
            return $RS.do_get_item(CONF_REDIS_PKEY, ID).then((node: any) => {
                // _log(NS, `> redis:get-item(${CONF_REDIS_PKEY}, ${ID}) res =`, $U.json(node));
                // _log(NS, `> redis:get-item(${CONF_REDIS_PKEY}, ${ID}) res.len =`, node ? $U.json(node).length : null);
                if(!node) return Promise.reject(that);                                  //WARN! reject that if not found.
                that._node = node;
                return that;
            }).catch((err: any) => {
                //! 읽은 node가 없을 경우에도 발생할 수 있으므로, Error인 경우에만 처리한다.
                if (err instanceof Error) {
                    _err(NS, `! redis: get-item(${CONF_REDIS_PKEY}, ${ID}) err :=`, err.message||err);
                    that._error = err;
                }
                throw that;
            })
        },

        /**
         * Save into cache.
         */
        do_save_cache : (that: any) =>
        {
            const ID = that._id;
            if (!ID) return Promise.reject(new Error('._id is required!'));
            if (!that._node) return Promise.reject(new Error('._node is required!'));
            if (!CONF_REDIS_PKEY) return Promise.resolve(that);

            //NOTE - '#'으로 시작하면, elasticsearch로 대신함. (저장 부분은, ES에서 별도로 처리해 주므로, 그냥 무시함)
            if (CONF_REDIS_PKEY.startsWith('#')) return Promise.resolve(that)

            const node = that._node;
            _log(NS, `- redis: create-item(${ID})....`);
            // _log(NS, `- redis:my_save_node(${CONF_REDIS_PKEY}:${ID}). node=`, node);
            // _log(NS, `- redis:my_save_node(${CONF_REDIS_PKEY}:${ID}). node=`, $U.json(node));
            // _log(NS, `- redis:my_save_node(${CONF_REDIS_PKEY}:${ID}). node.updated_at=`, node&&node.updated_at||0);
            let chain = $redis.do_set_cache_footprint(ID, node);
            chain = chain.then(() => $RS.do_create_item(CONF_REDIS_PKEY, ID, node))
                .then((rs: any) => {
                    // _log(NS, `> redis:save-item-node(${ID}) res=`, $U.json(rs));
                    // if(!node) return Promise.reject(that);                                  // reject if not found.
                    return that;
                });
            return chain;
        },

        /**
         * Update Node.
         */
        do_update_cache : (that: any) =>
        {
            const ID = that._id;
            if (!ID) return Promise.reject(new Error('._id is required!'));
            if (!that._node) return Promise.reject(new Error('._node is required!'));
            if (!CONF_REDIS_PKEY) return Promise.resolve(that);

            //NOTE - '#'으로 시작하면, elasticsearch로 대신함. (저장 부분은, ES에서 별도로 처리해 주므로, 그냥 무시함)
            if (CONF_REDIS_PKEY.startsWith('#')) return Promise.resolve(that)

            const node = that._node;
            _log(NS, `- redis: update-item(${ID})....`);
            let chain = $redis.do_set_cache_footprint(ID, node);
            //WARN! IT IS NOT SUPPORTED YET!!!
            chain = chain.then(() => $RS.do_update_item(CONF_REDIS_PKEY, ID, node))
                .then((rs: any) => {
                    // _log(NS, `> redis:update-item-node(${ID}) res=`, $U.json(rs));
                    // if(!node) return Promise.reject(that);                                  // reject if not found.
                    return that;
                });
            return chain;
        },

        /**
         * Delete Node.
         */
        do_delete_cache : (that: any) =>
        {
            const ID = that._id;
            if (!ID) return Promise.reject(new Error('._id is required!'));
            if (!CONF_REDIS_PKEY) return Promise.resolve(that);

            //NOTE - '#'으로 시작하면, elasticsearch로 대신함. (저장 부분은, ES에서 별도로 처리해 주므로, 그냥 무시함)
            // if (CONF_REDIS_PKEY.startsWith('#')) return Promise.resolve(that)
            const REDIS_PKEY = CONF_REDIS_PKEY.startsWith('#') ? CONF_REDIS_PKEY.substr(1) : CONF_REDIS_PKEY;
            if (!REDIS_PKEY) return Promise.resolve(that);

            // _log(NS, `- redis: delete-item(${ID})....`);
            const my_local_delete_item = (pkey: any) => {
                return $RS.do_delete_item(pkey, ID)
                    .then((_: any) => {
                        // _log(NS, `> redis: deleted(${pkey}/${ID}) res=`, _);                    // res := 1 or 0.
                        return _;
                    })
                    .catch((err: any) => {
                        return err.message||`${err}`;
                    })
            }
            //! delete main node, and footprints.
            return Promise.all([REDIS_PKEY, REDIS_PKEY+'/UPDATED', REDIS_PKEY+'/HASH'].map(my_local_delete_item))
                .then((_: any) => {
                    _log(NS, `> redis: deleted(${ID}) res=`, $U.json(_));
                    return that;
                })
        },

        //! set foot-print information from node.
        do_set_cache_footprint : (ID: any, node: any) =>
        {
            if (!ID) return Promise.reject(new Error('id is required!'));
            if (!CONF_REDIS_PKEY) return Promise.resolve(0);
            node = node || {};

            const updated_at = $U.N(node.updated_at, 0);
            const hash_value = $U.hash(node);

            // _log(NS, `- redis:my_set_node_footprint(${ID})....`,'params=', [updated_at, hash_value]);
            return $RS.do_create_item([CONF_REDIS_PKEY+'/UPDATED', CONF_REDIS_PKEY+'/HASH'], ID, [updated_at, hash_value])
                .then((data: any) => {
                    // _log(NS, `> redis:set node-footprint(${ID}) res=`, $U.json(data));
                    return data;
                })
        },

        //! get updated-at by id
        do_get_cache_updated : (ID: any) =>
        {
            if (!ID) return Promise.reject(new Error('id is required!'));
            if (!CONF_REDIS_PKEY) return Promise.resolve(-1);

            //NOTE - '#'으로 시작하면, elasticsearch로 대신함. (저장 부분은, ES에서 별도로 처리해 주므로, 그냥 무시함)
            if (CONF_REDIS_PKEY.startsWith('#')) return Promise.resolve(-1);

            // _log(NS, `- redis:my_get_updated_at(${ID})....`);
            return $RS.do_get_item(CONF_REDIS_PKEY+'/UPDATED', ID)
                .then((data: any) => {
                    // _log(NS, `> redis:get-updated-at(${ID}) res=`, data);
                    return data;
                })
        },
        //! get hash-value by id
        do_get_cache_hash : (ID: any) =>
        {
            if (!ID) return Promise.reject(new Error('id is required!'));
            if (!CONF_REDIS_PKEY) return Promise.resolve(-1);

            //NOTE - '#'으로 시작하면, elasticsearch로 대신함. (저장 부분은, ES에서 별도로 처리해 주므로, 그냥 무시함)
            if (CONF_REDIS_PKEY.startsWith('#')) return Promise.resolve(-1);

            // _log(NS, `- redis:my_get_hash_value(${ID})....`);
            return $RS.do_get_item(CONF_REDIS_PKEY+'/HASH', ID)
                .then((data: any) => {
                    // _log(NS, `> redis:get-hash-value(${ID}) res=`, data);
                    return data;
                })
        },

    };


    /**
     * elasticsearch (노드 검색용 엔진)
     *  - 검색용으로 search/query 에 특화됨.
     *  - Core/Meta/...  들이 1차원적으로 ES에 인덱싱되어져 있음.
     *  - Core (master 노드) 에서만 검색이 가능하게..... (대표로 해서...)
     *  - Parent/Child 관계에 있어서... (예: Atem/Item, Atem/Deal) 이걸 어떻게 풀어갈까???
     *
     */
    const $elasticsearch = {
        //! read
        do_read_search : (that: any) => {
            const ID = that._id;
            if (!ID) return Promise.reject(new Error('._id is required!'));
            if (!CONF_ES_INDEX) return that;
            _log(NS, `- elasticsearch: read(${ID})....`);
            return $ES.do_get_item(CONF_ES_INDEX, CONF_ES_TYPE, ID)
                .then((node: any) => {
                    // _log(NS, `> elasticsearch:get-item(${ID}) =`, $U.json(node));
                    if (!node) return Promise.reject(that);                                  // reject if not found.
                    if (CONF_ES_FIELDS){
                        that._node = $U.extend(that._node||{}, node);
                    } else {
                        that._node = node;
                    }
                    return that;
                });
        },
        //! save
        do_save_search : (that: any) => {
            const ID = that._id;
            if (!ID) return Promise.reject(new Error('._id is required!'));
            if (!that._node) return Promise.reject(new Error('._node is required!'));
            // if (!that._current_time) return Promise.reject(new Error('._current_time is required!'));
            if (!CONF_ES_INDEX) return that;

            const node = that._node;
            const CURRENT_TIME = that._current_time || $U.current_time_ms();
            // _log(NS,'> elasticsearch: save.node =', $U.json(node));
            //! copy only fields, and update node.
            if (CONF_ES_FIELDS){
                //! copy fields out-of origin.
                const node2 = $_.reduce(CONF_ES_FIELDS, (obj: any, v: any) => {
                    if (node[v] !== undefined) obj[v] = node[v];
                    return obj;
                }, {});

                //! ignore if empty set.
                if (!Object.keys(node2).length) {
                    _err(NS, `! elasticsearch:WARN! nothing to update (${ID})....`);
                    return that;
                }

                //! make sure updated_at copied.
                if (node.created_at !== undefined) node2.created_at = node.created_at;
                if (node.updated_at !== undefined) node2.updated_at = node.updated_at;
                if (node.deleted_at !== undefined) node2.deleted_at = node.deleted_at;

                _log(NS, `> elasticsearch:save(${CONF_ES_MASTER}/${ID}).... node2=`, $U.json(node2));
                if (CONF_ES_TIMESERIES){
                    //! TIMESERIES 데이터 일경우. 시간 저장.
                    node2['@timestamp'] = CURRENT_TIME;
                    node2[CONF_ID_NAME] = ID;
                    return $ES.do_push_item(CONF_ES_INDEX, CONF_ES_TYPE, node2)
                        .then((_: any) => {
                            _log(NS, `! elasticsearch: pushed-item(${ID})@1 res=`, $U.json(_));
                            return that;
                        });
                } else if (CONF_ES_MASTER){
                    return $ES.do_create_item(CONF_ES_INDEX, CONF_ES_TYPE, ID, node2)
                        .then((_: any) => {
                            _log(NS, `! elasticsearch: saved-item(${ID})@1 res=`, $U.json(_));
                            return that;
                        });
                } else {
                    return $ES.do_update_item(CONF_ES_INDEX, CONF_ES_TYPE, ID, node2)
                        .then((_: any) => {
                            _log(NS, `! elasticsearch: updated-item(${ID})@1 res=`, $U.json(_));
                            return that;
                        })
                }
            }

            // _log(NS, `- elasticsearch:my_save_node(${ID})....`);
            return $ES.do_create_item(CONF_ES_INDEX, CONF_ES_TYPE, ID, node)
                .then((_: any) => {
                    _log(NS, `! elasticsearch: create-item(${ID})@3 res=`, $U.json(_));
                    return that;
                });
        },

        //! update
        do_update_search : (that: any) => {
            const ID = that._id;
            if (!ID) return Promise.reject(new Error('._id is required!'));
            if (!that._updated_node) return Promise.reject(new Error('._updated_node is required!'));
            if (!CONF_ES_INDEX) return that;

            const node = that._updated_node;
            //! copy only fields, and update node.
            if (CONF_ES_FIELDS){
                let node2 = $_.reduce(CONF_ES_FIELDS, (obj: any, val: any) => {
                    obj[val] = node[val];
                    return obj;
                }, {});

                if (!Object.keys(node2).length) {
                    _err(NS, `! elasticsearch:WARN! nothing to update (${ID})....`);
                    return that;
                }

                //! make sure updated_at copied.
                if (node.created_at !== undefined) node2.created_at = node.created_at;
                if (node.updated_at !== undefined) node2.updated_at = node.updated_at;
                if (node.deleted_at !== undefined) node2.deleted_at = node.deleted_at;

                // _log(NS, `- elasticsearch:my_update_node2(${ID})....`);
                return $ES.do_update_item(CONF_ES_INDEX, CONF_ES_TYPE, ID, node2)
                    .then((_: any) => {
                        _log(NS, `! elasticsearch: updated-item(${ID}) res=`, $U.json(_));
                        return that;
                    })
            }

            // _log(NS, `- elasticsearch:my_update_node(${ID})....`);
            return $ES.do_update_item(CONF_ES_INDEX, CONF_ES_TYPE, ID, node)
                .then((_: any) => {
                    _log(NS, `! elasticsearch: updated-item(${ID}) res=`, $U.json(_));
                    return that;
                });
        },
        //! delete
        do_delete_search : (that: any) => {
            const ID = that._id;
            if (!ID) return Promise.reject(new Error('._id is required!'));
            if (!CONF_ES_INDEX) return that;

            if (CONF_ES_FIELDS && !CONF_ES_MASTER) {
                _log(NS, `! elasticsearch:WARN! ignore delete (${ID})....`);
                return that;
            }

            // _log(NS, `- elasticsearch:my_delete_node(${ID})....`);
            return $ES.do_delete_item(CONF_ES_INDEX, CONF_ES_TYPE, ID)
                .then((_: any) => {
                    _log(NS, `! elasticsearch: deleted-item(${ID}) res=`, $U.json(_));
                    return that;
                })
                .catch((err: any) =>{
                    _log(NS, `ERR! ignore - elastic:delete(${ID}) res=`, err);
                    return that;
                })
        },
        //! search
        do_search : (that: any) => {
            // if (!that._id) return Promise.reject(new Error('elasticsearch:_id is required!'));
            if (!CONF_ES_INDEX) return that;
            // const id = that._id;
            // _log(NS, `- elasticsearch:do_search_item()....`);

            if (CONF_ES_FIELDS && !CONF_ES_MASTER) {
                // _log(NS, `! elasticsearch:WARN! ignore search ()....`);
                return that;
            }

            //! Rewrite Query...
            const param: any = {$page:0, $limit:0};            // page start from '0'
            param.$page      = $U.N(that.page, 0);
            param.$limit     = $U.N(that.ipp, that.ipp === 0 ? 0 : 10); //allow ipp to be set 0.
            // param.$exist = '!deleted_at';            // NOT INCLUDE DELETED.
            if (!CONF_ES_TIMESERIES) param.deleted_at = that.deleted_at !== undefined ? that.deleted_at : '0';
            if (that.$source) param.$source = that.$source;        // copy source.
            if (that.$exist) param.$exist = that.$exist;        // check existing field.

            //! custom query.
            if (that.Q) param.$Q = that.Q;
            if (that.A) param.$A = that.A;                // Aggregation (simply to count terms)
            if (that.O) param.$O = that.O;                // OrderBy (default asc by name)
            if (that.H) param.$H = that.H;                // Highlight

            //! add default-sort if no search query.
            if (CONF_ES_TIMESERIES) param.$O = param.$O || '!@timestamp';                            // 최신순으로 정렬.
            param.$O = param.$O || (CONF_ID_TYPE.startsWith('#') ? CONF_ID_NAME+'.keyword' : CONF_ID_NAME);            // 기본은 아이디 값으로.

            //build query parameters.
            if (CONF_ES_FIELDS){
                CONF_ES_FIELDS.forEach((field: any) => {
                    if (field == 'page' || field == 'ipp') return;
                    if (that[field] !== undefined) param[field] = that[field];                        // EQUAL filter.
                    if (that['!'+field] !== undefined) param['!'+field] = that['!'+field];            // NOT filter.
                    if (that['#'+field] !== undefined) param['#'+field] = that['#'+field];            // PROJECTION filter.
                })
            }

            //! 검색 파라미터로 검색을 시작한다.
            _log(NS, `! elasticsearch: search[${CONF_ES_INDEX}/${CONF_ES_TYPE}] =`, $U.json(param));
            return $ES.do_search_item(CONF_ES_INDEX, CONF_ES_TYPE, param)
                .then((_: any) => {
                    // _log(NS, `> elasticsearch: search-res=`, $U.json(_));
                    //! move hits.hits[] to _hits.
                    const hits = _ && _.hits || {};
                    const $lst = hits.hits || [];
                    const $res = hits;

                    const local_list_map = (_: any)=>{
                        const node = _._score ? $U.extend({'_score':_._score}, _._source) : _._source;
                        if (CONF_ES_TIMESERIES) node['@id'] = _._id;

                        if (_.highlight != undefined) {
                            Object.keys(_.highlight).forEach(key=>{
                                node[key + "_highlight"] = _.highlight[key][0];
                            })
                        }

                        return node;
                    }

                    //! copy result...
                    that.list = $lst.map(local_list_map);
                    that.total = $U.N($res.total||0);
                    that.page = param.$page;            // page number
                    that.ipp = param.$limit;            // page count per paging.
                    that.took = _.took||0;                // time took in msec.

                    if (_.aggregations !== undefined) {
                        that.aggregations = _.aggregations;
                    }

                    //! returns that.
                    return that;
                }).catch((e: any) => {
                    _err(NS, '!ERR @search =', e);
                    throw e;
                })
        },
    };

    /** ****************************************************************************************************************
     *  Main Handler.
     ** ****************************************************************************************************************/
    const $CACHE: any = {};                                  // INTERNAL IN-MEMORY CACHE.

    const as_cache_key = (that: any) => {
        const ID = that._id||'';
        return [CONF_REDIS_PKEY,CONF_DYNA_TABLE,`${ID}`].join(':').toUpperCase();
    }

    //! read from local-cache.
    const local_cache_read = (that: any) => {
        const key       = as_cache_key(that);
        const cached    = $CACHE[key]||{};
        const cached_at = $U.N(cached.cached_at, 0);
        const curr_ms   = that._current_time || $U.current_time_ms();
        const diff_ms   = curr_ms - cached_at;
        if (!cached.node || !cached_at) return false;               // cache miss.
        if (diff_ms > 2000) return false;                           // cache time-out.
        that._node = Object.assign({}, cached.node);                // clean copy.
        that.C          = cached_at;
        // _log(NS, 'C['+key+'] =', cached_at)
        return true;
    }

    //! save into local-cache.
    const local_cache_save = (that: any) => {
        //! CONF_ES_TIMESERIES 일 경우, 내부 캐시 안함.
        if (CONF_ES_TIMESERIES) return that;

        const key       = as_cache_key(that);
        const node      = that._node;
        const curr_ms   = that._current_time || $U.current_time_ms();
        if (!node) delete $CACHE[key];
        const cached    = {cached_at: curr_ms, node: node};
        // _log(NS, 'C['+key+'] :=', cached.cached_at)
        $CACHE[key]     = cached;
        return that;
    }

    //! delete cache.
    const local_cache_delete = (that: any) => {
        const key       = as_cache_key(that);
        delete $CACHE[key];
        return that;
    }

    //! validate if properties is primitive.
    const my_validate_properties = (that: any) =>{
        const ID = that._id;
        Object.keys(that).forEach((key, i)=>{
            if (!that.hasOwnProperty(key)) return;                                  // Check OwnProperty
            if (key.startsWith('_') || key.startsWith('$')) return;                 // Ignore internal properties.
            if (CONF_FIELDS && CONF_FIELDS.indexOf(key) < 0) return;                // Ignore if not defined as FIELDS.
            const val = that[key];
            if (val && typeof val == 'object'){                                     // ONLY check if object type.
                if (Array.isArray(val)){
                    const vals = val;
                    vals.forEach((val2, j)=>{
                        if (val2 && typeof val2 == 'object')
                            throw new Error('Invalid data-type (object) key:'+key+'@'+ID+':'+j);
                    })
                } else {
                    throw new Error('Invalid data-type (object) key:'+key+'@'+ID);
                }
            }
        })
        return that;
    }

    //! Read Node - read from cache first, or dynamo.
    const my_read_node = (that: any) => {
        const ID = that._id;
        if (!ID) return Promise.reject(new Error('._id is required!'));

        //! read node via cache.
        if (local_cache_read(that)) return Promise.resolve(that);

        // _log(NS, `- my_read_node (${ID})...., that=`, $U.json(that));
        return Promise.resolve(that)
            .then($redis.do_read_cache)                             // STEP 1. Read Node from Redis (의도적으로 error 발생)
            //- Dynamo 에서 읽어 왔다면, Redis 에 없는 경우이므로, 이때는 Redis 에 저장해 준다.
            .catch((that: any) => {
                if (that && that instanceof Error) throw that;
                //! try to read via dynamo
                return $dynamo.do_read_dynamo(that)                 // STEP 2. If failed, Read Node from DynamoDB.
                    .then((that: any) => {
                        // report error if not found.
                        const node = that._node||{};
                        if (node[CONF_ID_NAME] === undefined){
                            return Promise.reject(new Error('404 NOT FOUND. '+CONF_DYNA_TABLE+'.id:'+(that._id||'')));
                        }
                        return that;
                    })
                    .then($redis.do_save_cache)                         // STEP 2-2. save back to Redis also.
                    .then($elasticsearch.do_save_search)                // STEP 2-3. save back to ElasticSearch also.
            })
            .then(local_cache_save)
    };

    //! Read Node in deep - read from dynamo.
    const my_read_node_deep = (that: any) => {
        const ID = that._id;
        if (!ID) return Promise.reject(new Error('._id is required!'));

        _log(NS, `- my_read_node_deep (${ID})...., that=`, $U.json(that));
        return Promise.resolve(that)
            //- Dynamo 에서 읽어 왔다면, Redis 에 없는 경우이므로, 이때는 Redis 에 저장해 준다.
            .then((that: any) => {
                //! try to read via dynamo
                return $dynamo.do_read_dynamo(that)
                    .then((that: any) => {
                        const node = that._node||{};
                        if (node[CONF_ID_NAME] === undefined) {
                            return Promise.reject(new Error('404 NOT FOUND. '+CONF_DYNA_TABLE+'.id:'+(that._id||'')));
                        }
                        return that;
                    })
            })
            .then(local_cache_save)
    };

    //! decript the xecured field. ONLY IF on projetion. (NOT TO ORIGIN)
    const my_filter_read_decrypt = (node: any) => {
        if (!node) return node;
        if (!CONF_XEC_FIELDS || !CONF_XEC_FIELDS.length) return node;
        const $xec = CONF_XECURE_KEY ? $crypto(CONF_XECURE_KEY) : null;
        if (!$xec) return node;
        // _log(NS, '> my_filter_read_decrypt: node =', $U.copy_node(node));
        _log(NS, '> CONF_XEC_FIELDS=', CONF_XEC_FIELDS);
        //! decrypt each fields.
        return CONF_XEC_FIELDS.reduce((N: any, key: any)=>{
            const val = N[key];
            if (val === undefined) return N;
            N[key] = val ? $xec.decrypt(val) : val;
            // _log(NS, '>> node['+key+'] :=', N[key]);
            return N;
        }, node);
    };

    //! Save Node - Overwrite All Node.
    const my_save_node = (that: any) => {
        const ID = that._id;
        if (!ID) return Promise.reject(new Error('._id is required!'));
        if (!that._node) return Promise.reject(new Error('_node is required!'));

        // _log(NS, `- my_save_node (${ID})....`);
        // _log(NS, '>> that =', that);
        return Promise.resolve(that)
            .then(my_validate_properties)
            .then($dynamo.do_save_dynamo)
            .then($redis.do_save_cache)
            .then($elasticsearch.do_save_search)
            .then(local_cache_save)
    };

    /**
     * clone this node..
     *  that._id            : current node-id.
     *  that._node          : original node.
     *  that._current_time  : current-time
     *  that._clone_id      : new cloned node-id (required if !CLONEABLE)
     *
     * @param that
     * @returns {*}
     */
    const my_clone_node = (that: any) => {
        const ID = that._id;
        if (!ID) return Promise.reject(new Error('._id is required!'));
        if (!that._node) return Promise.reject(new Error('._node is required!'));
        if (!that._current_time) return Promise.reject(new Error('._current_time is required!'));

        _log(NS, `- my_clone_node (${ID})....`);
        // _log(NS, `> clone_node (${ID}). that =`, $U.json(that));
        return Promise.resolve(that)
            //! copy the current-node with new id.
            .then((that: any) => {
                // if (!that._id) return Promise.reject(new Error('._id is required!'));
                //! if not cloneable, then clone-id is required.
                if (!CONF_CLONEABLE) {
                    // if (!that._clone_id) return Promise.reject(new Error('._clone_id is required!'));
                    return that;
                }

                //! determine parent/cloned id field.
                const PARENT_ID = that[CONF_PARENT_ID] !== undefined ? $U.N(that[CONF_PARENT_ID], 0) : ID;      // override
                const CLONED_ID = ID;

                //! prepare new cloning-id.
                return my_prepare_id({_id:0})
                    .then((that2: any) => {
                        const ID2 = that2._id;
                        const node = that._node||{};
                        //that2[CONF_ID_INPUT] = ID2;       // make sure id input.
                        node[CONF_ID_NAME] = ID2;            // make sure id field.
                        //! config node's parent/cloned
                        if (CONF_PARENT_ID) node[CONF_PARENT_ID] = PARENT_ID;          // make sure parent field.
                        if (CONF_CLONED_ID) node[CONF_CLONED_ID] = CLONED_ID;          // make sure cloned field.

                        //! copy back to that.
                        if (CONF_PARENT_ID) that[CONF_PARENT_ID] = PARENT_ID;          // make sure parent field.
                        if (CONF_CLONED_ID) that[CONF_CLONED_ID] = CLONED_ID;          // make sure cloned field.

                        that._clone_id = ID2;
                        that._node = node;
                        return that;
                    })
            })
            //! save back.
            .then((that: any) => {
                const ID = that._id;
                if (!that._node) return Promise.reject(new Error('._node is required!'));
                if (!that._clone_id) return Promise.reject(new Error('._clone_id is required!'));

                //! now override id with clone-id.
                that._id = that._clone_id;      // override ID with clone-id.

                // that._node = mark_node_created(that._node, current_time);
                //!INFO! - 클론을 할 경우, 모든 필드가 옮겨 가며, 일부 FIELDS 에 정의되어 있지 않는 경우도 있음.
                //!INFO! - 하여, that & node 에 동시에 필드 정의가 있을 경우, 이를 복제해 준다.
                $_.reduce(that, (node: any, val: any, key: string) => {
                    if (!key) return node;
                    if (key.startsWith('_')) return node;
                    if (key.startsWith('$')) return node;
                    if (IGNORE_FIELDS.indexOf(key) >= 0) return node;
                    if (node[key] !== undefined){
                        node[key] = val;
                    }
                    return node;
                }, that._node)

                _log(NS, '>> before save-node().. that._node =', $U.json(that._node));
                //! now save whole _node.
                return my_save_node(that)
                    .then(()=>{
                        //! WARN!. _id must be restored as origin !!!!!
                        that._id = ID;
                        return that;
                    });
            })
            .then((that: any) => {
                // _log(NS, '>> FIELDS = ', $U.json(CONF_FIELDS));
                _log(NS, '>> cloned-node['+that._id+' -> '+that._clone_id+'] res=', $U.json(that._node));
                return that;
            });
    };

    //! Update Node - Update ONLY the updated field.
    const my_update_node = (that: any) => {
        const ID = that._id;
        if (!ID) return Promise.reject(new Error('._id is required!'));
        // _log(NS, `- my_update_node (${ID})....`);

        //! ignore if no need to update due to FIELDS config.
        if (that._fields_count === 0) {
            _log(NS, `! my_update_node() no need to update... fields_count=`+that._fields_count);
            return that;
        }

        return Promise.resolve(that)
            .then(my_validate_properties)
            .then($dynamo.do_update_dynamo)
            //INFO! - 현재로서는 Redis 에 변경된 필드만 저장 안됨.
            //INFO! - 캐시 기반으로 업데이트 전체 내용 저장하고, 이후 Stream 처리에서 최종 내용 다시 확인.
            // .then($redis.my_update_node)
            // .then($elasticsearch.my_update_node)
            // .then($redis.my_save_node)
            // .then($elasticsearch.my_save_node)
            //INFO! - save only if there is node updated.
            .then((that: any) => that._updated_node ? $redis.do_save_cache(that) : that)
            .then((that: any) => that._updated_node ? $elasticsearch.do_save_search(that) : that)
            .then((that: any) => that._updated_node ? local_cache_save(that) : that)
            .then((that: any) => {
                _log(NS, '>> updated-node['+ID+'] res=', $U.json(that._updated_node));
                return that;
            })
            .catch((e: any) => {
                const message = e && e.message || '';
                _err(NS, '>> updated-node['+ID+'] err=', message);
                //Dynamo : 503 ERROR - The provided expression refers to an attribute that does not exist in the item
                if (message.indexOf('an attribute that does not exist in the item') > 0){
                    return my_save_node(that);
                }
                throw e;
            })
    };

    //! Increment Node - Update ONLY the updated field.
    const my_increment_node = (that: any) => {
        const ID = that._id;
        if (!ID) return Promise.reject(new Error('._id is required!'));
        // _log(NS, `- my_increment_node (${ID})....`);

        //! ignore if no need to increment due to FIELDS config.
        if (that._fields_count === 0) {
            _log(NS, `! my_increment_node() no need to increment... fields_count=`+that._fields_count);
            return that;
        }

        return Promise.resolve(that)
            .then(my_validate_properties)
            .then($dynamo.do_increment_dynamo)
            //INFO! - 현재로서는 Redis 에 변경된 필드만 저장 안됨.
            //INFO! - 캐시 기반으로 업데이트 전체 내용 저장하고, 이후 Stream 처리에서 최종 내용 다시 확인.
            // .then($redis.my_update_node)
            // .then($elasticsearch.my_update_node)
            // .then($redis.my_save_node)
            // .then($elasticsearch.my_save_node)
            //INFO! - save only if there is node updated.
            .then((that: any) => that._updated_node ? $redis.do_save_cache(that) : that)
            .then((that: any) => that._updated_node ? $elasticsearch.do_save_search(that) : that)
            .then((that: any) => that._updated_node ? local_cache_save(that) : that)
            .then((that: any) => {
                _log(NS, '>> increment-node['+ID+'] res=', $U.json(that._updated_node));
                return that;
            });
    };

    //! Delete Node - Delete.
    const my_delete_node = (that: any) => {
        const ID = that._id;
        if (!ID) return Promise.reject(new Error('._id is required!'));
        // _log(NS, `- my_delete_node (${ID})....`);
        return Promise.resolve(that)
            .then($dynamo.do_delete_dynamo)                   // STEP 1. Delete Node from DynamoDB by node-id.
            .then($redis.do_delete_cache)                    // STEP 2. Delete Node from Redis.
            .then($elasticsearch.do_delete_search)            // STEP 3. Delete Node from ES.
            .then(local_cache_delete)
            .then((that: any) => {
                _log(NS, '>> deleted-node res=', $U.json(that._node));
                return that;
            });
    };

    //! search node..
    const my_search_node = (that: any) => {
        // const ID = that._id;
        // if (!ID) return Promise.reject(new Error('._id is required!'));
        // _log(NS, `- my_search_node (${ID})....`);
        // _log(NS, '> that =', that);
        return Promise.resolve(that)
            .then($elasticsearch.do_search)            // STEP 3. Search Node from ES.
            // .then((that: any) => {
            //     // _log(NS, '>> search-node res=', $U.json(that._node));
            //     return that;
            // });
    };

    //! notify event of node.
    const my_notify_node = (that: any) => {
        if (!that) return that;
        if (!that._id) return Promise.reject(new Error('_id is required!'));

        const mode = that._current_mode;
        // _log(NS, `- my_notify_node (${ID}, ${mode})....`);
        return Promise.resolve(that)
            .then((that: any) => {
                // _log(NS, '>> notify-node res=', $U.json(that._updated_node));
                let is_notifiable = false;

                //! Notify 를 발생할지를 결정한다.
                if(mode === 'create' || mode === 'prepare' || mode === 'delete' || mode === 'destroy' ){
                    is_notifiable = true;
                } else if (mode === 'update' || mode === 'increment'){
                    is_notifiable = that._fields_count > 0;
                }

                //! fire notify-event. (주위! Records 에서 처리되는 이벤트와 이름이 다름)
                if(is_notifiable)
                {
                    const EID = CONF_NS_NAME+':event'+':'+mode;
                    _log(NS, '>>> notify event-id:', EID, ', notifiable=', is_notifiable);
                    return my_notify_event(EID, 1 ? that : that._node)
                        .then((_: any) => {
                            // _log(NS, `! notified-node (${ID}, ${mode}) res=`, _);
                            return that;
                        });
                }

                //! return finally.
                return that;
            });
    };


    /** ****************************************************************************************************************
     *  Event Handler.
     ** ****************************************************************************************************************/
    const my_event_records = (that: any) => {
        if (!that.records) return Promise.reject(new Error('records is required!'));
        const records = that.records.slice(0);          // copy array.
        const context = that._ctx || {};                // origin context to relay.

        _log(NS, `- my_event_records().... records.len=`, records.length);
        if (!records.length) return that;

        //! array promised.
        const fx_promise_array = (records: any, fx: any, context: any) => {
            let chain = $U.promise(records.shift());
            chain = records.reduce((chain: any, record: any) => {
                return chain.then(() => fx(record, context));
            }, chain.then((record: any) => fx(record, context)));
            return chain;
        };

        //! execute processing records one by one.
        return fx_promise_array(records, my_process_record, context)
            .then((last: any) => {
                _log(NS, '! last =', $U.json(last));
                return that;
            })
            .catch((e: any) => {
                _err(NS, '! error ignored =', e);
                return that;
            })
    };

    //! process record.
    const my_process_record = ($record: any, context: any) => {
        if (!$record) return Promise.reject(new Error('record is required'));
        // if (!record.table) return Promise.reject(new Error('record.table is required'));
        if (!$record.dynamodb && !$record.Sns) return Promise.reject(new Error('record.dynamodb|Sns is required'));
        // if (!record.eventSourceARN) return Promise.reject(new Error('record.eventSourceARN is required'));

        //! decode record's eventName.
        const EVENT_NAME = $record.eventName || 'EVENT';
        let chain = null;

        if ($record.dynamodb)
        {
            //! decode table name from ARN.
            //  - eventSourceARN: 'arn:aws:dynamodb:ap-northeast-2:820167020551:table/TestTable/stream/2017-08-12T09:51:57.928'
            const tableName = $record.table || ($record.eventSourceARN && $record.eventSourceARN.split('/')[1]) || '';
            _log(NS,`--- process-record(${tableName}) ... `);

            //! ignore if target table is not matching.
            if (CONF_DYNA_TABLE !== tableName) {
                _log(NS,`! ignore record-table: ${CONF_DYNA_TABLE} != ${tableName} `);
                return $record;
            }

            const keyRecord = $record.dynamodb.Keys ? DynamoDBValue.toJavascript($record.dynamodb.Keys, null) : {};
            const newRecord = $record.dynamodb.NewImage ? DynamoDBValue.toJavascript($record.dynamodb.NewImage, null) : null;
            const oldRecord = $record.dynamodb.OldImage ? DynamoDBValue.toJavascript($record.dynamodb.OldImage, null) : null;

            const ID = keyRecord[CONF_ID_NAME];
            // keyRecord && _log(NS,`> ${EVENT_NAME} - ${tableName}.keyRecord[${ID}]=`, $U.json(keyRecord));
            // oldRecord && _log(NS,`> ${EVENT_NAME} - ${tableName}.oldRecord[${ID}]=`, $U.json(oldRecord));
            // newRecord && _log(NS,`> ${EVENT_NAME} - ${tableName}.newRecord[${ID}]=`, $U.json(newRecord));

            //! 이제 변경된 데이터를 추적해서, 이후 처리 지원. (update 는 호출만되어도 이벤트가 발생하게 됨)
            const diff = EVENT_NAME === 'MODIFY' ? $U.diff(oldRecord, newRecord) : null;
            const updated_at = $U.N(newRecord && newRecord.updated_at || 0);
            const prev = diff ? $_.reduce(diff, (node: any, key: any) => {node[key] = oldRecord[key]; return node}, {}) : null;
            const that = {_id:ID, _node:newRecord, _updated_at:updated_at, _diff:diff, _prev:prev, _ctx: context}; // use updated_at for
            chain = Promise.resolve(that);
            diff && _log(NS,`>> ${tableName}.different[${ID}]=`, $U.json(diff));

            // _log(NS,`>> Record(${tableName}) that=`, that);

            //! decode event.
            switch(EVENT_NAME){
                case "INSERT":          // only newRecord.
                case "MODIFY":          // both records.
                    chain = chain.then((that: any) => {
                        const ID = that._id;
                        if (CONF_ES_TIMESERIES) return that;                    //ignore!.

                        //! update cache if stream is latest!!.
                        return $redis.do_get_cache_updated(ID)
                            .then((updated_at: any) => {
                                _inf(NS, `>> ${tableName}.updated_at[${ID}] res=`, updated_at, ' <- ', that._updated_at
                                    ,(that._updated_at !== updated_at ? '*' : ''));
                                //! check if latest node is present.
                                if (!updated_at || that._updated_at >= updated_at)
                                {
                                    //_log(NS,'! INFO! node was updated!!!');
                                    const hashValue = $U.hash(newRecord);
                                    return $redis.do_get_cache_hash(ID)
                                        .then((hash_value: any) => {
                                            // _log(NS,'>> old hash-value =', hash_value);
                                            if(hash_value && hash_value === hashValue){
                                                _log(NS,'!WARN! ignored due to hash-value matching =', hash_value);
                                                return that;
                                            }
                                            if(hash_value !== -1) _log(NS,'! INFO! node was updated. hash :=', hashValue,'<-',hash_value);

                                            //! otherwise, save node back....
                                            return $redis.do_save_cache(that)
                                                .then($elasticsearch.do_save_search);
                                        })
                                }
                                else
                                {
                                    _log(NS,'! ignored due to old-record');
                                }
                                return that;
                            });
                    });
                    break;
                case "REMOVE":          // only oldRecord.
                    _log(NS,'>> removed!');
                    chain = chain.then($redis.do_delete_cache);
                    chain = chain.then($elasticsearch.do_delete_search);
                    break;
            }
        }
        else if ($record.Sns)
        {
            _log(NS,'>> event-SNS =', $record.Sns);
            const that = {};
            // { Type: 'Notification',
            // MessageId: '0752e5c3-65c5-5a95-81db-b711eb9864ec',
            // TopicArn: 'arn:aws:sns:ap-northeast-2:085403634746:item-pools-event',
            // Subject: 'aasdf',
            // Message: 'asdf',
            // Timestamp: '2018-01-12T10:21:17.224Z',
            // SignatureVersion: '1',
            // Signature: 'ZsyWm0Attrz+nWgZLu7j6pw/TWZFUYqX+uxeezD0hl2Ae0rLXCBzaZO8GarxgVmUcl3ongGRgNp9HIK5lBHNBKCsIqxM0sHnunbsO0MxJgZQsXCW2GggZD5nJ4yqlFErIa16cWDk3FJEJ0nsI1/On0j/ZKqx8IWCwcdfOH4g6QK8fV0kAXOMqeJbTE9r0RSoIwSwud34Um0GgwVFofWIQ30Ii6Tz8NvTJyySRWb+Ox5NEXS1j483XW1uejiOyTBigASWpMjGBXDctLJzb5t9Y8IWR8IRHrrW1z3aaSpWejz5i5lebU6yUKvwrTFNvDq+CooDgzGSYhtzYAQnMi1ZMg==',
            // SigningCertUrl: 'https://sns.ap-northeast-2.amazonaws.com/SimpleNotificationService-433026a4050d206028891664da859041.pem',
            // UnsubscribeUrl: 'https://sns.ap-northeast-2.amazonaws.com/?Action=Unsubscribe&SubscriptionArn=arn:aws:sns:ap-northeast-2:085403634746:item-pools-event:bd60b895-792c-4d03-9971-755b047de8d3',
            // MessageAttributes:
            //  { 'AWS.SNS.MOBILE.MPNS.Type': { Type: 'String', Value: 'token' },
            //    'AWS.SNS.MOBILE.MPNS.NotificationClass': { Type: 'String', Value: 'realtime' },
            //    'AWS.SNS.MOBILE.WNS.Type': { Type: 'String', Value: 'wns/badge' } } }
            chain = Promise.resolve($record.Sns);
        }
        if (!chain) return Promise.reject(new Error('invalid chain!'));

        //! finally returns chain.
        return chain
            .then((that: any) => {
                const MAP: any = {"INSERT":"create", "MODIFY":"update", "REMOVE":"delete", "EVENT":'event'};
                const mode = MAP[EVENT_NAME];
                const is_notifiable = !!mode;
                that._current_mode = mode;

                //! fire notify-event and wait.
                if (is_notifiable)
                {
                    const EID = CONF_NS_NAME+':record'+':'+mode;
                    _log(NS, '>>> notify event-id:', EID, ', notifiable=', is_notifiable);
                    return my_notify_event(EID, 1 ? that : that._node).then((_: any) => {
                        // _log(NS, `! notified-node (${ID}, ${mode}) res=`, _);
                        return that
                    })
                }

                //! return self.
                return that;
            })
            .then(() => $record);
    };

    /** ****************************************************************************************************************
     *  Notify Handler.
     *  type(id)    ID 형식은 Prefix 로 자기 자신의 이름이 들어간다.
     *  ex) LEM:hello       => 앞에 LEM: 이 들어감. 아닐 경우 그냥 다 무시됨.
     *
     *  $notify = {
     *      type            # unique-name as notify - id
     *      data            # payload data.
     *      trace_id        # tracking id.
     *      notifier        # notify trigger invoker.
     *  }
     ** ****************************************************************************************************************/
    const my_notify_event = (id: any, that: any) => {
        return $NOT.do_notify(id, that);
    }

    // //! notify handler mapping
    // thiz.$notify = {};
    //
    // //! quick check if subscribers exist.
    // const has_subscriber = (id) => {
    //     //! for each action.
    //     const actions = thiz.$notify[id];
    //     return actions && actions.length > 0;
    // }
    //
    // //! notify 를 발생시킨다.
    // const my_notify_event = (type, data, trace_id, notifier) => {
    //     if (!type) return Promise.reject(new Error('notify:type is required!'));
    //     const ID = NS_NAME+':'+type;
    //     if (!has_subscriber(ID)) return Promise.resolve(false);
    //
    //     //! prepare notify object.
    //     let that = {};
    //     that._id = ID;
    //     that.data = data;
    //     that._trace_id = trace_id;
    //     that._notifier = notifier;
    //     return Promise.resolve(that).then(my_notify_trigger);
    // }

    // //! Promised notify-trigger.
    // const my_notify_trigger = (that: any) => {
    //     if (!that._id) return Promise.reject(new Error('notify:_id is required!'));
    //     // if (!that.params) return Promise.reject(new Error('params is required!'));
    //     const id = ''+that._id;
    //     _log(NS, `- my_notify_trigger(${ID}).... that=`, $U.json(that));
    //
    //     if(!id.startsWith(NS_NAME+':')){
    //         _log(NS, '! WARN - ignored due to id='+id+' by NS='+NS_NAME);
    //         return that;
    //     }
    //
    //     //! for each action.
    //     const actions = thiz.$notify[id];
    //     if (actions){
    //         return Promise.all(actions.map(action => action instanceof Promise ? action : action(that)));
    //     }
    //
    //     return that;
    // };

    // //! Bubbled Subscriber to Notify.
    // const my_notify_subscribe = (that: any) => {
    //     if (!that._id) return Promise.reject(new Error('notify:_id is required!'));
    //     if (!that.params) return Promise.reject(new Error('notify:params is required!'));
    //     let id = ''+that._id;
    //     let params = that.params;
    //     _log(NS, `- my_notify_subscribe(${ID}).... params=`, typeof params);
    //
    //     //! If starts with ':', then auto-complete notify-id.
    //     if(id.startsWith(':')){
    //         id = NS_NAME + ':' + CONF_DYNA_TABLE + id;
    //     }
    //
    //     //! Check Name-Space
    //     if(!id.startsWith(NS_NAME+':')){
    //         _log(NS, '! WARN - ignored due to id='+id+' by NS='+NS_NAME);
    //         return that;
    //     }
    //     _log(NS, '! INFO - register subscriber by id ='+id);
    //
    //     //! inline function.
    //     let handler = null;
    //     if (typeof params === 'function'){
    //         //! it must be promised handler.
    //         handler = (that: any) => {
    //             return new Promise((resolve,reject) => {
    //                 try{
    //                     resolve(params(that));
    //                 }catch(e){
    //                     reject(e);
    //                 }
    //             });
    //         }
    //     } else if (typeof params === 'object' && params instanceof Promise){
    //         handler = params;
    //     } else {
    //         return Promise.reject(new Error('invalid params type:'+(typeof params)));
    //     }
    //
    //     //! register into list.
    //     if (handler){
    //         //! check if all modes.
    //         if (!id.endsWith(':*')){
    //             if (!thiz.$notify[id]) thiz.$notify[id] = [];
    //             thiz.$notify[id].push(handler);
    //             _log(NS, `! notify-subscribe(${ID}) count=`, thiz.$notify[id].length);
    //         } else {
    //             const MODES = ['create','update','delete'];
    //             const id2 = id.substring(0, id.length-1);
    //             MODES.forEach(mode => {
    //                 let id = id2 + mode;
    //                 if (!thiz.$notify[id]) thiz.$notify[id] = [];
    //                 thiz.$notify[id].push(handler);
    //                 _log(NS, `! notify-subscribe(${ID}) count=`, thiz.$notify[id].length);
    //             })
    //         }
    //     }
    //
    //     return that;
    // };

    /** ****************************************************************************************************************
     *  Management Functions.
     ** ****************************************************************************************************************/
    /**
     * 리소스(테이블 생성/인덱스 생성등) 초기화 시킨다.
     *
     * @param that
     */
    const my_initialize_all = (that: any) => {
        let actions = [];

        //! Dynamo
        if (CONF_DYNA_TABLE) {
            const ID_TYPE = CONF_ID_TYPE.startsWith('#') ? 'S' : 'N';            // String or Number.
            actions.push(Promise.resolve('DynamoDb')
                .then((_: any) => {
                    _log(NS, '# initialize ', _);
                    return $DS.do_create_table(CONF_DYNA_TABLE, CONF_ID_NAME, ID_TYPE).then((_: any) => {
                        // _log(NS, '> create-table res=', _);
                        const res = _.TableDescription.TableName === CONF_DYNA_TABLE;
                        return {'result': res, 'name': 'dynamo:'+CONF_DYNA_TABLE};
                    })
                }).catch((e: any) => {
                    const msg = e.message||`${e}`;
                    _err(NS, '> create-table error=', e);
                    if (e.code === 'ResourceInUseException') return {'result': false, 'name': 'dynamo:'+CONF_DYNA_TABLE, 'code':e.code};            //IGNORE! duplicated table.
                    //if (e.code == 'NetworkingError') return false;
                    // throw e;
                    return {'result': false, 'name': 'dynamo:'+CONF_DYNA_TABLE, 'error': msg};
                })
            );
        } else {
            _log(NS, 'DS: WARN! ignored configuration. DYNA_TABLE=', CONF_DYNA_TABLE);
        }

        //! MySQL for Sequence
        if (CONF_ID_TYPE && !CONF_ID_TYPE.startsWith('#')) {
            actions.push(Promise.resolve('MySQL')
                .then((_: any) => {
                    _log(NS, '# initialize MySQL (Sequence) ');
                    return $MS.do_create_id_seq(CONF_ID_TYPE, CONF_ID_NEXT).then((_: any) => {
                        _log(NS, '> create-id-seq res=', _);
                        return {'result': true, 'name': 'sequence'};
                    })
                }).catch((e: any) => {
                    const msg = e.message||`${e}`;
                    _err(NS, '> create-id-seq error=', e);
                    if (e.code === 'ER_TABLE_EXISTS_ERROR') return {'result': false, 'name': 'MySQL', 'code': e.code};;            //IGNORE! duplicated sequence-table.
                    //if (e.code == 'NetworkingError') return false;
                    // throw e;
                    return {'result': false, 'name': 'MySQL', 'error': msg};
                }));
        //! 이름이 '#'으로 시작하고, CONF_ID_NEXT 가 있을 경우, 내부적 ID 생성 목적으로 시퀀스를 생성해 둔다.
        } else if (CONF_ID_TYPE && CONF_ID_TYPE.startsWith('#') && CONF_ID_TYPE.length > 1 && CONF_ID_NEXT > 0) {
            actions.push(Promise.resolve('MySQL')
                .then((_: any) => {
                    _log(NS, '# initialize MySQL (Sequence) ');
                    const ID_NAME = CONF_ID_TYPE.substring(1);
                    return $MS.do_create_id_seq(ID_NAME, CONF_ID_NEXT).then((_: any) => {
                        _log(NS, '> create-id-seq['+ID_NAME+'] res=', _);
                        return {'result': true, 'name': 'MySQL'};
                    })
                }).catch((e: any) => {
                    const msg = e.message||`${e}`;
                    _err(NS, '> create-id-seq error=', e);
                    if (e.code === 'ER_TABLE_EXISTS_ERROR') return {'result': false, 'name': 'MySQL', 'code':e.code};            //IGNORE! duplicated sequence-table.
                    //if (e.code == 'NetworkingError') return false;
                    // throw e;
                    return {'result': false, 'name': 'MySQL', 'error': msg};
                }));
        } else {
            _log(NS, 'MS: WARN! ignored configuration. ID_TYPE=', CONF_ID_TYPE);
        }

        //! ElasticSearch for Initial Type.
        if (CONF_ES_INDEX && CONF_ES_FIELDS) {
            //TODO - Use Dynamic Field Template!!!..
            //! see:https://www.elastic.co/guide/en/elasticsearch/reference/current/dynamic-templates.html
            //!INFO! optimized for ES6.0 @180520
            const ES_SETTINGS: any = {
                "template": CONF_ES_INDEX,
                // "settings": {
                //     "index": {
                //         "refresh_interval": "5s"
                //     }
                // },
                "mappings" : {
                    "_default_": {
                        // "_all": {"enabled": true},   only for ES5 (see below)
                        "dynamic_templates": [{
                            "string_fields": {
                                "match": "*_multi",
                                "match_mapping_type": "string",
                                "mapping": {
                                    "type": "multi_field",
                                    "fields": {
                                        "{name}": {
                                            "type": CONF_ES_VERSION >= 6 ? "text" : "string",  "index": "analyzed", "omit_norms": true, "index_options": "docs"
                                        },
                                        "{name}.raw": {"type": CONF_ES_VERSION >= 6 ? "text" : "string", "index": "not_analyzed", "ignore_above": 256}
                                    }
                                }
                            }
                        }],
                        "_source":    { "enabled": CONF_ES_VERSION >= 6 ? true : false },
                        "properties": {
                            "@version": {"type": CONF_ES_VERSION >= 6 ? "text" : "string", "index": CONF_ES_VERSION >= 6 ? false : "not_analyzed"},
                            "title":    { "type": CONF_ES_VERSION >= 6 ? "text" : "string"  },
                            "name":     { "type": CONF_ES_VERSION >= 6 ? "text" : "string"  },
                            "created_at":  {
                                "type":   "date",
                                "format": "strict_date_optional_time||epoch_millis"
                            },
                            "updated_at":  {
                                "type":   "date",
                                "format": "strict_date_optional_time||epoch_millis"
                            },
                            "deleted_at":  {
                                "type":   "date",
                                "format": "strict_date_optional_time||epoch_millis"
                            },
                        }
                    }
                }
            }

            //! ES6 추가 구성...
            if (!(CONF_ES_VERSION >= 6)){
                ES_SETTINGS.mappings._default_["all"] = {"enabled": true};
            }

            //! ID가 문자열이면, 인덱스를 추가해 줌.
            if (CONF_ID_NAME && CONF_ID_TYPE.startsWith('#')){
                ES_SETTINGS.mappings._default_.properties[CONF_ID_NAME] = {
                    "type": CONF_ES_VERSION >= 6 ? "text" : "string",
                    "fields": {
                        "keyword": {type: "keyword", ignore_above: 256}
                    }
                };
            }

            //! timeseries 데이터로, 기본 timestamp 값을 넣어준다. (주위! save시 current-time 값 자동 저장)
            if (!!CONF_ES_TIMESERIES){
                ES_SETTINGS.settings = {"index": { "refresh_interval": "5s"}};
                ES_SETTINGS.mappings._default_.properties["@timestamp"] = { "type": "date", "doc_values": true };
                ES_SETTINGS.mappings._default_.properties["ip"] = {"type": "ip"};
                const CLEANS = '@version,title,created_at,updated_at,deleted_at'.split(',');
                CLEANS.map(key=> delete ES_SETTINGS.mappings._default_.properties[key]);
            }

            //! add actions
            actions.push(Promise.resolve('ElasticSearch')
                .then((_: any) => {
                    _log(NS, '# initialize ElasticSearch. ES_TYPE=', CONF_ES_TYPE);
                    return $ES.do_create_index_type(CONF_ES_INDEX, CONF_ES_TYPE, ES_SETTINGS)
                        .then((_: any) => {
                            _log(NS, '> create-es-index res=', _);
                            return {'result': true, 'name': 'elasticsearch:'+CONF_ES_INDEX, 'settings': ES_SETTINGS};
                        }).catch((e: any) => {
                            const msg = e.message||e.reason||`${e}`;
                            _err(NS, '> create-es-index error=', e);
                            if (e.type === 'index_already_exists_exception') return {'result': true, 'name': 'elasticsearch:'+CONF_ES_INDEX, 'warn':e.type};    //IGNORE! duplicated sequence-table.
                            // throw e;
                            return {'result': false, 'name': 'elasticsearch:'+CONF_ES_INDEX, 'error': msg};
                        })}
                ));
        } else {
            _log(NS, 'MS: WARN! ignored configuration. ES_TYPE=', CONF_ES_TYPE);
        }

        //! execute all
        //TODO - catch error per each action. and report.
        return Promise.all(actions).then((_: any) => {
            _log(NS, '>> results=', _);
            that.results = _;
            return that;
        })
    };


    /**
     * 리소스를 종료시킨다.
     *
     * @param that
     */
    const my_terminate_all = (that: any) => {
        let actions = [];
        if (CONF_DYNA_TABLE){
            _log(NS, '# terminate DynamoDB');
            actions.push($DS.do_delete_table(CONF_DYNA_TABLE).then((_: any) => {
                // _log(NS, '> delete-table res=', _);
                const res = _.TableDescription.TableName === CONF_DYNA_TABLE;
                return {'result': true, 'name': 'dynamo:'+CONF_DYNA_TABLE};
            }).catch((e: any) => {
                const msg = e.message||`${e}`;
                _err(NS, '> delete-table error=', e);
                if (e.code === 'ResourceNotFoundException') return {'result': true, 'name': 'dynamo:'+CONF_DYNA_TABLE, 'code':e.code};            //IGNORE! destroyed table.
                //if (e.code == 'NetworkingError') return false;
                // throw e;
                return {'result': false, 'name': 'dynamo:'+CONF_DYNA_TABLE, 'error': msg};
            }));
        }

        if (CONF_ID_TYPE && !CONF_ID_TYPE.startsWith('#')) {
            _log(NS, '# terminate MySQL (Sequence) ');
            actions.push($MS.do_delete_id_seq(CONF_ID_TYPE).then((_: any) => {
                _log(NS, '> delete-id-seq res=', _);
                return {'result': true, 'name': 'MySQL:'+CONF_ID_TYPE};
            }).catch((e: any) => {
                const msg = e.message||`${e}`;
                _err(NS, '> delete-id-seq error=', e);
                if (e.code === 'ER_BAD_TABLE_ERROR') return {'result': true, 'name': 'MySQL:'+CONF_ID_TYPE, 'code':e.code};                //IGNORE! no-table.
                //if (e.code == 'NetworkingError') return false;
                // throw e;
                return {'result': false, 'name': 'MySQL:'+CONF_ID_TYPE, 'error': msg};
            }));
        //! 이름이 '#'으로 시작하고, CONF_ID_NEXT 가 있을 경우, 내부적 ID 생성 목적으로 시퀀스를 생성해 둔다.
        } else if (CONF_ID_TYPE && CONF_ID_TYPE.startsWith('#') && CONF_ID_TYPE.length > 1 && CONF_ID_NEXT > 0) {
            _log(NS, '# terminate MySQL (Sequence) ');
            const ID_NAME = CONF_ID_TYPE.substring(1);
            actions.push($MS.do_delete_id_seq(ID_NAME).then((_: any) => {
                _log(NS, '> delete-id-seq['+ID_NAME+'] res=', _);
                return {'result': true, 'name': 'MySQL:'+ID_NAME};
            }).catch((e: any) => {
                const msg = e.message||`${e}`;
                _err(NS, '> delete-id-seq error=', e);
                if (e.code === 'ER_BAD_TABLE_ERROR') return {'result': true, 'name': 'MySQL:'+ID_NAME, 'code':e.code};                //IGNORE! no-table.
                //if (e.code == 'NetworkingError') return false;
                // throw e;
                return {'result': false, 'name': 'MySQL:'+ID_NAME, 'error': msg};

            }));
        } else {
            _log(NS, '# ignored MySQL (Sequence) ');
        }

        //! terminate by index.
        if (CONF_ES_INDEX) {
            _log(NS, '# terminate ES (Index) ');
            actions.push($ES.do_delete_index_type(CONF_ES_INDEX,  1 ? null : CONF_ES_TYPE).then((_: any) => {
                _log(NS, '> delete-es-index res=', _);
                return {'result': true, 'name': 'elasticsearch:'+CONF_ES_INDEX};
            }).catch((e: any) => {
                const msg = e.message||e.reason||`${e}`;
                _err(NS, '> delete-es-index error=', e);
                //if (e.code == 'NetworkingError') return false;
                // throw e;
                return {'result': false, 'name': 'elasticsearch:'+CONF_ES_INDEX, 'error': msg};
            }));
        } else {
            _log(NS, '# ignored ES (Index) ');
        }

        //! execute each
        return Promise.all(actions).then((_: any) => {
            _log(NS, '>> results=', _);
            that.results = _;
            return that;
        });
    };

    /**
     * Test Each Sub-Modules
     *
     * @param that
     * @returns {Promise.<T>}
     */
    const my_test_sub_module = (that: any) => {
        _log(NS, `- my_test_sub_module()....`);

        that._test_count = 0;
        that._test_success = 0;
        that._test_failure = 0;
        const _update_count = (r: any) => {
            that._test_count ++;
            if(r) that._test_success++;
            else that._test_failure++;
        };

        let chain = Promise.resolve(that);
        if(0){      // Dynamo
            chain = chain.then(() => $DS.do_test_self())
                .then((_: any) => {
                    let result = [
                        true
                    ];
                    result.forEach(_update_count);
                    that.$dynamo = {_, result};
                    return that;
                })
        }

        if(1){      // Dynamo-Stream
            chain = chain.then((that: any) => $DS.do_read_stream(that))
                .then((_: any) => {
                    return _;
                })
        }

        if(0){      // Redis
            chain = chain.then(() => $RS.do_test_self())
                .then((_: any) => {
                    let result = [
                        true
                    ];
                    result.forEach(_update_count);
                    that.$redis = {_, result};
                    return that;
                })
        }

        if(0){      // ElasticSearch
            chain = chain.then(() => $ES.do_test_self())
                .then((_: any) => {
                    let result = [
                        true
                    ];
                    result.forEach(_update_count);
                    that.$elasticsearch = {_, result};
                    return that;
                })
        }

        if(0){      // MySQL
            chain = chain.then(() => $MS.do_test_self())
                .then((_: any) => {
                    let result = [
                        true
                    ];
                    result.forEach(_update_count);
                    that.$mysql = {_, result};
                    return that;
                })
        }

        //! eof.
        chain = chain.then((that: any) => {
            that._result_test_item_node = that._test_failure <= 0;
            if(!that._result_test_item_node)
                _err(NS,'#WARN! Test Failure Detected!!!');
            return that;
        });
        return chain;
    };

    /**
     * Node 관리의 기본적인 Basic CRUD 를 테스트한다.
     *
     * @param that
     * @returns {Promise.<T>}
     */
    const my_test_item_node = (that: any) => {
        _log(NS, `- my_test_item_node()....`);

        const id = 1000001;
        const $node: any = {name:'test-me'};
        const $node1: any = {name:'test-you', age:1};
        const $node2: any = {name:'test-them', age:2};
        const current_time = $U.N($U.current_time_ms()/1000)*1000;
        const current_time1 = $U.N(current_time/1000)*1000 + 1;
        const current_time2 = $U.N(current_time/1000)*1000 + 2;
        _log(NS, '> current_time=',current_time,current_time1,current_time2);

        that._test_count = 0;
        that._test_success = 0;
        that._test_failure = 0;
        const _update_count = (r: any) => {
            that._test_count ++;
            if(r) that._test_success++;
            else that._test_failure++;
        };

        let chain = Promise.resolve(that);
        if(1) {     // prepare node without id/node.
            chain = chain.then(() => thiz.do_prepare())
                .then((_: any) => {
                    let node = _._node;
                    let result = [
                        node[CONF_ID_NAME] > 0,
                        node.created_at === 0,
                        node.deleted_at !== 0,
                        node.updated_at === node.deleted_at,
                        node.name === undefined,
                    ];
                    result.forEach(_update_count);
                    that.$prepare = {_, result};
                    return that;
                })
        }

        if(1) {     // prepare node with id/node
            chain = chain.then(() => thiz.do_prepare(id, $node))
                .then((_: any) => {
                    let node = _._node;
                    let result = [
                        node[CONF_ID_NAME] === id,
                        node.created_at === 0,
                        node.deleted_at !== 0,
                        node.updated_at === node.deleted_at,
                        node.name === $node.name,
                    ];
                    result.forEach(_update_count);
                    that.$prepare1 = {_, result};
                    return that;
                })
        }

        if(1) {     // with $id object, current-time,
            let $id = {id:id, name:$node2.name, _current_time: current_time2};
            chain = chain.then(() => thiz.do_prepare($id))
                .then((_: any) => {
                    let node = _._node;
                    let result = [
                        node[CONF_ID_NAME] === id,
                        node.created_at === 0,
                        node.deleted_at === current_time2,
                        node.updated_at === current_time2,
                        node.name === $node2.name,
                    ];
                    result.forEach(_update_count);
                    that.$prepare2 = {_, result};
                    return that;
                })
        }

        if(1) {     // test create.
            let $id = {id:id, name:$node1.name, _current_time: current_time1};
            chain = chain.then(() => thiz.do_create($id))
                .then((_: any) => {
                    let node = _._node;
                    let result = [
                        node[CONF_ID_NAME] === id,
                        node.created_at === current_time1,
                        node.deleted_at === 0,
                        node.updated_at === current_time1,
                        node.name === $node1.name,
                    ];
                    result.forEach(_update_count);
                    that.$create = {_, result};
                    return that;
                })
        }

        if(1) {     // test update.
            // let $id = {id:id, name:$node2.name, _current_time: current_time2};
            $node2._current_time = current_time2;
            chain = chain.then(() => thiz.do_update(id, $node2))
                .then((_: any) => {
                    let node = _._node;
                    let result = [
                        node[CONF_ID_NAME] === id,
                        node.created_at !== current_time2,
                        node.deleted_at === 0,
                        node.updated_at === current_time2,
                        node.name === $node2.name,
                    ];
                    result.forEach(_update_count);
                    that.$update = {_, result};
                    return that;
                })
        }

        if(1) {     // test delete.
            chain = chain.then(() => thiz.do_delete(id, {_current_time:current_time2}))
                .then((_: any) => {
                    let node = _._node;
                    let result = [
                        node[CONF_ID_NAME] === id,
                        node.created_at !== current_time2,
                        node.deleted_at === current_time2,
                        node.updated_at === current_time2,
                    ];
                    result.forEach(_update_count);
                    that.$delete = {_, result};
                    return that;
                })
        }

        if(1) {     // test read (with projection).
            chain = chain.then(() => thiz.do_read(id, {"name":1}))
                .then((_: any) => {
                    let node = _._node;
                    let result = [
                        node[CONF_ID_NAME] === id,
                        node.created_at !== current_time2,
                        node.deleted_at === current_time2,
                        node.updated_at === current_time2,
                    ];
                    result.forEach(_update_count);
                    that.$read = {_, result};
                    return _;
                })
                //! delete only from Redis cache.
                .then($redis.do_delete_cache)
                .then(my_read_node)
                .then((_: any) => {
                    let node = _._node;
                    let result = [
                        node[CONF_ID_NAME] === id,
                    ];
                    result.forEach(_update_count);
                    that.$read1 = {_, result};
                    return that;
                })
        }

        //! eof.
        chain = chain.then((that: any) => {
            that._result_test_item_node = that._test_failure <= 0;
            if(!that._result_test_item_node)
                _err(NS,'#WARN! Test Failure Detected!!!');
            return that;
        });
        return chain;
    };

    const my_test_dummy = (that: any) => {

        if (1){     // hash test.
            let n1: any = {a:1,b:2,x:3};
            let n2: any = {x:3,a:1,b:2};
            let n3: any = {b:2,x:3,a:1};
            n1.name = 'hi';
            n2.name = 'hi';
            n3.name = 'hi';

            _log(NS, '# node1 =', $U.json(n1));
            _log(NS, '> node2 =', $U.json(n2));
            _log(NS, '> node3 =', $U.json(n3));                     // {"b":2,"x":3,"a":1,"name":"hi"}

            _log(NS, '# node1.sorted =', $U.json(n1, true));
            _log(NS, '> node2.sorted =', $U.json(n2, true));
            _log(NS, '> node3.sorted =', $U.json(n3, true));        // {"a":1,"b":2,"name":"hi","x":3}

            _log(NS, '# hash1 =', $U.hash(1));      // 873244444
            _log(NS, '> node1 =', $U.hash(n1));     // 2436625738
            _log(NS, '> node2 =', $U.hash(n2));     // 2436625738
            _log(NS, '> node3 =', $U.hash(n3));     // 2436625738
        }

        if (1){
            let node = {updated_at:234, name:'test hash'};
            return Promise.resolve(node)
                .then((_: any) => {
                    return $RS.do_create_item('H#', 1, _)
                }).then(() => {
                    return $RS.do_get_item('H#', 1).then((_: any) => {
                        _log(NS, '> read-back data=', _);
                        return _;
                    })
                }).then(() => {
                    return $redis.do_set_cache_footprint(1, node)
                }).then(() => {
                    return $redis.do_get_cache_updated(1).then((_: any) => {
                        _log(NS, '> updated-at value=', typeof _,":",_);
                        return _;
                    })
                }).then(() => {
                    return $redis.do_get_cache_hash(1).then((_: any) => {
                        _log(NS, '> hash-value value=', typeof _,":",_);
                        return _;
                    })
                })
        }
        return that;
    };

    const my_test_self = (that: any) => {
        _log(NS, `- my_test_self()....`);
        return Promise.resolve(that)
            // .then(my_test_sub_module)
            // .then(my_test_item_node)
            .then(my_test_dummy)
            .then(_=>_||that)
    };

    /** ****************************************************************************************************************
     *  Chained Functions Built Up.
     ** ****************************************************************************************************************/
    //! For Chained Object.
    thiz.do_prepare_chain = (id: any, $node: any, mode: any, ctx?: any) => prepare_chain(id, $node, mode, ctx);
    thiz.do_finish_chain = (that: any) => finish_chain(that);

    //! Basic Functions.
    thiz.do_prepare = (id: any, $node: any) =>
        prepare_chain(id, $node, 'prepare')
            .then(my_prepare_node_prepared)
            .then(my_save_node)
            .then(my_notify_node)
            .then(finish_chain);

    thiz.do_create = (id: any, $node: any) => {
        return prepare_chain(id, $node, 'create')
            .then(my_prepare_node_created)
            .catch((e: any) => {
                _err(NS, 'ERR! prepare_node_created =', e instanceof Error, e.message||e);
                //! WARN! IF NOT FOUND. THEN TRY TO CREATE
                const message = e && e.message || '';
                if (e instanceof Error && message.indexOf('404 NOT FOUND') >= 0){
                    _inf(NS, 'WARN! AUTO TRY TO PREPARE NODE. ID='+id);
                    return prepare_chain(id, $node, 'create')
                        .then((that: any) => {
                            const current_time = that._current_time;
                            that = _prepare_node(that);                // force to prepare node.
                            _log(NS, '>> prepared old-node=', $U.json(that._node));
                            // that[CONF_ID_INPUT] = that._id;         // make sure id input.
                            // node[CONF_ID_NAME] = that._id;          // make sure id field.
                            that._node = mark_node_created(that._node, current_time);
                            return that;
                        })
                }
                throw e;
            })
            .then(my_save_node)
            .then(my_notify_node)
            .then(finish_chain);
    }

    //! SAVE NODE DIRECTLY TO ES (ONLY FOR INTERNAL SYNC)
    thiz.do_saveES = (id: any, node: any) => {
        if (!id) return Promise.reject(new Error('id is required!'));
        if (!node) return Promise.reject(new Error('node is required!'));
        return prepare_chain(id, {}, 'save')
            .then(my_validate_properties)
            .then((_: any) => {
                _._node = node;                         // save node as origin.
                return _;
            })
            .then($elasticsearch.do_save_search)
            .then(finish_chain)
    }

    //! DIRECTLY CALL TO CLEAR DATA IN REDIS.
    thiz.do_cleanRedis = (id: any, node: any) => {
        if (!id) return Promise.reject(new Error('id is required!'));
        // if (!node) return Promise.reject(new Error('node is required!'));
        return prepare_chain(id, {}, 'clean')
            .then((_: any) => {
                _._node = node;                         // save node as origin.
                return _;
            })
            .then($redis.do_delete_cache)
            .then(finish_chain)
    }

    thiz.do_clone = (id: any, $node: any) =>
        prepare_chain(id, $node, 'clone')
            .then(my_prepare_node_cloned)
            .then(my_clone_node)
            .then(my_notify_node)
            .then(finish_chain);

    thiz.do_read = (id: any, $node: any) =>
        prepare_chain(id, $node, 'read')
            .then(_prepare_node)
            //! FIELDS 에 지정된 필드만 추출하여 전달. 없을경우 아예 읽지를 말자.
            .then((that: any) => that._params_count !== 0 && that._fields_count === 0 ? that : my_read_node(that))
            // .then(my_notify_node)
            .then(finish_chain)

    thiz.do_read_deep = (id: any, $node: any) =>
        prepare_chain(id, $node, 'read')
            .then(_prepare_node)
            //! FIELDS 에 지정된 필드만 추출하여 전달. 없을경우 아예 읽지를 말자.
            .then((that: any) => that._params_count !== 0 && that._fields_count === 0 ? that : my_read_node_deep(that))
            // .then(my_notify_node)
            .then(finish_chain)

    thiz.do_readX = (id: any, $node: any) =>
        prepare_chain(id, $node, 'read')
            .then(_prepare_node)
            //! FIELDS 에 지정된 필드만 추출하여 전달. 없을경우 아예 읽지를 말자.
            .then((that: any) => that._params_count !== 0 && that._fields_count === 0 ? that : my_read_node(that))
            // .then(my_notify_node)
            .then(finish_chain)
            .then(my_filter_read_decrypt)                    //NOTE - projection 된 필드를 복호화한다.

    thiz.do_update = (id: any, $node: any) =>
        prepare_chain(id, $node, 'update')
            .then(my_prepare_node_updated)
            //! FIELDS 에 지정된 필드만 추출하여 업데이트 실행함.
            .then((that: any) => that._fields_count === 0 ? that : my_update_node(that))
            .then(my_notify_node)
            .then(finish_chain);

    thiz.do_increment = (id: any, $node: any) =>
        prepare_chain(id, $node, 'increment')
            .then(my_prepare_node_updated)
            //! FIELDS 에 지정된 필드만 추출하여 업데이트 실행함.
            .then((that: any) => that._fields_count === 0 ? that : my_increment_node(that))
            .then(my_notify_node)
            .then(finish_chain);

    thiz.do_delete = (id: any, $node: any) =>
        prepare_chain(id, $node, 'delete')
            .then(my_prepare_node_deleted)
            .then(my_save_node)                     //WARN! - update_node 는 deleted_at 변경을 모른다.
            .then(my_notify_node)
            .then(finish_chain);

    thiz.do_destroy = (id: any, $node: any) =>
        prepare_chain(id, $node, 'destroy')
            .then(my_delete_node)
            .then(my_notify_node)
            .then(finish_chain);

    thiz.do_search = (id: any, $node: any) =>
        prepare_chain(id, $node, 'search')
            .then(my_search_node)
            .then(finish_chain);

    thiz.on_records = (id: any, $node: any) =>
        prepare_chain(id, $node, 'on_records')
            .then(my_event_records)
            .then(finish_chain);

    // thiz.do_notify = (id, $param) =>
    //     prepare_chain(id, $param, 'notify')
    //         .then(my_notify_trigger)
    //         .then(finish_chain);
    //
    // thiz.do_subscribe = (id, $param) =>
    //     prepare_chain(id, $param, 'notify_subscribe')
    //         .then(my_notify_subscribe)
    //         .then(finish_chain);


    //! Maintenance Functions.
    thiz.do_initialize = (id: any, $node: any) =>
        prepare_chain(id, $node, 'initialize')
            .then(my_initialize_all)
            .then(finish_chain);

    thiz.do_terminate = (id: any, $node: any) =>
        prepare_chain(id, $node, 'terminate')
            .then(my_terminate_all)
            .then(finish_chain);

    thiz.do_test_self = (id: any, $node: any) =>
        prepare_chain(id, $node, 'self-test')
            .then(my_test_self)
            .then(finish_chain);

    thiz.do_next_id = () =>
        my_prepare_id({_id:0})
            .then((that: any) => that._id)

    //! returns.
    return thiz;
}

export default buildModel;
