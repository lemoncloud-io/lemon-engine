/**
 * Lemon Engine Model Of Node (LEMON)
 * - Lemon Engine Model Implementation as common core module.
 *
 * ---------------------------
 * ## Environment
 *  - DynamoDB       : Main NoSQL Database storage w/ stream.
 *  - Redis          : Internal Quick Cache storage. (Optional)
 *  - ElasticSearch  : Search & Query Service instead of DynamoDB query.
 *  - SQS (Optional) : Queue task schedule (or buffering).
 *  - SNS (Optional) : Notification Service.
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
 * 					: 추가 사항! 기존 저장된 노드는 없고, 새로운 ID가 주어진 상태에서 create() 호출하면, 새로운 노드를 생성한다.
 * 					: _force_create = true 일 경우, 상태 무시하고 create로 변경함.
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
 *
 *
 * author: xeni <coolxeni@gmail.com> (coolxeni@gmail.com)
 * date : 2017-07-25
 *
 * Copyright (C) 2017 xeni - All Rights Reserved.
 */
module.exports = (function (_$, name, options) {
	"use strict";
	const NS_NAME = name || 'LEM';

	const $U = _$.U;                                // re-use global instance (utils).
	const $_ = _$._;                             	// re-use global instance (_ lodash).
	const $MS = _$.MS;                              // re-use global instance (mysql-service).
	const $DS = _$.DS;                              // re-use global instance (dynamo-service).
	const $RS = _$.RS;                              // re-use global instance (redis-service).
	const $ES = _$.ES;                              // re-use global instance (elasticsearch-service).

	if (!$U) throw new Error('$U is required!');
	if (!$_) throw new Error('$U is required!');
	if (!$MS) throw new Error('$MS is required!');
	if (!$DS) throw new Error('$DS is required!');
	if (!$RS) throw new Error('$RS is required!');
	if (!$ES) throw new Error('$ES is required!');

	//! load common(log) functions
	const _log = _$.log;
	const _inf = _$.inf;
	const _err = _$.err;

	//! NAMESPACE
	const NS = $U.NS(NS_NAME, "green");				 // NAMESPACE TO BE PRINTED.

	/** ****************************************************************************************************************
	 *  Public Common Interface Exported.
	 ** ****************************************************************************************************************/
	//! prepare instance.
	const thiz = options||{};
	const ERR_NOT_IMPLEMENTED = (id) => {throw new Error(`NOT_IMPLEMENTED - ${NS}:${JSON.stringify(id)}`)};

	//! public exported functions (INFO! bind final function at bottom of this)
	thiz.do_prepare     = ERR_NOT_IMPLEMENTED;          // prepare dummy $node with new id. (created_at := 0, deleted_at=now)
	thiz.do_create      = ERR_NOT_IMPLEMENTED;          // create $node with given id (created_at := now, updated_at := now, deleted_at=0).
	thiz.do_clone       = ERR_NOT_IMPLEMENTED;          // clone the current node. (parent, clones)
	thiz.do_update      = ERR_NOT_IMPLEMENTED;          // update $node by id. (updated_at := now)
	thiz.do_increment   = ERR_NOT_IMPLEMENTED;          // increment by count ex) stock = stock + 2.
	thiz.do_read        = ERR_NOT_IMPLEMENTED;          // read-back $node by id.
	thiz.do_delete      = ERR_NOT_IMPLEMENTED;          // mark deleted by id (deleted_at := now)
	thiz.do_destroy     = ERR_NOT_IMPLEMENTED;          // destroy $node by id (real deletion).
	thiz.do_search      = ERR_NOT_IMPLEMENTED;          // search items by query.

	//! critical functions.
	thiz.do_initialize  = ERR_NOT_IMPLEMENTED;           // initialize environment based on configuration.
	thiz.do_terminate   = ERR_NOT_IMPLEMENTED;           // terminate environment based on configuration.
	thiz.do_test_self   = ERR_NOT_IMPLEMENTED;           // execute self test self-test..

	//! events functions.
	thiz.on_records     = ERR_NOT_IMPLEMENTED;          // records events.

	//! notify functions.
	thiz.do_notify      = ERR_NOT_IMPLEMENTED;           // trigger notify event.
	thiz.do_subscribe   = ERR_NOT_IMPLEMENTED;           // subscribe notify event.

	//! register as service.
	if (!name.startsWith('_')) _$(name, thiz);


	/** ****************************************************************************************************************
	 *  Main Implementation.
	 ** ****************************************************************************************************************/
	const CONF_GET_VAL = (name, defval) => thiz[name] === undefined ? defval : thiz[name];
	const CONF_VERSION      = CONF_GET_VAL('VERSION', 1);           // initial version number(name 'V').
	const CONF_REVISION     = CONF_GET_VAL('REVISION', 1);          // initial revision number(name 'R').
	const CONF_VERSION_NAME = CONF_GET_VAL('VERSION_NAME', 'V');    // version name (Default 'V')       // if null, then no version.
	const CONF_REVISION_NAME= CONF_GET_VAL('REVISION_NAME', 'R');   // revision name (Default 'R')
	const CONF_ID_INPUT     = CONF_GET_VAL('ID_INPUT', 'id');       // default ID Name. (for input parameter)
	const CONF_ID_NAME      = CONF_GET_VAL('ID_NAME', 'id');        // ID must be Number/String Type value. (for DynamoDB Table)
	const CONF_ID_TYPE      = CONF_GET_VAL('ID_TYPE', 'test');      // type name of sequence for next-id.
	const CONF_ID_NEXT      = CONF_GET_VAL('ID_NEXT', 0);           // start number of sequence for next-id.
	const CONF_DYNA_TABLE   = CONF_GET_VAL('DYNA_TABLE', 'TestTable');// DynamoDB Target Table Name.
	const CONF_REDIS_PKEY   = CONF_GET_VAL('REDIS_PKEY', 'TPKEY');  // Redis search prefix-key name. (optional)
	const CONF_FIELDS       = CONF_GET_VAL('FIELDS', null);         // Fields to filter. ['id','owner','mid','parent','domain','name'];
	const CONF_DEFAULTS     = CONF_GET_VAL('DEFAULTS', null);       // Default set of fields (only effective in prepare)
	const CONF_CLONEABLE    = CONF_GET_VAL('CLONEABLE', false);     // Cloneable Setting. (it requires 'parent', 'cloned' fields).
	const CONF_CLONED_ID    = CONF_GET_VAL('CLONED_ID', 'cloned');       // default ID Name. (for input parameter)
	const CONF_PARENT_ID    = CONF_GET_VAL('PARENT_ID', 'parent');       // default ID Name. (for input parameter)
	const CONF_PARENT_IMUT  = CONF_GET_VAL('PARENT_IMUT', true);     // parent-id is imutable?
	
	//! CONF_ES : INDEX/TYPE required if to support search. master if FIELDS is null, or slave if FIELDS not empty.
	const CONF_ES_INDEX     = CONF_GET_VAL('ES_INDEX', 'test-v1');  // ElasticSearch Index Name. (optional)
	const CONF_ES_TYPE      = CONF_GET_VAL('ES_TYPE', 'test');      // ElasticSearch Type Name of this Table. (optional)
	const CONF_ES_FIELDS    = CONF_GET_VAL('ES_FIELDS', 0 ? null:['updated_at','name']);   // ElasticSearch Fields definition. (null 이면 master-record)
	const CONF_ES_MASTER	= CONF_GET_VAL('ES_MASTER', 0);			// ES is master role? (default true if CONF_ES_FIELDS is null). (요건 main 노드만 있고, 일부 필드만 ES에 넣을 경우)

	//! Notify Service
	const CONF_NS_NAME      = CONF_GET_VAL('NS_NAME', '');          // '' means no notification services.

	//! DynamoDB Value Marshaller.
	const DynamoDBValue = require('dynamodb-value');                // DynamoDB Data Converter.

	/////////////////////////
	//! Notification Service.
	const $NOT = require('./notify-service')(_$, '!'+CONF_NS_NAME, {NS_NAME:CONF_NS_NAME});
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
	const prepare_chain = (id, $node, mode, ctx) => {
		id = id||0;                                 // make sure Zero value if otherwise.
		mode = mode||'';                            // make sure string.
		// mode && _log(NS, `prepare_${mode}()... `);
		// _log(NS, '>> $node@1=', $node);

		//! determine object if 1st parameter is object.
		// $node = typeof id === 'object' ? id : $U.extend(
		// 	$node === undefined || (typeof $node === 'object' && !($node instanceof Promise))
		// 		? $node||{} : {params:$node}
		// 	, {'_id':id});
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
				return Promise.reject(NS+'method-stack full. size:'+that._method_stack);
			return $U.promise(that);
		}
		// _log(NS, '>> ID=', id);

		//! Check ID Type : String|Number.
		if (CONF_ID_TYPE.startsWith('#')){			// ID is not NUMBER
			id = that._id || that[CONF_ID_INPUT] || '';
		} else {									// ID must be Number.
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
			that = $_.reduce(that, (that, val, key) => {
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
	const finish_chain = (that) => {
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
			that = $_.reduce(node, (that, val, key) => {
				if (key === 'updated_at' && that[key] !== undefined){       // keep max-value.
					that[key] = that[key] > val ? that[key] : val;
				} else {
					that[key] = val;
				}
				return that;
			}, that);

		} else if (that._fields_count >= 0) {
			//! copy only the filtered fields.
			that = CONF_FIELDS ? CONF_FIELDS.reduce((that, field) => {
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
	const my_prepare_id = (that) => {
		const id = that._id;
		_log(NS, `- my_prepare_id(${CONF_ID_TYPE}, ${id})....`);
		if(CONF_ID_TYPE.startsWith('#')){
			// NOP			
		} else if(CONF_ID_TYPE && !id){
			// _log(NS, '> creating next-id by type:'+CONF_ID_TYPE);
			return $MS.do_get_next_id(CONF_ID_TYPE).then(id => {
				_log(NS, '> created next-id=', id);
				that._id = id;
				return that;
			})
		}
		_log(NS, '> prepared-id =', id);
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
	const _prepare_node = (that) => {
		if (!that._current_mode) throw new Error(NS + '_current_mode is required!');
		const MODE = that._current_mode;
		const DEFAULTS = CONF_DEFAULTS||{};

		let fields_count = 0;
		let node = that._node||{};
		if (!CONF_FIELDS){
			fields_count = -1;          // all fields
		} else if (MODE === 'prepare' || MODE === 'create' || MODE === 'clone') {
			node = CONF_FIELDS.reduce((node, field) => {
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
			node = CONF_FIELDS.reduce((node, field) => {
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
	const mark_node_prepared = (node, current_time) => {
		// if(!current_time) throw new Error(NS + 'current_time is required!');
		node.created_at = 0;
		node.updated_at = current_time;
		node.deleted_at = current_time;
		return node;
	};

	// Node State := Created
	const mark_node_created = (node, current_time) => {
		// if(!current_time) throw new Error(NS + 'current_time is required!');
		node.created_at = current_time;
		node.updated_at = current_time;
		node.deleted_at = 0;
		return node;
	};

	// Node State := Updated
	const mark_node_updated = (node, current_time) => {
		// if(!current_time) throw new Error(NS + 'current_time is required!');
		// node.created_at = 0;
		node.updated_at = current_time;
		// node.deleted_at = 0;
		return node;
	};

	// Node State := Deleted
	const mark_node_deleted = (node, current_time) => {
		// if(!current_time) throw new Error(NS + 'current_time is required!');
		// node.created_at = 0;
		node.updated_at = current_time;
		node.deleted_at = current_time;
		return node;
	};

	// 필요한 경우 ID 생성, 캐쉬된 노드 정보 읽어 옴.
	const my_prepare_node_prepared = (that) => {
		// if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
		if (!that._node) return Promise.reject(new Error(NS + '_node is required!'));
		if (!that._current_time) return Promise.reject(new Error(NS + '_current_time is required!'));

		const id = that._id;
		const node = that._node;              // node can be null if not loaded.
		const current_time = that._current_time;
		// _log(NS, '> prepared-id =', id, ', current-time =', current_time, ', node =', $U.json(node));

		//! if no id, then create new node-id.
		if (!id) {
			that = _prepare_node(that);
			return my_prepare_id(that).then(that => {
				let node = that._node||{};
				that[CONF_ID_INPUT] = that._id;       // make sure id input.
				node[CONF_ID_NAME] = that._id;        // make sure id field.
				that._node = mark_node_prepared(node, current_time);
				return that;
			})
		}

		//! read previous(old) node from dynamo.
		return my_read_node(that)
			.catch(e => {
				_err(NS, 'not found. err=', e);
				return that;
			})
			.then(that => {
				// _log(NS, '>> get-item-node old=', $U.json(that._node));
				// _log(NS, '>> get-item-node old.len=', $U.json(that._node).length);
				// _log(NS, '>> that =', that);
				that = _prepare_node(that);
				// _log(NS, '>> prepared old-node=', $U.json(that._node));

				//!VALIDATE [PREPARED] STATE.
				const node = that._node || {};
				if (that._force_create){
					_err(NS, 'WARN! _force_create is set!');
				} else if (!node.deleted_at){		// if not deleted.
					_err(NS, 'INVALID STATE FOR PREPARED. ID=',id ,', TIMES[CUD]=', [node.created_at, node.updated_at, node.deleted_at]);
					return Promise.reject(new Error(NS+'INVALID STATE.'));
				}

				that[CONF_ID_INPUT] = that._id;         // make sure id input.
				node[CONF_ID_NAME] = that._id;          // make sure id field.
				that._node = mark_node_prepared(that._node, current_time);
				return that;
			})
	};

	// 신규 노드 생성 (또는 기존 노드 overwrite) 준비.
	const my_prepare_node_created = (that) => {
		if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
		if (!that._node) return Promise.reject(new Error(NS + '_node is required!'));
		if (!that._current_time) return Promise.reject(new Error(NS + '_current_time is required!'));

		const id = that._id;
		const node = that._node;
		const current_time = that._current_time;
		_log(NS, '> prepared-id =', id, ', current-time =', current_time, ', node =', $U.json(node));

		//! read previous(old) node from dynamo.
		return my_read_node(that).then(that => {
			// _log(NS, '>> get-item-node old=', $U.json(that._node));
			that = _prepare_node(that);

			//!VALIDATE [CREATED] STATE.
			const node = that._node || {};
			if (that._force_create){
				_err(NS, 'WARN! _force_create is set!');
			} else if (!node.deleted_at){		// if not deleted.
				_err(NS, 'INVALID STATE FOR CREATED. ID=',id ,', TIMES[CUD]=', [node.created_at, node.updated_at, node.deleted_at]);
				return Promise.reject(new Error(NS+'INVALID STATE.'));
			}

			//!MARK [CREATED]
			that._node = mark_node_created(that._node, current_time);
			return that;
		})
	};

	// 복제용 노드 (또는 기존 노드 overwrite) 준비.
	const my_prepare_node_cloned = (that) => {
		if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
		if (!that._node) return Promise.reject(new Error(NS + '_node is required!'));
		if (!that._current_time) return Promise.reject(new Error(NS + '_current_time is required!'));

		const id = that._id;
		const node = that._node;
		const current_time = that._current_time;
		_log(NS, '> cloned-id =', id, ', current-time =', current_time, ', node =', $U.json(node));

		//! read previous(old) node from dynamo.
		return my_read_node(that).then(that => {
			_log(NS, '>> get-item-node old=', $U.json(that._node));
			that = _prepare_node(that);
			that._node = mark_node_created(that._node, current_time);           // as created for cloning.
			return that;
		})
	};

	// 노드 업데이트 준비
	const my_prepare_node_updated = (that) => {
		if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
		if (!that._node) return Promise.reject(new Error(NS + '_node is required!'));
		if (!that._current_time) return Promise.reject(new Error(NS + '_current_time is required!'));

		const id = that._id;
		const node = that._node;
		const current_time = that._current_time;
		// _log(NS, '> updated-id =', id, ', current-time =', current_time, ', node =', $U.json(node));

		//! check if available fields.
		that = _prepare_node(that);
		//! ignore if no need to update due to FIELDS config.
		if (that._fields_count === 0) {
			// _log(NS, `! my_update_node() no need to update... fields_count=`+that._fields_count);
			return that;
		}

		//! if no node, read previous(old) node from dynamo.
		return my_read_node(that).then(that => {
			// _log(NS, '>> get-item-node old=', $U.json(that._node));
			that._node = mark_node_updated(that._node, current_time);
			return that;
		})
	};

	// 삭제된 노드 준비.
	const my_prepare_node_deleted = (that) => {
		if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
		if (!that._node) return Promise.reject(new Error(NS + '_node is required!'));
		if (!that._current_time) return Promise.reject(new Error(NS + '_current_time is required!'));

		const id = that._id;
		const node = that._node;
		const current_time = that._current_time;
		_log(NS, '> deleted-id =', id, ', current-time =', current_time, ', node =', $U.json(node));

		//! if no node, read previous(old) node from dynamo.
		return my_read_node(that).then(that => {
			_log(NS, '>> get-item-node old=', $U.json(that._node));
			that = _prepare_node(that);
			that._node = mark_node_deleted(that._node, current_time);
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
		my_read_node : that =>
		{
			if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));         // new Error() for stack-trace.
			const id = that._id;
			_log(NS, `- dynamo:my_read_node (${id})....`);
			return $DS.do_get_item(CONF_DYNA_TABLE, {[CONF_ID_NAME]:id}).then(node => {
				_log(NS, `> dynamo:get-item-node(${id}) res=`, $U.json(node));
				that._node = node;
				return that;
			})
		},

		//! update
		my_update_node : that =>
		{
			if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
			if (!that._node) return Promise.reject(new Error(NS + '_node is required!'));
			// if (!that._current_time) return Promise.reject(new Error(NS + '_current_time is required!'));

			const id = that._id;
			const node = that._node;
			// const current_time = that._current_time;

			// _log(NS, `- dynamo:my_update_node(${id})....`);
			// _log(NS, '> node-id =', id, ', current-time =', current_time);

			//! copy attributes into node.
			let node2 = {};
			let updated_count = 0;
			// const IGNORE_FIELDS = [CONF_ID_INPUT,CONF_ID_NAME,'created_at','updated_at','deleted_at',CONF_PARENT_ID,CONF_CLONED_ID];
			for(let n in that){
				if(!that.hasOwnProperty(n)) continue;
				n = ''+n;
				if (!n) continue;
				if (n.startsWith('_')) continue;
				if (n.startsWith('$')) continue;
				if (IGNORE_FIELDS.indexOf(n) >= 0) continue;
				if (CONF_FIELDS && CONF_FIELDS.indexOf(n) < 0) continue;        // Filtering Fields
				//TODO:IMPROVE - 변경된 것만 저장하면, 좀 더 개선될듯..
				if(n){
					node2[n] = that[n];
					node[n] = that[n];
					updated_count++;
				}
			}
			node2.updated_at = node.updated_at;         // copy time field.
			// _log(NS, '> dynamo:updated-node =', node2);

			//! save back into main.
			that._updated_node = null;
			that._updated_count = updated_count;

			//! if no update, then just returns. (
			if (!updated_count) {
				if (CONF_FIELDS) return that;           // ignore reject.
				return Promise.reject(new Error(NS + 'nothing to update'));
			}

			//! Update Revision Number. R := R + 1
			if (node[CONF_REVISION_NAME] !== undefined) node[CONF_REVISION_NAME] = $U.N(node[CONF_REVISION_NAME],0) + 1;

			//! then, save into DynamoDB (update Revision Number. R := R + 1)
			return $DS.do_update_item(CONF_DYNA_TABLE, {[CONF_ID_NAME]: id}, node2, CONF_REVISION_NAME ? {[CONF_REVISION_NAME]:1} : null)
				.then(_ => {
					that._updated_node = node2;          // SAVE INTO _updated.
					_log(NS, `> dynamo:updated-item(${id}) res=`, $U.json(_));
					return that;
			})
		},

		//! save
		my_save_node : that =>
		{
			if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
			if (!that._node) return Promise.reject(new Error(NS + '_node is required!'));
			// if (!that._current_time) return Promise.reject(new Error(NS + '_current_time is required!'));

			const id = that._id;
			const node = that._node;
			const MODE = that._current_mode||'';
			const CURRENT_TIME = that._current_time;

			_log(NS, `- dynamo:my_save_node(${id})....`);
			_log(NS, '> dynamo:node-id =', id, ', current-time =', CURRENT_TIME, ', node =', $U.json(node));

			//! override attributes into node.
			// const IGNORE_FIELDS = [CONF_ID_INPUT,CONF_ID_NAME,'created_at','updated_at','deleted_at',CONF_PARENT_ID,CONF_CLONED_ID];
			if (MODE !== 'prepare')         //WARN! in prepare mode, node was already populated with default value. (so do not override)
			{
				for (let n in that){
					if(!that.hasOwnProperty(n)) continue;
					n = ''+n;
					if (!n) continue;
					if (n.startsWith('_')) continue;
					if (n.startsWith('$')) continue;
					if (IGNORE_FIELDS.indexOf(n) >= 0) continue;
					if (CONF_FIELDS && CONF_FIELDS.indexOf(n) < 0) continue;        // Filtering Fields
					node[n] = that[n];
				}
			}

			//! Update Revision Number. R := R + 1
			if (node[CONF_REVISION_NAME] !== undefined) node[CONF_REVISION_NAME] = $U.N(node[CONF_REVISION_NAME],0) + 1;

			//! then, save into DynamoDB
			return $DS.do_create_item(CONF_DYNA_TABLE, {[CONF_ID_NAME]: id}, node).then(_ => {
				_log(NS, `> dynamo:saved-item(${id}) res=`, _);
				return that;
			})
		},

		//! increment
		my_increment_node : that =>
		{
			if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
			if (!that._node) return Promise.reject(new Error(NS + '_node is required!'));
			// if (!that._current_time) return Promise.reject(new Error(NS + '_current_time is required!'));

			const id = that._id;
			const node = that._node;
			// const current_time = that._current_time;

			// _log(NS, `- dynamo:my_update_node(${id})....`);
			// _log(NS, '> node-id =', id, ', current-time =', current_time);

			//! copy attributes into node.
			let node2 = {};
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
			_log(NS, '> dynamo:increment-node =', node2);

			//! save back into main.
			that._updated_node = null;
			that._updated_count = updated_count;

			//! if no update, then just returns. (
			if (!updated_count) {
				if (CONF_FIELDS) return that;           // ignore reject.
				return Promise.reject(new Error(NS + 'nothing to update'));
			}

			//! Update Revision Number. R := R + 1
			if (node[CONF_REVISION_NAME] !== undefined) node[CONF_REVISION_NAME]= $U.N(node[CONF_REVISION_NAME], 0) + 1;

			//! then, save into DynamoDB (update Revision Number. R := R + 1)
			return $DS.do_increment_item(CONF_DYNA_TABLE, {[CONF_ID_NAME]: id}, node2, CONF_REVISION_NAME ? {[CONF_REVISION_NAME]:1} : null)
				.then(_ => {
					_log(NS, `> dynamo:updated-item(${id}) res=`, $U.json(_));
					that._updated_node = node2;          // SAVE INTO _updated.
				return that;
			})
		},

		//! delete
		my_delete_node : that =>
		{
			if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));

			const id = that._id;

			// _log(NS, `- dynamo: my_delete_node(${id})....`);
			// _log(NS, '> deleted-id =', id);

			//! do delete command.
			return $DS.do_delete_item(CONF_DYNA_TABLE, {[CONF_ID_NAME]:id}).then(node => {
				_log(NS, `> dynamo:deleted-item-node(${id}) res=`, $U.json(node));
				that._node = node||{};
				return that;
			})
		}
	};


	/**
	 * Redis
	 *
	 * //TODO - Redis 에서 오브젝트 단위로 읽고 쓸 수 있도록 하기...
	 */
	const $redis = {
		my_read_node : that =>
		{
			if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
			//! Redis Key 가 없다면, read 실퍠로 넘겨줘야함.
			if (!CONF_REDIS_PKEY) return Promise.reject(that);

			const id = that._id;

			// _log(NS, `- redis:my_read_node(${id})....`);
			return $RS.do_get_item(CONF_REDIS_PKEY, id).then(node => {
				// _log(NS, `> redis:get-item(${CONF_REDIS_PKEY}, ${id}) res =`, $U.json(node));
				// _log(NS, `> redis:get-item(${CONF_REDIS_PKEY}, ${id}) res.len =`, node ? $U.json(node).length : null);
				if(!node) return Promise.reject(that);                                  //WARN! reject that if not found.
				that._node = node;
				return that;
			}).catch(err => {
				//! 읽은 node가 없을 경우에도 발생할 수 있으므로, Error인 경우에만 처리한다.
				if (err instanceof Error) {
					_err(NS, `! redis:get-item(${CONF_REDIS_PKEY}, ${id}) err =`, err);
					that._error = err;
				}
				throw that;
			})
		},

		my_save_node : that =>
		{
			if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
			if (!that._node) return Promise.reject(new Error(NS + '_node is required!'));
			if (!CONF_REDIS_PKEY) return Promise.resolve(that);

			const id = that._id;
			const node = that._node;

			// _log(NS, `- redis:my_save_node(${id})....`);
			let chain = $redis.my_set_node_footprint(id, node);
			chain = chain.then(() => $RS.do_create_item(CONF_REDIS_PKEY, id, node)).then(rs => {
				_log(NS, `> redis:save-item-node(${id}) res=`, $U.json(rs));
				// if(!node) return Promise.reject(that);                                  // reject if not found.
				return that;
			});
			return chain;
		},

		my_update_node : that =>
		{
			if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
			if (!that._node) return Promise.reject(new Error(NS + '_node is required!'));
			if (!CONF_REDIS_PKEY) return Promise.resolve(that);

			const id = that._id;
			const node = that._node;

			// _log(NS, `- redis:my_update_node(${id})....`);
			let chain = $redis.my_set_node_footprint(id, node);
			//WARN! IT IS NOT SUPPORTED YET!!!
			chain = chain.then(() => $RS.do_update_item(CONF_REDIS_PKEY, id, node)).then(rs => {
				_log(NS, `> redis:update-item-node(${id}) res=`, $U.json(rs));
				// if(!node) return Promise.reject(that);                                  // reject if not found.
				return that;
			});
			return chain;
		},

		my_delete_node : that =>
		{
			if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
			if (!CONF_REDIS_PKEY) return Promise.resolve(that);

			const id = that._id;

			// _log(NS, `- redis:my_delete_node(${id})....`);
			return $RS.do_delete_item(CONF_REDIS_PKEY, id).then(rs => {
				_log(NS, `> redis:delete-item-node(${id}) res=`, $U.json(rs));
				// if(!node) return Promise.reject(that);
				return that;
			})
		},

		//! set foot-print information from node.
		my_set_node_footprint : (id, node) =>
		{
			if (!id) return Promise.reject(new Error(NS + 'id is required!'));
			if (!CONF_REDIS_PKEY) return Promise.resolve(0);
			node = node || {};

			const updated_at = $U.N(node.updated_at, 0);
			const hash_value = $U.hash(node);

			// _log(NS, `- redis:my_set_node_footprint(${id})....`,'params=', [updated_at, hash_value]);
			return $RS.do_create_item([CONF_REDIS_PKEY+'/UPDATED',CONF_REDIS_PKEY+'/HASH'], id
				, [updated_at, hash_value]).then(data => {
				_log(NS, `> redis:set node-footprint(${id}) res=`, $U.json(data));
				return data;
			})
		},

		//! get updated-at by id
		my_get_updated_at : (id) =>
		{
			if (!id) return Promise.reject(new Error(NS + 'id is required!'));
			if (!CONF_REDIS_PKEY) return Promise.resolve(-1);

			// _log(NS, `- redis:my_get_updated_at(${id})....`);
			return $RS.do_get_item(CONF_REDIS_PKEY+'/UPDATED', id).then(data => {
				// _log(NS, `> redis:get-updated-at(${id}) res=`, data);
				return data;
			})
		},
		//! get hash-value by id
		my_get_hash_value : (id) =>
		{
			if (!id) return Promise.reject(new Error(NS + 'id is required!'));
			if (!CONF_REDIS_PKEY) return Promise.resolve(-1);

			// _log(NS, `- redis:my_get_hash_value(${id})....`);
			return $RS.do_get_item(CONF_REDIS_PKEY+'/HASH', id).then(data => {
				// _log(NS, `> redis:get-hash-value(${id}) res=`, data);
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
		my_read_node : that => {
			if (!that._id) return Promise.reject(new Error(NS + 'elasticsearch:_id is required!'));
			if (!CONF_ES_INDEX || !CONF_ES_TYPE) return that;

			const id = that._id;

			// _log(NS, `- elasticsearch:my_read_node(${id})....`);
			return $ES.do_get_item(CONF_ES_INDEX, CONF_ES_TYPE, id, CONF_ES_FIELDS).then(node => {
				_log(NS, `> elasticsearch:get-item(${id}) =`, $U.json(node));
				if(!node) return Promise.reject(that);                                  // reject if not found.
				if (CONF_ES_FIELDS){
					that._node = $U.extend(that._node||{}, node);
				} else {
					that._node = node;
				}
				return that;
			});
		},
		//! save
		my_save_node : that => {
			if (!that._id) return Promise.reject(new Error(NS + 'elasticsearch:_id is required!'));
			if (!that._node) return Promise.reject(new Error(NS + 'elasticsearch:_node is required!'));
			if (!CONF_ES_INDEX || !CONF_ES_TYPE) return that;

			const id = that._id;
			const node = that._node;
			// _log(NS,'> elasticsearch:node=', $U.json(node));

			//! copy only fields, and update node.
			if (CONF_ES_FIELDS){
				let node2 = $_.reduce(CONF_ES_FIELDS, (obj,v) => {
					if (node[v] !== undefined) obj[v] = node[v];
					return obj;
				}, {});

				if (!Object.keys(node2).length) {
					_log(NS, `! elasticsearch:WARN! nothing to update (${id})....`);
					return that;
				}

				//! make sure updated_at copied.
				if (node.created_at !== undefined) node2.created_at = node.created_at;
				if (node.updated_at !== undefined) node2.updated_at = node.updated_at;
				if (node.deleted_at !== undefined) node2.deleted_at = node.deleted_at;

				// _log(NS, `- elasticsearch:my_save_node2(${id}).... node2=`, $U.json(node2));
				if (CONF_ES_MASTER){
					return $ES.do_create_item(CONF_ES_INDEX, CONF_ES_TYPE, id, node2).then(_ => {
						_log(NS, `! elasticsearch:saved-item(${id}) res=`, $U.json(_));
						return that;
					});		
				} else {
					return $ES.do_update_item(CONF_ES_INDEX, CONF_ES_TYPE, id, node2).then(_ => {
						_log(NS, `! elasticsearch:updated-item(${id}) res=`, $U.json(_));
						return that;
					})
				}
			}

			// _log(NS, `- elasticsearch:my_save_node(${id})....`);
			return $ES.do_create_item(CONF_ES_INDEX, CONF_ES_TYPE, id, node).then(_ => {
				_log(NS, `! elasticsearch:saved-item2(${id}) res=`, $U.json(_));
				return that;
			});
		},

		//! update
		my_update_node : that => {
			if (!that._id) return Promise.reject(new Error(NS + 'elasticsearch:_id is required!'));
			if (!that._updated_node) return Promise.reject(new Error(NS + 'elasticsearch:_updated_node is required!'));
			if (!CONF_ES_INDEX || !CONF_ES_TYPE) return that;

			const id = that._id;
			const node = that._updated_node;

			//! copy only fields, and update node.
			if (CONF_ES_FIELDS){
				let node2 = $_.reduce(CONF_ES_FIELDS, (obj,val) => {
					obj[val] = node[val];
					return obj;
				}, {});

				if (!Object.keys(node2).length) {
					_log(NS, `! elasticsearch:WARN! nothing to update (${id})....`);
					return that;
				}

				//! make sure updated_at copied.
				if (node.created_at !== undefined) node2.created_at = node.created_at;
				if (node.updated_at !== undefined) node2.updated_at = node.updated_at;
				if (node.deleted_at !== undefined) node2.deleted_at = node.deleted_at;

				// _log(NS, `- elasticsearch:my_update_node2(${id})....`);
				return $ES.do_update_item(CONF_ES_INDEX, CONF_ES_TYPE, id, node2).then(_ => {
					_log(NS, `! elasticsearch:updated-item(${id}) res=`, $U.json(_));
					return that;
				})
			}

			// _log(NS, `- elasticsearch:my_update_node(${id})....`);
			return $ES.do_update_item(CONF_ES_INDEX, CONF_ES_TYPE, id, node).then(_ => {
				_log(NS, `! elasticsearch:updated-item(${id}) res=`, $U.json(_));
				return that;
			});
		},
		//! delete
		my_delete_node : that => {
			if (!that._id) return Promise.reject(new Error(NS + 'elasticsearch:_id is required!'));
			if (!CONF_ES_INDEX || !CONF_ES_TYPE) return that;

			const id = that._id;

			if (CONF_ES_FIELDS) {
				_log(NS, `! elasticsearch:WARN! ignore delete (${id})....`);
				return that;
			}

			// _log(NS, `- elasticsearch:my_delete_node(${id})....`);
			return $ES.do_delete_item(CONF_ES_INDEX, CONF_ES_TYPE, id).then(_ => {
				_log(NS, `! elasticsearch:deleted-item(${id}) res=`, $U.json(_));
				return that;
			})
		},
		//! search
		my_search_node : that => {
			// if (!that._id) return Promise.reject(new Error(NS + 'elasticsearch:_id is required!'));
			if (!CONF_ES_INDEX || !CONF_ES_TYPE) return that;
			// const id = that._id;
			_log(NS, `- elasticsearch:do_search_item()....`);

			if (CONF_ES_FIELDS && !CONF_ES_MASTER) {
				_log(NS, `! elasticsearch:WARN! ignore search ()....`);
				return that;
			}

			//! Rewrite Query...
			const param = {$page:0, $limit:0};			// page start from '0'
			param.$page = $U.N(that.page||0);
			param.$limit = $U.N(that.ipp||10);
			// param.$exist = '!deleted_at';			// NOT INCLUDE DELETED.
			param.deleted_at = '0';
			if (that.$source) param.$source = that.$source;		// copy source.

			//! custom query.
			if (that.Q) param.$Q = that.Q;
			if (that.A) param.$A = that.A;				// Aggregation (simply to count terms)
			if (that.O) param.$O = that.O;				// OrderBy (default asc by name)

			//! add default-sort if no search query.
			param.$O = param.$O || (CONF_ID_TYPE.startsWith('#') ? 'id.keyword' : 'id');
			
			//build query parameters.
			if (CONF_ES_FIELDS){
				CONF_ES_FIELDS.forEach(field => {
					if (that[field] !== undefined) param[field] = that[field];						// EQUAL filter.
					if (that['!'+field] !== undefined) param['!'+field] = that['!'+field];			// NOT filter.
					if (that['#'+field] !== undefined) param['#'+field] = that['#'+field];			// PROJECTION filter.
				})	
			}

			//! 검색 파라미터로 검색을 시작한다.
			return $ES.do_search_item(CONF_ES_INDEX, CONF_ES_TYPE, param).then(_ => {
				// _log(NS, `! elasticsearch:searched-item() res=`, $U.json(_));
				// _log(NS, `! elasticsearch:searched-item() res=`, $U.json(_));

				//! move hits.hits[] to _hits.
				let hits = _ && _.hits || {};

				//! rebuild.
				const $lst = hits.hits || [];
				const $res = hits;

				//! copy result...
				that.list = $lst.map(_ => $U.extend({'_score':_._score}, _._source));
				that.total = $U.N($res.total||0);
				that.page = param.$page;			// page number
				that.ipp = param.$limit;			// page count per paging.
				that.took = _.took||0;				// time took in msec.

				if (_.aggregations !== undefined) {
					that.aggregations = _.aggregations;
				}

				//! returns that.
				return that;
			}).catch(e => {
				_err(NS, '!ERR =', e);
				throw e;
			})
		},
	};

	/** ****************************************************************************************************************
	 *  Main Handler.
	 ** ****************************************************************************************************************/
	//! Read Node - read from cache first, or dynamo.
	const my_read_node = (that) => {
		if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
		const id = that._id;
		// _log(NS, `- my_read_node (${id})...., that=`, $U.json(that));
		return Promise.resolve(that)
			.then($redis.my_read_node)                  // STEP 1. Read Node from Redis (의도적으로 error 발생)
			//- Dynamo 에서 읽어 왔다면, Redis 에 없는 경우이므로, 이때는 Redis 에 저장해 준다.
			.catch(that => {
				return $dynamo.my_read_node(that)              // STEP 2. If failed, Read Node from DynamoDB.
					.then(that => {
						// report error if not found.
						const node = that._node||{};
						if (node[CONF_ID_NAME] === undefined){
							return Promise.reject(new Error(NS + '404 NOT FOUND. '+CONF_DYNA_TABLE+'.id:'+(that._id||'')));
						}
						return that;
					})
					.then($redis.my_save_node)          // STEP 2-2. save back to Redis also.
				}
			)
		// .then($elasticsearch.my_read_node)          // OPTIONAL - Read Node from Elasticsearch.
		// .then(that => {
		// 	_log(NS, '>> read-node res=', $U.json(that._node));
		// 	return that;
		// });
	};

	//! Save Node - Overwrite All Node.
	const my_save_node = (that) => {
		if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
		if (!that._node) return Promise.reject(new Error(NS + '_node is required!'));
		
		const ID = that._id;
		// _log(NS, `- my_save_node (${ID})....`);
		return Promise.resolve(that)
			.then($dynamo.my_save_node)
			.then($redis.my_save_node)
			.then($elasticsearch.my_save_node)
			.then(that => {
				// _log(NS, '>> saved-node res=', $U.json(that._node));
				return that;
			});
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
	const my_clone_node = (that) => {
		if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
		if (!that._node) return Promise.reject(new Error(NS + '_node is required!'));
		if (!that._current_time) return Promise.reject(new Error(NS + '_current_time is required!'));

		//! default.
		const id = that._id;

		_log(NS, `- my_clone_node (${id})....`);
		// _log(NS, `> clone_node (${id}). that =`, $U.json(that));
		return Promise.resolve(that)
			//! copy the current-node with new id.
			.then(that => {
				// if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
				//! if not cloneable, then clone-id is required.
				if (!CONF_CLONEABLE) {
					// if (!that._clone_id) return Promise.reject(new Error(NS + '_clone_id is required!'));
					return that;
				}

				const ID = that._id;
				//! determine parent/cloned id field.
				const PARENT_ID = that[CONF_PARENT_ID] !== undefined ? $U.N(that[CONF_PARENT_ID], 0) : ID;      // override
				const CLONED_ID = ID;

				//! prepare new cloning-id.
				return my_prepare_id({_id:0}).then(that2 => {
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
			.then(that => {
				if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
				if (!that._node) return Promise.reject(new Error(NS + '_node is required!'));
				if (!that._clone_id) return Promise.reject(new Error(NS + '_clone_id is required!'));

				//! now override id with clone-id.
				const ID = that._id;            // original ID.
				that._id = that._clone_id;      // override ID with clone-id.

				// that._node = mark_node_created(that._node, current_time);
				//!INFO! - 클론을 할 경우, 모든 필드가 옮겨 가며, 일부 FIELDS 에 정의되어 있지 않는 경우도 있음.
				//!INFO! - 하여, that & node 에 동시에 필드 정의가 있을 경우, 이를 복제해 준다.
				$_.reduce(that, (node, val, key) => {
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
				return my_save_node(that).then(()=>{
					//! WARN!. _id must be restored as origin !!!!!
					that._id = ID;
					return that;
				});
			})
			.then(that => {
				// _log(NS, '>> FIELDS = ', $U.json(CONF_FIELDS));
				_log(NS, '>> cloned-node['+that._id+' -> '+that._clone_id+'] res=', $U.json(that._node));
				return that;
			});
	};

	//! Update Node - Update ONLY the updated field.
	const my_update_node = (that) => {
		if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
		const id = that._id;
		_log(NS, `- my_update_node (${id})....`);

		//! ignore if no need to update due to FIELDS config.
		if (that._fields_count === 0) {
			_log(NS, `! my_update_node() no need to update... fields_count=`+that._fields_count);
			return that;
		}

		return Promise.resolve(that)
			.then($dynamo.my_update_node)
			//INFO! - 현재로서는 Redis 에 변경된 필드만 저장 안됨.
			//INFO! - 캐시 기반으로 업데이트 전체 내용 저장하고, 이후 Stream 처리에서 최종 내용 다시 확인.
			// .then($redis.my_update_node)
			// .then($elasticsearch.my_update_node)
			// .then($redis.my_save_node)
			// .then($elasticsearch.my_save_node)
			//INFO! - save only if there is node updated.
			.then(that => that._updated_node ? $redis.my_save_node(that) : that)
			.then(that => that._updated_node ? $elasticsearch.my_save_node(that) : that)
			.then(that => {
				_log(NS, '>> updated-node res=', $U.json(that._updated_node));
				return that;
			});
	};

	//! Increment Node - Update ONLY the updated field.
	const my_increment_node = (that) => {
		if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
		const id = that._id;
		_log(NS, `- my_increment_node (${id})....`);

		//! ignore if no need to increment due to FIELDS config.
		if (that._fields_count === 0) {
			_log(NS, `! my_increment_node() no need to increment... fields_count=`+that._fields_count);
			return that;
		}

		return Promise.resolve(that)
			.then($dynamo.my_increment_node)
			//INFO! - 현재로서는 Redis 에 변경된 필드만 저장 안됨.
			//INFO! - 캐시 기반으로 업데이트 전체 내용 저장하고, 이후 Stream 처리에서 최종 내용 다시 확인.
			// .then($redis.my_update_node)
			// .then($elasticsearch.my_update_node)
			// .then($redis.my_save_node)
			// .then($elasticsearch.my_save_node)
			//INFO! - save only if there is node updated.
			.then(that => that._updated_node ? $redis.my_save_node(that) : that)
			.then(that => that._updated_node ? $elasticsearch.my_save_node(that) : that)
			.then(that => {
				_log(NS, '>> increment-node res=', $U.json(that._updated_node));
				return that;
			});
	};

	//! Delete Node - Delete.
	const my_delete_node = (that) => {
		if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
		const id = that._id;
		_log(NS, `- my_delete_node (${id})....`);
		return Promise.resolve(that)
			.then($dynamo.my_delete_node)                   // STEP 1. Delete Node from DynamoDB by node-id.
			.then($redis.my_delete_node)                    // STEP 2. Delete Node from Redis.
			.then($elasticsearch.my_delete_node)            // STEP 3. Delete Node from ES.
			.then(that => {
				_log(NS, '>> deleted-node res=', $U.json(that._node));
				return that;
			});
	};

	//! search node..
	const my_search_node = (that) => {
		// if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
		// const id = that._id;
		_log(NS, `- my_search_node ()....`);
		// _log(NS, '> that =', that);
		return Promise.resolve(that)
			.then($elasticsearch.my_search_node)            // STEP 3. Search Node from ES.
			.then(that => {
				// _log(NS, '>> search-node res=', $U.json(that._node));
				return that;
			});
	};

	//! notify event of node.
	const my_notify_node = (that) => {
		if (!that) return that;
		if (!that._id) return Promise.reject(new Error(NS + '_id is required!'));
		const id = that._id;
		const mode = that._current_mode;
		// _log(NS, `- my_notify_node (${id}, ${mode})....`);

		return Promise.resolve(that)
			.then(that => {
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
					return my_notify_event(EID, 1 ? that : that._node).then(_ => {
						// _log(NS, `! notified-node (${id}, ${mode}) res=`, _);
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
	const my_event_records = (that) => {
		if (!that.records) return Promise.reject(new Error(NS + 'records is required!'));
		const records = that.records.slice(0);          // copy array.

		_log(NS, `- my_event_records().... records.len=`, records.length);
		if (!records.length) return that;

		//! array promised.
		const fx_promise_array = (arr, fx) => {
			let chain = $U.promise(arr.shift());
			chain = arr.reduce((chain, item) => {
				return chain.then(() => fx(item));
			}, chain.then(item => fx(item)));
			return chain;
		};

		//! execute processing records one by one.
		return fx_promise_array(records, my_process_record)
			.catch(e => {
				_err(NS, 'error ignored! =', e);
				return that;
			})
			.then(() => that);
	};

	//! process record.
	const my_process_record = ($record) => {
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
	
			const keyRecord = $record.dynamodb.Keys ? DynamoDBValue.toJavascript($record.dynamodb.Keys) : {};
			const newRecord = $record.dynamodb.NewImage ? DynamoDBValue.toJavascript($record.dynamodb.NewImage) : null;
			const oldRecord = $record.dynamodb.OldImage ? DynamoDBValue.toJavascript($record.dynamodb.OldImage) : null;
	
			const id = keyRecord[CONF_ID_NAME];
			// keyRecord && _log(NS,`> ${EVENT_NAME} - ${tableName}.keyRecord[${id}]=`, $U.json(keyRecord));
			// oldRecord && _log(NS,`> ${EVENT_NAME} - ${tableName}.oldRecord[${id}]=`, $U.json(oldRecord));
			// newRecord && _log(NS,`> ${EVENT_NAME} - ${tableName}.newRecord[${id}]=`, $U.json(newRecord));
	
			//! 이제 변경된 데이터를 추적해서, 이후 처리 지원. (update 는 호출만되어도 이벤트가 발생하게 됨)
			const diff = EVENT_NAME === 'MODIFY' ? $U.diff(oldRecord, newRecord) : null;
			const updated_at = $U.N(newRecord && newRecord.updated_at || 0);
			const prev = diff ? $_.reduce(diff, (node, key) => {node[key] = oldRecord[key]; return node}, {}) : null;
			const that = {_id:id, _node:newRecord, _updated_at:updated_at, _diff:diff, _prev:prev};           // use updated_at for
			chain = Promise.resolve(that);
			diff && _log(NS,`>> ${tableName}.different[${id}]=`, $U.json(diff));
	
			// _log(NS,`>> Record(${tableName}) that=`, that);
	
			//! decode event.
			switch(EVENT_NAME){
				case "INSERT":          // only newRecord.
				case "MODIFY":          // both records.
					chain = chain.then(that => {
						const ID = that._id;
						return $redis.my_get_updated_at(ID).then(updated_at => {
							_err(NS, `>> ${tableName}.updated_at[${ID}] res=`, updated_at, ' <- ', that._updated_at
								,(that._updated_at !== updated_at ? '*' : ''));
							//! check if latest node is present.
							if (!updated_at || that._updated_at >= updated_at)
							{
								//_log(NS,'! INFO! node was updated!!!');
								const hashValue = $U.hash(newRecord);
								return $redis.my_get_hash_value(ID)
									.then(hash_value => {
										// _log(NS,'>> old hash-value =', hash_value);
										if(hash_value && hash_value === hashValue){
											_log(NS,'! WARN! ignored due to hash-value matching =', hash_value);
											return that;
										}
	
										_log(NS,'! INFO! node was updated. hash :=', hashValue,'<-',hash_value);
										//! otherwise, save node back.
										return $redis.my_save_node(that)
											.then($elasticsearch.my_save_node);
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
					chain = chain.then($redis.my_delete_node);
					chain = chain.then($elasticsearch.my_delete_node);
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
			.then((that) => {
				const MAP = {"INSERT":"create", "MODIFY":"update", "REMOVE":"delete", "EVENT":'event'};
				const mode = MAP[EVENT_NAME];
				const is_notifiable = !!mode;
				that._current_mode = mode;

				//! fire notify-event and wait.
				if (is_notifiable)
				{
					const EID = CONF_NS_NAME+':record'+':'+mode;
					_log(NS, '>>> notify event-id:', EID, ', notifiable=', is_notifiable);
					return my_notify_event(EID, 1 ? that : that._node).then(_ => {
						// _log(NS, `! notified-node (${id}, ${mode}) res=`, _);
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
	const my_notify_event = (id, that) => {
		return $NOT.do_notify(id, that);
	}

	// //! notify handler mapping
	// thiz.$notify = {};
	//
	// //! quick check if subscribers exist.
	// const has_subscriber = (id) => {
	// 	//! for each action.
	// 	const actions = thiz.$notify[id];
	// 	return actions && actions.length > 0;
	// }
	//
	// //! notify 를 발생시킨다.
	// const my_notify_event = (type, data, trace_id, notifier) => {
	// 	if (!type) return Promise.reject(new Error(NS + 'notify:type is required!'));
	// 	const ID = NS_NAME+':'+type;
	// 	if (!has_subscriber(ID)) return Promise.resolve(false);
	//
	// 	//! prepare notify object.
	// 	let that = {};
	// 	that._id = ID;
	// 	that.data = data;
	// 	that._trace_id = trace_id;
	// 	that._notifier = notifier;
	// 	return Promise.resolve(that).then(my_notify_trigger);
	// }

	// //! Promised notify-trigger.
	// const my_notify_trigger = (that) => {
	// 	if (!that._id) return Promise.reject(new Error(NS + 'notify:_id is required!'));
	// 	// if (!that.params) return Promise.reject(new Error(NS + 'params is required!'));
	// 	const id = ''+that._id;
	// 	_log(NS, `- my_notify_trigger(${id}).... that=`, $U.json(that));
	//
	// 	if(!id.startsWith(NS_NAME+':')){
	// 		_log(NS, '! WARN - ignored due to id='+id+' by NS='+NS_NAME);
	// 		return that;
	// 	}
	//
	// 	//! for each action.
	// 	const actions = thiz.$notify[id];
	// 	if (actions){
	// 		return Promise.all(actions.map(action => action instanceof Promise ? action : action(that)));
	// 	}
	//
	// 	return that;
	// };

	// //! Bubbled Subscriber to Notify.
	// const my_notify_subscribe = (that) => {
	// 	if (!that._id) return Promise.reject(new Error(NS + 'notify:_id is required!'));
	// 	if (!that.params) return Promise.reject(new Error(NS + 'notify:params is required!'));
	// 	let id = ''+that._id;
	// 	let params = that.params;
	// 	_log(NS, `- my_notify_subscribe(${id}).... params=`, typeof params);
	//
	// 	//! If starts with ':', then auto-complete notify-id.
	// 	if(id.startsWith(':')){
	// 		id = NS_NAME + ':' + CONF_DYNA_TABLE + id;
	// 	}
	//
	// 	//! Check Name-Space
	// 	if(!id.startsWith(NS_NAME+':')){
	// 		_log(NS, '! WARN - ignored due to id='+id+' by NS='+NS_NAME);
	// 		return that;
	// 	}
	// 	_log(NS, '! INFO - register subscriber by id ='+id);
	//
	// 	//! inline function.
	// 	let handler = null;
	// 	if (typeof params === 'function'){
	// 		//! it must be promised handler.
	// 		handler = (that) => {
	// 			return new Promise((resolve,reject) => {
	// 				try{
	// 					resolve(params(that));
	// 				}catch(e){
	// 					reject(e);
	// 				}
	// 			});
	// 		}
	// 	} else if (typeof params === 'object' && params instanceof Promise){
	// 		handler = params;
	// 	} else {
	// 		return Promise.reject(new Error(NS + 'invalid params type:'+(typeof params)));
	// 	}
	//
	// 	//! register into list.
	// 	if (handler){
	// 		//! check if all modes.
	// 		if (!id.endsWith(':*')){
	// 			if (!thiz.$notify[id]) thiz.$notify[id] = [];
	// 			thiz.$notify[id].push(handler);
	// 			_log(NS, `! notify-subscribe(${id}) count=`, thiz.$notify[id].length);
	// 		} else {
	// 			const MODES = ['create','update','delete'];
	// 			const id2 = id.substring(0, id.length-1);
	// 			MODES.forEach(mode => {
	// 				let id = id2 + mode;
	// 				if (!thiz.$notify[id]) thiz.$notify[id] = [];
	// 				thiz.$notify[id].push(handler);
	// 				_log(NS, `! notify-subscribe(${id}) count=`, thiz.$notify[id].length);
	// 			})
	// 		}
	// 	}
	//
	// 	return that;
	// };

	/** ****************************************************************************************************************
	 *  Management Functions.
	 ** ****************************************************************************************************************/
	/**
	 * 리소스(테이블 생성/인덱스 생성등) 초기화 시킨다.
	 *
	 * @param that
	 */
	const my_initialize_all = (that) => {
		let actions = [];

		//! Dynamo
		if (CONF_DYNA_TABLE) {
			const ID_TYPE = CONF_ID_TYPE.startsWith('#') ? 'S' : 'N';			// String or Number.
			actions.push(Promise.resolve('DynamoDb')
				.then(_ => {
					_log(NS, '# initialize ', _);
					return $DS.do_create_table(CONF_DYNA_TABLE, CONF_ID_NAME, ID_TYPE).then(_ => {
						// _log(NS, '> create-table res=', _);
						return _.TableDescription.TableName === CONF_DYNA_TABLE;
					})
				}).catch(e => {
					// _err(NS, '> create-table error=', e);
					if (e.code === 'ResourceInUseException') return false;            //IGNORE! duplicated table.
					//if (e.code == 'NetworkingError') return false;
					throw e;
				})
			);
		} else {
			_log(NS, 'DS: WARN! ignored configuration. DYNA_TABLE=', CONF_DYNA_TABLE);
		}

		//! MySQL for Sequence
		if (CONF_ID_TYPE && !CONF_ID_TYPE.startsWith('#')) {
			actions.push(Promise.resolve('MySQL')
				.then(_ => {
					_log(NS, '# initialize MySQL (Sequence) ');
					return $MS.do_create_id_seq(CONF_ID_TYPE, CONF_ID_NEXT).then(_ => {
						_log(NS, '> create-id-seq res=', _);
						return true;
					})
			}).catch(e => {
				// _err(NS, '> create-id-seq error=', e);
				if (e.code === 'ER_TABLE_EXISTS_ERROR') return false;            //IGNORE! duplicated sequence-table.
				//if (e.code == 'NetworkingError') return false;
				throw e;
			}));
		} else {
			_log(NS, 'MS: WARN! ignored configuration. ID_TYPE=', CONF_ID_TYPE);
		}

		//! ElasticSearch for Initial Type.
		if (CONF_ES_INDEX && CONF_ES_TYPE && CONF_ES_FIELDS) {

			//TODO - Use Dynamic Field Template!!!..
			//! see:https://www.elastic.co/guide/en/elasticsearch/reference/current/dynamic-templates.html
			const ES_SETTINGS = {
				"mappings" : {
					"_default_": {
						"_all": {"enabled": true},
						"dynamic_templates": [{
							"string_fields": {
								"match": "*_multi",
								"match_mapping_type": "string",
								"mapping": {
									"type": "multi_field",
									"fields": {
										"{name}": {
											"type": "string",  "index": "analyzed", "omit_norms": true, "index_options": "docs"
										},
										"{name}.raw": {"type": "string", "index": "not_analyzed", "ignore_above": 256}
									}
								}
							}
						}],
						"properties": {
							"@version": {"type": "string", "index": "not_analyzed"},
							// "geoip": {
							// 	"type": "object",
							// 	"dynamic": true,
							// 	"path": "full",
							// 	"properties": {
							// 		"location": {"type": "geo_point"}
							// 	}
							// },
							"title":    { "type": "text"  },
							"name":     { "type": "text"  },
							// "stock":    { "type": "integer" },
							"created_at":  {
								"type":   "date",
								"format": "strict_date_optional_time||epoch_millis"
							},
						}
					}
				}
				// 	"item": {
				// 		"properties": {
				// 			"title":    { "type": "text"  },
				// 			"name":     { "type": "text"  },
				// 			"age":      { "type": "integer" },
				// 			"created_at":  {
				// 				"type":   "date",
				// 				"format": "strict_date_optional_time||epoch_millis"
				// 			},
				// 			"updated_at":  {
				// 				"type":   "date",
				// 				"format": "strict_date_optional_time||epoch_millis"
				// 			},
				// 			"deleted_at":  {
				// 				"type":   "date",
				// 				"format": "strict_date_optional_time||epoch_millis"
				// 			}
				// 		}
				// 	},
				// 	"blogpost": {
				// 		"_all":       { "enabled": false  },
				// 		"properties": {
				// 			"body":     { "type": "text"  },
				// 		}
				// 	}
				// }
			}

			//! add actions
			actions.push(Promise.resolve('ElasticSearch')
				.then(_ => {
					_log(NS, '# initialize ElasticSearch (Type) ', CONF_ES_TYPE);
					return $ES.do_create_index_type(CONF_ES_INDEX, CONF_ES_TYPE, ES_SETTINGS).then(_ => {
						_log(NS, '> create-es-index res=', _);
						return true;
					})
			}).catch(e => {
				_err(NS, '> create-es-index error=', e);
				if (e.type === 'index_already_exists_exception') return true;    //IGNORE! duplicated sequence-table.
				throw e;
			}).then(_ => {
				//TODO - initialize document index setting (or use template)
				// CONF_FIELDS;
				return _;
			}));
		} else {
			_log(NS, 'MS: WARN! ignored configuration. ES_TYPE=', CONF_ES_TYPE);
		}

		//! execute all
		return Promise.all(actions).then(_ => {
			_log(NS, '>> results=', _);
			that._result = _;
			return that;
		})
	};


	/**
	 * 리소스를 종료시킨다.
	 *
	 * @param that
	 */
	const my_terminate_all = (that) => {
		let actions = [];
		if (CONF_DYNA_TABLE){
			_log(NS, '# terminate DynamoDB');
			actions.push($DS.do_delete_table(CONF_DYNA_TABLE).then(_ => {
				// _log(NS, '> delete-table res=', _);
				return _.TableDescription.TableName === CONF_DYNA_TABLE;
			}).catch(e => {
				// _err(NS, '> create-table error=', e);
				if (e.code === 'ResourceNotFoundException') return true;            //IGNORE! destroyed table.
				//if (e.code == 'NetworkingError') return false;
				throw e;
			}));
		}

		if (CONF_ID_TYPE && !CONF_ID_TYPE.startsWith('#')) {
			_log(NS, '# terminate MySQL (Sequence) ');
			actions.push($MS.do_delete_id_seq(CONF_ID_TYPE).then(_ => {
				_log(NS, '> delete-id-seq res=', _);
				return true;
			}).catch(e => {
				// _err(NS, '> create-id-seq error=', e);
				if (e.code === 'ER_BAD_TABLE_ERROR') return true;                //IGNORE! no-table.
				//if (e.code == 'NetworkingError') return false;
				throw e;
			}));
		} else {
			_log(NS, '# ignored MySQL (Sequence) ');
		}

		if (CONF_ES_INDEX && CONF_ES_TYPE) {
			_log(NS, '# terminate ES (Index) ');
			actions.push($ES.do_delete_index_type(CONF_ES_INDEX,  1 ? null : CONF_ES_TYPE).then(_ => {
				_log(NS, '> delete-es-index res=', _);
				return true;
			}).catch(e => {
				_err(NS, '> create-es-index error=', e);
				//if (e.code == 'NetworkingError') return false;
				throw e;
			}));
		} else {
			_log(NS, '# ignored ES (Index) ');
		}

		return Promise.all(actions).then(_ => {
			_log(NS, '>> results=', _);
			that._result = _;
			return that;
		});
	};

	/**
	 * Test Each Sub-Modules
	 *
	 * @param that
	 * @returns {Promise.<T>}
	 */
	const my_test_sub_module = that => {
		_log(NS, `- my_test_sub_module()....`);

		that._test_count = 0;
		that._test_success = 0;
		that._test_failure = 0;
		const _update_count = r => {
			that._test_count ++;
			if(r) that._test_success++;
			else that._test_failure++;
		};

		let chain = Promise.resolve(that);
		if(0){      // Dynamo
			chain = chain.then(() => $DS.do_test_self())
				.then(_ => {
					let result = [
						true
					];
					result.forEach(_update_count);
					that.$dynamo = {_, result};
					return that;
				})
		}

		if(1){      // Dynamo-Stream
			chain = chain.then((that) => $DS.do_read_stream(that))
				.then(_ => {
					return _;
				})
		}

		if(0){      // Redis
			chain = chain.then(() => $RS.do_test_self())
				.then(_ => {
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
				.then(_ => {
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
				.then(_ => {
					let result = [
						true
					];
					result.forEach(_update_count);
					that.$mysql = {_, result};
					return that;
				})
		}

		//! eof.
		chain = chain.then((that) => {
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
	const my_test_item_node = that => {
		_log(NS, `- my_test_item_node()....`);

		const id = 1000001;
		const $node = {name:'test-me'};
		const $node1 = {name:'test-you', age:1};
		const $node2 = {name:'test-them', age:2};
		const current_time = $U.N($U.current_time_ms()/1000)*1000;
		const current_time1 = $U.N(current_time/1000)*1000 + 1;
		const current_time2 = $U.N(current_time/1000)*1000 + 2;
		_log(NS, '> current_time=',current_time,current_time1,current_time2);

		that._test_count = 0;
		that._test_success = 0;
		that._test_failure = 0;
		const _update_count = r => {
			that._test_count ++;
			if(r) that._test_success++;
			else that._test_failure++;
		};

		let chain = Promise.resolve(that);
		if(1) {     // prepare node without id/node.
			chain = chain.then(() => thiz.do_prepare())
				.then(_ => {
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
				.then(_ => {
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
				.then(_ => {
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
				.then(_ => {
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
				.then(_ => {
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
				.then(_ => {
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
				.then(_ => {
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
				.then($redis.my_delete_node)
				.then(my_read_node)
				.then(_ => {
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
		chain = chain.then((that) => {
			that._result_test_item_node = that._test_failure <= 0;
			if(!that._result_test_item_node)
				_err(NS,'#WARN! Test Failure Detected!!!');
			return that;
		});
		return chain;
	};

	const my_test_dummy = that => {

		if (1){     // hash test.
			let n1 = {a:1,b:2,x:3};
			let n2 = {x:3,a:1,b:2};
			let n3 = {b:2,x:3,a:1};
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
				.then(_ => {
					return $RS.do_create_item('H#', 1, _)
				}).then(() => {
					return $RS.do_get_item('H#', 1).then(_ => {
						_log(NS, '> read-back data=', _);
						return _;
					})
				}).then(() => {
					return $redis.my_set_node_footprint(1, node)
				}).then(() => {
					return $redis.my_get_updated_at(1).then(_ => {
						_log(NS, '> updated-at value=', typeof _,":",_);
						return _;
					})
				}).then(() => {
					return $redis.my_get_hash_value(1).then(_ => {
						_log(NS, '> hash-value value=', typeof _,":",_);
						return _;
					})
				})
		}
		return that;
	};

	const my_test_self = (that) => {
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
	thiz.do_prepare_chain = (id, $node, mode, ctx) => prepare_chain(id, $node, mode, ctx);
	thiz.do_finish_chain = (id, $node, mode, ctx) => finish_chain(id, $node, mode, ctx);

	//! Basic Functions.
	thiz.do_prepare = (id, $node) =>
		prepare_chain(id, $node, 'prepare')
			.then(my_prepare_node_prepared)
			.then(my_save_node)
			.then(my_notify_node)
			.then(finish_chain);

	thiz.do_create = (id, $node) =>
		prepare_chain(id, $node, 'create')
			.then(my_prepare_node_created)
			.catch(e => {
				_log(NS, 'ERR! prepare_node_created =', typeof e, e.message||e);
				//! WARN! IF NOT FOUND. THEN TRY TO CREATE
				const message = e && e.message || '';
				if (e instanceof Error && message.indexOf('404 NOT FOUND') >= 0){
					_log(NS, 'WARN! AUTO TRY TO PREPARE NODE');
					return prepare_chain(id, $node, 'create')
							.then(that => {
								const current_time = that._current_time;
								that = _prepare_node(that);				// force to prepare node.
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

	thiz.do_clone = (id, $node) =>
		prepare_chain(id, $node, 'clone')
			.then(my_prepare_node_cloned)
			.then(my_clone_node)
			.then(my_notify_node)
			.then(finish_chain);

	thiz.do_read = (id, $node) =>
		prepare_chain(id, $node, 'read')
			.then(_prepare_node)
			//! FIELDS 에 지정된 필드만 추출하여 전달. 없을경우 아예 읽지를 말자.
			.then(that => that._params_count !== 0 && that._fields_count === 0 ? that : my_read_node(that))
			.then(my_notify_node)
			.then(finish_chain);

	thiz.do_update = (id, $node) =>
		prepare_chain(id, $node, 'update')
			.then(my_prepare_node_updated)
			//! FIELDS 에 지정된 필드만 추출하여 업데이트 실행함.
			.then(that => that._fields_count === 0 ? that : my_update_node(that))
			.then(my_notify_node)
			.then(finish_chain);

	thiz.do_increment = (id, $node) =>
		prepare_chain(id, $node, 'increment')
			.then(my_prepare_node_updated)
			//! FIELDS 에 지정된 필드만 추출하여 업데이트 실행함.
			.then(that => that._fields_count === 0 ? that : my_increment_node(that))
			.then(my_notify_node)
			.then(finish_chain);

	thiz.do_delete = (id, $node) =>
		prepare_chain(id, $node, 'delete')
			.then(my_prepare_node_deleted)
			.then(my_save_node)                     //WARN! - update_node 는 deleted_at 변경을 모른다.
			.then(my_notify_node)
			.then(finish_chain);

	thiz.do_destroy = (id, $node) =>
		prepare_chain(id, $node, 'destroy')
			.then(my_delete_node)
			.then(my_notify_node)
			.then(finish_chain);

	thiz.do_search = (id, $node) =>
		prepare_chain(id, $node, 'search')
			.then(my_search_node)
			.then(finish_chain);

	thiz.on_records = (id, $node) =>
		prepare_chain(id, $node, 'on_records')
			.then(my_event_records)
			.then(finish_chain);

	// thiz.do_notify = (id, $param) =>
	// 	prepare_chain(id, $param, 'notify')
	// 		.then(my_notify_trigger)
	// 		.then(finish_chain);
	//
	// thiz.do_subscribe = (id, $param) =>
	// 	prepare_chain(id, $param, 'notify_subscribe')
	// 		.then(my_notify_subscribe)
	// 		.then(finish_chain);


	//! Maintenance Functions.
	thiz.do_initialize = (id, $node) =>
		prepare_chain(id, $node, 'initialize')
			.then(my_initialize_all)
			.then(finish_chain);

	thiz.do_terminate = (id, $node) =>
		prepare_chain(id, $node, 'terminate')
			.then(my_terminate_all)
			.then(finish_chain);

	thiz.do_test_self = (id, $node) =>
		prepare_chain(id, $node, 'self-test')
			.then(my_test_self)
			.then(finish_chain);


	//! returns.
	return thiz;
});