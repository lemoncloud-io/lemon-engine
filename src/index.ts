/* eslint-disable prettier/prettier */
/** ********************************************************************************************************************
 *  boot loading for global instance manager
 ** *******************************************************************************************************************/
/**
 * main creation function of lemon instance pool (LIP)
 *
 *  
 * options : {
 *     name : string    - name of module.
 *     env : object     - environment settings.
 * }
 * 
 * @param scope         main scope like global, browser, ...
 * @param options       configuration.
 */
import { EngineService, EnginePluginService } from './common/types'
import * as _ from "lodash";
import util from './core/utilities';

interface EngineOption {
    name?: string;
    env?: {[key: string]: string};
}

interface EngineLogger {
    (...arg: any[]): any;
}

interface EngineFunction {
    (...arg: any[]): any;
}

interface ServiceMaker {
    (name: string, options: any): any;
}

interface EngineConsole {
    thiz: any;
    log: EngineLogger;
    error: EngineLogger;
    auto_ts: boolean;
    auto_color: boolean;
}

interface EngineInterface extends EngineService {
    // (name: string, opts: any): any;
    STAGE: string;
    id: string;
    extend: EngineFunction;
    ts: EngineFunction;
    // U: util;
    // environ: EngineFunction;
    $console: EngineConsole;
    createModel: ServiceMaker;
    createHttpProxy: ServiceMaker;
    $plugins: {[key: string]: EnginePluginService};
}

//! load common services....
import buildEngine from './core/lemon-engine-model';

import httpProxy from './plugins/http-proxy';
import mysql from './plugins/mysql-proxy';
import dynamo from './plugins/dynamo-proxy';
import redis from './plugins/redis-proxy';
import elastic6 from './plugins/elastic6-proxy';
import s3 from './plugins/s3-proxy';
import sqs from './plugins/sqs-proxy';
import sns from './plugins/sns-proxy';
import ses from './plugins/ses-proxy';
import web from './plugins/web-proxy';
import cognito from './plugins/cognito-proxy';
import lambda from './plugins/lambda-proxy';
import protocol from './plugins/protocol-proxy';
import cron from './plugins/cron-proxy';
import agw from './plugins/agw-proxy';


export default function initiate(scope: any = {}, options: EngineOption = {}) {
    scope = scope || {};

    //! load configuration.
    const ROOT_NAME = options.name || 'lemon';
    const STAGE = _get_env('STAGE', '');
    const TS = (_get_env('TS', '1') === '1');                                                   // PRINT TIME-STAMP.
    const LC = (STAGE === 'local'||STAGE === 'express'||_get_env('LC', '')==='1');              // COLORIZE LOG.

    const LEVEL_LOG = '-';
    const LEVEL_INF = 'I';
    const LEVEL_ERR = 'E';
    
    const RED = "\x1b[31m";
    const BLUE = "\x1b[32m";
    const YELLOW = "\x1b[33m";
    const RESET = "\x1b[0m";

    function _get_env(name: string, defVal: any){
        // as default, load from proces.env.
        const env =  options.env || (process && process.env) || {};
        const val = env && env[name] || undefined;
        // throw Error if value is not set.
        if (defVal && defVal instanceof Error && val === undefined) throw defVal;
        // returns default.
        return val === undefined ? defVal : val;
    }
    //! common function for logging.
    var $console: EngineConsole = {thiz: console, log: console.log, error: console.error, auto_ts: TS, auto_color: LC};
    var _log: EngineLogger = function (...arg: any[]) {
        let args = !Array.isArray(arguments) && Array.prototype.slice.call(arguments) || arguments;
        if ($console.auto_color) args.unshift(RESET), $console.auto_ts && args.unshift(_ts(), LEVEL_LOG) || args.unshift(LEVEL_LOG), args.unshift(BLUE);
        else $console.auto_ts && args.unshift(_ts(), LEVEL_LOG);
        return $console.log.apply($console.thiz, args)
    }
    var _inf: EngineLogger = function (...arg: any[]) {
        let args = !Array.isArray(arguments) && Array.prototype.slice.call(arguments) || arguments;
        if ($console.auto_color) args.unshift(""), args.push(RESET), $console.auto_ts && args.unshift(_ts(), LEVEL_INF) || args.unshift(LEVEL_INF), args.unshift(YELLOW);
        else $console.auto_ts && args.unshift(_ts(), LEVEL_INF);
        return $console.log.apply($console.thiz, args)
    }
    var _err: EngineLogger = function (...arg: any[]) {
        let args = !Array.isArray(arguments) && Array.prototype.slice.call(arguments) || arguments;
        if ($console.auto_color) args.unshift(""), args.push(RESET), $console.auto_ts && args.unshift(_ts(), LEVEL_ERR) || args.unshift(LEVEL_ERR), args.unshift(RED);
        else $console.auto_ts && args.unshift(_ts(), LEVEL_ERR);
        return $console.error.apply($console.thiz, args)
    }
    var _extend = function (opt: any, opts: any) {      // simple object extender.
        for (let k in opts) {
            let v = opts[k];
            if (v === undefined) delete opt[k];
            else opt[k] = v;
        }
        return opt;
    }

    //! root instance to manage global objects.
    const _$: EngineInterface = scope._$ || function (name: string, service: EnginePluginService): EnginePluginService {                                // global identifier.
        if (!name) return;
        const thiz = _$;
        let opt = typeof thiz.$plugins[name] !== 'undefined' ? thiz.$plugins[name] : undefined;
        if (!service) return opt;
        if (opt === undefined) {
            _log('INFO! service[' + name + '] registered');
            thiz.$plugins[name] = service;
            return service;
        } else {
            //! extends options.
            _inf('WARN! service[' + name + '] exists! so extends ');
            opt = _extend(opt, service);
            thiz.$plugins[name] = opt;
            return opt;
        }
    };

    // register into _$(global instance manager).
    _$.STAGE = STAGE;
    _$.id = ROOT_NAME;
    _$.log = _log;
    _$.inf = _inf;
    _$.err = _err;
    _$.extend = _extend;
    _$.ts = _ts;
    _$._ = _;
    _$.environ = _get_env;
    _$.$console = $console; // '$' means object. (change this in order to override log/error message handler)
    _$.$plugins = {};
    _$.toString = () => ROOT_NAME || '$ROOT';

    //! register as global instances as default.
    scope._log = _log;
    scope._inf = _inf;
    scope._err = _err;
    scope._$ = _$;

    // $root[_$.id] = _$;
    STAGE && _inf('#STAGE =', STAGE);

    //! load utilities.
    const $U = new util(_$);
    _$.U = $U;

    // timestamp like 2016-12-08 13:30:44
    function _ts() {
        return $U.ts();
    }

    //! proxy maker.
    _$.createHttpProxy = (name: string, endpoint: string) => {
        return httpProxy(_$, name, endpoint);
    }

    //! engine builder.
    _$.createModel = (name: string, option: any) => {
        return buildEngine(_$, name, option);
    }

    //! load common services....
    mysql(_$, 'MS');                        // load service, and register as 'MS'
    dynamo(_$, 'DS');                       // load service, and register as 'DS'
    redis(_$, 'RS');                        // load service, and register as 'RS'
    elastic6(_$, 'ES6');                    // load service, and register as 'ES6'
    s3(_$, 'S3');                           // load service, and register as 'S3'
    sqs(_$, 'SS');                          // load service, and register as 'SS'
    sns(_$, 'SN');                          // load service, and register as 'SN'
    ses(_$, 'SE');                          // load service, and register as 'SE'
    web(_$, 'WS');                          // load service, and register as 'WS'
    cognito(_$, 'CS');                      // load service, and register as 'CS'
    lambda(_$, 'LS');                       // load service, and register as 'LS'
    protocol(_$, 'PR');                     // load service, and register as 'PR'
    cron(_$, 'CR');                         // load service, and register as 'CR'
    agw(_$, 'AG');                          // load service, and register as 'AG'

    _inf('! engine-service-ready');

    //! returns finally.
    return _$;
}
