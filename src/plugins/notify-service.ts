/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable prettier/prettier */
/**
 * Notify Service Exports
 * - General Service for Notify Event Trigger/Subscription.
 *
 * ## 요구 사항
 *  1. Internal/External 방식의 이벤트를 발생시킬 수 있음.
 *  2. Notify 구조체는 트리 방식으로 조합 가능하다.
 *  3. Parent/Child 구조로, 1개의 대표 child 와 다수의 child 를 가질 수 있다.
 *  4. Core 테이블은 대표 child 로 역할을 한다.
 *  5. do_notify(), do_subscribe() 를 공통 지원해야함.
 *  6. do_subscribe()는 절대로, 비동기 방식이 아닌 '동기화' 호출을 유지해야함 (초기화시 필요해보임).
 *
 *
 * ## Notify ID 형식 (예: this -> IIS -> ICS+IMS )
 *  - :record:*         # 호출 되는 모듈이 대상. => IIS:record:*
 *  - ICS:record:*      # 자식이 ICS 가 나올때까지 들어간다..
 *
 *
 * ## Notify Bubble Up
 *  - 자식에서 Notify 가 발생하면, 이를 수신한 부모는 상위로 올릴지 결정.
 *  - 대표 Child (Core 테이블) 에서 발생한 것을 위로 올릴 수 있음.
 *  - 일반 Child 는 그냥 무시된다. (또는 직접 연결하던가)
 *
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
import { EnginePluggable, EnginePluginBuilder, GeneralOptions, GeneralFuntion } from '../common/types';
import httpProxy, { HttpProxy } from './http-proxy';

export interface NotifyService extends EnginePluggable {
    // [key: string]: GeneralFuntion;
    do_notify: GeneralFuntion;
    do_subscribe: GeneralFuntion;
}

const maker: EnginePluginBuilder<NotifyService> = (_$, name, options) => {
    name = name || 'NF';

    const $U = _$.U;                                // re-use global instance (utils).
    const $_ = _$._;                             	// re-use global instance (_ lodash).
    if (!$U) throw new Error('$U is required!');
    if (!$_) throw new Error('$_ is required!');

    //! load common(log) functions
    const _log = _$.log;
    const _inf = _$.inf;
    const _err = _$.err;

    const NS = $U.NS(name, "magenta");		        // NAMESPACE TO BE PRINTED.

    /** ****************************************************************************************************************
	 *  Public Common Interface Exported.
	 ** ****************************************************************************************************************/
    //! prepare instance.
    // const thiz: GeneralOptions = options||{};
    const conf = typeof options == 'object' ? options : {};
    const thiz = new class implements NotifyService {
        public $notify: {[key: string]: any};
        public name = () => `notify-proxy:${name}`;
        public do_notify: GeneralFuntion;
        public do_subscribe: GeneralFuntion;
    }
    // const thiz: NotifyService = dummy as NotifyService;
    const ERR_NOT_IMPLEMENTED = (id: any) => {throw new Error(`NOT_IMPLEMENTED - ${NS}:${JSON.stringify(id)}`)};

    //! notify handler mapping
    thiz.$notify = thiz.$notify || {};
    //! notify functions.
    thiz.do_notify      = ERR_NOT_IMPLEMENTED;           // trigger notify event.
    //! WARN! - DO NOT USE PROMISE BECAUSE IT MUST BE READY BEFORE FUNCTION CALL.
    thiz.do_subscribe   = ERR_NOT_IMPLEMENTED;           // subscribe notify event.

    //! register as service.
    if (!name.startsWith('!') && !name.startsWith('_')) _$(name, thiz);

    /** ****************************************************************************************************************
	 *  Main Implementation.
	 ** ****************************************************************************************************************/
    const CONF_GET_VAL = (name: string, defval?: any) => conf[name] === undefined ? defval : conf[name];
    const CONF_NS_NAME      = CONF_GET_VAL('NS_NAME'    , '');          // Target Notification Namespace. ('' means no service)
    const CONF_MASTER       = CONF_GET_VAL('MASTER'     , null);        // Master Child Notifier.
    const CONF_CHILDS       = CONF_GET_VAL('CHILDS'     , []);          // Slave Child Notifier.
    const RECORD_MODES      = ['create','update','delete'];                  // possible mode definition.


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
    //! quick check if subscribers exist.
    const has_subscriber = (id: any) => {
        //! for each action.
        const actions = thiz.$notify[id];
        return actions && actions.length > 0;
    }

    //! notify 를 발생시킨다.
    const my_notify = (type: any, data: any, trace_id: any, notifier: any) => {
        if (!type) return Promise.reject(new Error(NS + 'notify:type is required!'));
        const ID = CONF_NS_NAME+':'+type;
        if (!has_subscriber(ID)) return Promise.resolve(false);

        //! prepare notify object.
        let that: any = {};
        that._id = ID;
        that.data = data;
        that._trace_id = trace_id;
        that._notifier = notifier;
        return Promise.resolve(that).then(my_notify_trigger);
    }

    //! Promised notify-trigger.
    const my_notify_trigger = (that: any) => {
        if (!CONF_NS_NAME) return Promise.resolve(that);
        if (!that._id) return Promise.reject(new Error(NS + 'notify:_id is required!'));
        // if (!that.params) return Promise.reject(new Error(NS + 'params is required!'));
        const id = ''+that._id;
        // _log(NS, `- my_notify_trigger(${id}).... that=`, $U.json(that));
        _log(NS, `- my_notify_trigger(${id})....`);

        if(!id.startsWith(CONF_NS_NAME+':')){
            _log(NS, '! WARN - ignored due to id='+id+' by NS='+CONF_NS_NAME);
            return that;
        }

        //! for each action.
        const actions = thiz.$notify[id];
        // _log(NS, '> actions.len=', (actions && actions.length || 0))
        if (actions){
            return Promise.all(actions.map((action: any, i: any) => {
                // _log(NS,'>> action['+i+'] :', typeof actions, 'Promise?', action instanceof Promise);
                // let ret = action instanceof Promise ? action : action(that);
                // _log(NS,'>> action['+i+'].ret :', typeof ret, 'Promise?', ret instanceof Promise);
                try {
                    // _log(NS,'>> action['+i+'] :', action);
                    let ret = action.handle ? action.handle(that) : action.promise ? action.promise : null;
                    // _log(NS,'>> action['+i+'].ret :', typeof ret, 'Promise?', ret instanceof Promise);
                    return ret;
                } catch(e) {
                    _err(NS,'>> action['+i+'] :', e);
                    return e;
                }
            }))
                .then(() => {
                    _log(NS, '! finished call subscriptions!!! count='+actions.length);
                    return that;
                })
                .catch(e => {
                    _err(NS, 'actions.error=', e);
                    throw e;
                });
        }

        // _log(NS, '! WARN - ignored due to no subscription. id='+id);
        return that;
    };

    //! Bubbled Subscriber to Notify.
    const my_notify_subscribe = (that: any) => {
        if (!CONF_NS_NAME) return Promise.resolve(that);
        if (!that._id) return Promise.reject(new Error(NS + 'notify:_id is required!'));
        if (!that.params) return Promise.reject(new Error(NS + 'notify:params is required!'));
        let id = ''+that._id;
        let params = that.params;
        _log(NS, `- my_notify_subscribe(${id}).... params=`, typeof params);

        //! If starts with ':', then auto-complete with self notify-id.
        if(id.startsWith(':'))  {
            id = CONF_NS_NAME + id;
            //! make sure id value.
            that._id = id;
        }

        //! Check Name-Space
        if(!id.startsWith(CONF_NS_NAME+':')){
            //! check if there are childs.
            if (!CONF_CHILDS || !CONF_CHILDS.length){
                _log(NS,'! ignored subscribe due to NS-NAME:'+CONF_NS_NAME);
                return that;
            }

            //! bubble down to childs.
            _log(NS, '> bubble down for target notifier!!! id=', id);
            return Promise.all(CONF_CHILDS.map((child: any) => child.do_subscribe(that)))
                .then(() => that);
        }

        //! register subscription.
        // _log(NS, '> INFO! - register subscriber by id ='+id);

        //! inline function.
        let handler: any = null;
        if (typeof params === 'function'){
            //! it must be promised handler.
            handler = (that: any) => {
                return new Promise((resolve,reject) => {
                    try{
                        resolve(params(that));
                    }catch(e){
                        reject(e);
                    }
                });
            }
        } else if (typeof params === 'object' && params instanceof Promise){
            handler = params;
        } else {
            return Promise.reject(new Error(NS + 'invalid params type:'+(typeof params)));
        }

        //! register into list.
        if (handler){
            //! check if all modes.
            if (!id.endsWith(':*')){
                if (!thiz.$notify[id]) thiz.$notify[id] = [];
                thiz.$notify[id].push(handler);
                // _log(NS, `! notify-subscribe(${id}) count=`, thiz.$notify[id].length);
            } else {
                const id2 = id.substring(0, id.length-1);
                RECORD_MODES.forEach(mode => {
                    let id = id2 + mode;
                    if (!thiz.$notify[id]) thiz.$notify[id] = [];
                    thiz.$notify[id].push(handler);
                    // _log(NS, `> notify-subscribe(${id}) count=`, thiz.$notify[id].length);
                })
                // _log(NS, `! notify-subscribe(${id}) ... modes=`, RECORD_MODES.join('/'));
            }
        }

        return that;
    };

    /**
	 * Bubbled Subscriber to Notify. (!WARN! - Synchronized Function)
	 *
	 * 꼭! 동기화 방식으로 지원해야함. 그래야 InBody 초기화 함수에서 초기화할때 문제가 없을듯...
	 * 다만, 리턴값은 Promise()를 해도 문제가 없을 듯...
	 *
	 * @param id
	 * @param $node
	 * @returns {*}
	 */
    const my_notify_subscribe_sync = ($id: any, $node: any) => {
        //! determine object if 1st parameter is object.
        $node = typeof $id === 'object' ? $id : $U.extend(
            $node === undefined || (typeof $node === 'object' && !($node instanceof Promise))
                ? $node || {} : {params: $node}
            , {'_id': $id});

        //! prepare object.
        let that = $node;                           // re-use $node as main object.
        if (!CONF_NS_NAME) return Promise.resolve(that);
        if (!that._id) return Promise.reject(new Error(NS + 'notify:_id is required!'));
        if (!that.params) return Promise.reject(new Error(NS + 'notify:params is required!'));

        //! main body.
        let id = ''+that._id;
        let params = that.params;
        // _log(NS, `- my_notify_subscribe_sync(${id}).... params=`, typeof params);

        //! If starts with ':', then auto-complete with self notify-id.
        if(id.startsWith(':'))  {
            id = CONF_NS_NAME + id;
            //! make sure id value.
            that._id = id;
        }

        //! Check Name-Space
        if(!id.startsWith(CONF_NS_NAME+':')){
            //! check if there are childs.
            if (!CONF_CHILDS || !CONF_CHILDS.length){
                _log(NS,'! ignored subscribe due to NS-NAME:'+CONF_NS_NAME);
                return Promise.resolve(that);
            }

            //! bubble down to childs.
            _log(NS, '> bubble down for target notifier!!! id=', id);
            // return Promise.all(CONF_CHILDS.map(child => child.do_subscribe(that)))
            // 	.then(() => that);
            let actions = CONF_CHILDS.map((child: any) => child.do_subscribe(that));
            return Promise.all(actions).then(()=>that);
        }

        //! register subscription.
        // _log(NS, '> INFO! - register subscriber by id ='+id);

        //! inline function.
        let handler: any = {handle: null as any, promise: null as any};
        if (typeof params === 'function'){
            // _log(NS, '>> params is function');
            //! it must be promised handler.
            handler.callee = params;
            handler.handle = function(that: any){
                // _log(NS, '>>> function call!');
                let callee = this.callee;
                return new Promise((resolve,reject) => {
                    try{
                        resolve(callee(that));
                    }catch(e){
                        reject(e);
                    }
                });
                // return Promise.resolve(that).then(callee);
            }
            // handler.handle = params;
        } else if (typeof params === 'object' && params instanceof Promise){
            // _log(NS, '>> params is object & Promise ');
            handler.promise = params;
        } else {
            // _log(NS, '>> params is invalid ');
            return Promise.reject(new Error(NS + 'invalid params type:'+(typeof params)));
        }

        //! register into list.
        if (handler){
            //! check if all modes.
            if (!id.endsWith(':*')){
                if (!thiz.$notify[id]) thiz.$notify[id] = [];
                thiz.$notify[id].push(handler);
                // _log(NS, `! notify-subscribe(${id}) count=`, thiz.$notify[id].length);
            } else {
                const id2 = id.substring(0, id.length-1);
                RECORD_MODES.forEach(mode => {
                    let id = id2 + mode;
                    if (!thiz.$notify[id]) thiz.$notify[id] = [];
                    thiz.$notify[id].push(handler);
                    // _log(NS, `> notify-subscribe(${id}) count=`, thiz.$notify[id].length);
                })
                // _log(NS, `! notify-subscribe(${id}) ... modes=`, RECORD_MODES.join('/'));
            }
        }

        //! 리턴은 Promised 된 것으로...
        // _log(NS, `! subscribed-notify(${id})... that=`, $U.json(that));
        return Promise.resolve(that);
    };

    /** ****************************************************************************************************************
	 *  Master Notifier's Bubbling Up to Parent.
	 ** ****************************************************************************************************************/
    if (CONF_MASTER)
    {
        //TODO - 초기화 함수 호출 문제가있어 보임. 즉 require() 리턴값이 Promise 일 경우에는 초기화까지 기다려 줘야할듯..
        //! subscribe record:* events.
        const ID = ':record:*';
        _log(NS,`>>>>> subscribe master (${ID}) ... `);
        CONF_MASTER.do_subscribe(':record:*', (that: any) => {
            _log(NS, `- on-notified-record (${that._id}).... that=`, $U.json(that));

            const id = that._id||'';
            const ids = id.split(':');
            if (ids.length < 2) return that;            // invalid id.
            ids.shift();
            ids.unshift(CONF_NS_NAME);
            const ids2 = ids.join(':');

            //! bubble up to parent if notification from master by replacing NS.
            let that2 = $U.extend({}, that);            // make copy of that.
            that2._id = ids2;
            that2._id_org = id;

            return my_notify_trigger(that2);
        }).then((_: any) => {
            _log(NS, '! subscribed master. res=', _);
        });
        _log(NS,`<<<<< subscribe master (${ID}) ... `);
    }


    /** ****************************************************************************************************************
	 *  Promised Data Model.
	 ** ****************************************************************************************************************/
    /**
	 * Prepare the Promised chain.
	 *
	 * @param eid   event-id
	 * @param $node object data.
	 * @param mode  string mode.
	 */
    const prepare_chain = (eid: any, $node: any, mode: any) => {
        eid = eid || '';                              // make sure Zero value if otherwise.
        mode = mode || '';                            // make sure string.
        CONF_NS_NAME && _log(NS, `do_${mode}()... id=`, eid && eid._id || eid && eid.records && ('record#:' + eid.records.length) || eid);

        // CONF_NS_NAME && _log(NS, '>> event that = ', $U.json($node));
        //! determine object if 1st parameter is object.
        if (typeof eid === 'object'){
            $node = eid;
        } else {
            $node = {_id:eid, _current_mode:mode, data:$node};
        }
        // $node = typeof eid === 'object' ? eid : $U.extend(
        // 	$node === undefined || (typeof $node === 'object' && !($node instanceof Promise))
        // 		? $node || {} : {params: $node}
        // 	, {'_id': eid});

        //! prepare object.
        let that = $node;                           // re-use $node as main object.

        return $U.promise(that);
    }

    /**
	 * Finish chain call.
	 */
    const finish_chain = (that: any) => {
        // const mode = that._current_mode;
        return that;
    };

    /** ****************************************************************************************************************
	 *  Chained Functions Built Up.
	 ** ****************************************************************************************************************/
    thiz.do_notify = (id: string, $param: any) =>
        prepare_chain(id, $param, 'notify')
            .then(my_notify_trigger)
            .then(finish_chain);

    thiz.do_subscribe = my_notify_subscribe_sync;
    // prepare_chain(id, $param, 'subscribe')
    // 	.then(my_notify_subscribe)
    // 	.then(finish_chain);

    //! returns.
    return thiz;
};

export default maker;
