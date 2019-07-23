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
import utilities from './core/utilities';

export interface EngineOption {
    name?: string;
    env?: {[key: string]: string};
}

export interface EngineLogger {
    (...arg: any[]): any;
}

export interface EngineFunction {
    (...arg: any[]): any;
}

export interface ServiceMaker {
    (name: string, options: any): any;
}

export interface EngineConsole {
    thiz: any;
    log: EngineLogger;
    error: EngineLogger;
    auto_ts: boolean;
    auto_color: boolean;
}

export interface EngineInterface extends EngineService {
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
    createWebProxy: ServiceMaker;
    $plugins: {[key: string]: EnginePluginService};
}

export { EngineService, EnginePluginService };

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
import webProxy from './plugins/web-proxy';
import cognito from './plugins/cognito-proxy';
import lambda from './plugins/lambda-proxy';
import protocol from './plugins/protocol-proxy';
import cron from './plugins/cron-proxy';
import agw from './plugins/agw-proxy';

/**
 * initialize as EngineInterface
 *
 * ```ts
 * import engine from 'lemon-engine';
 * const $engine = engine(global, { env: process.env });
 * ```
 *
 * @param scope         main scope like global, browser, ...
 * @param options       configuration.
 */
export default function initiate(scope: any = null, options: EngineOption = {}): EngineInterface {
    scope = scope || {};

    //! load configuration.
    const ROOT_NAME = options.name || 'lemon';
    const STAGE = _environ('STAGE', '');
    const LS = (_environ('LS', '0') === '1'); // LOG SILENT (NO PRINT LOG)
    const TS = (_environ('TS', '1') === '1');                                                   // PRINT TIME-STAMP.
    const LC = (STAGE === 'local'||STAGE === 'express'||_environ('LC', '')==='1');              // COLORIZE LOG.

    const LEVEL_LOG = '-';
    const LEVEL_INF = 'I';
    const LEVEL_ERR = 'E';

    const RED = "\x1b[31m";
    const BLUE = "\x1b[32m";
    const YELLOW = "\x1b[33m";
    const RESET = "\x1b[0m";

    function _environ(name: string, defVal: any){
        // as default, load from proces.env.
        const env =  options.env || (process && process.env) || {};
        const val = env[name];
        // throw Error if value is not set.
        if (defVal && defVal instanceof Error && val === undefined) throw defVal;
        // returns default.
        return val === undefined ? defVal : val;
    }

    // timestamp like 2016-12-08 13:30:44
    function _ts() {
        return utilities.timestamp();
    }

    //! common function for logging.
    const silent = () => {};
    const $console: EngineConsole = {
        thiz: console,
        log: LS ? silent : console.log,
        error: LS ? silent : console.error,
        auto_ts: TS,
        auto_color: LC
    };
    const _log: EngineLogger = function (...arg: any[]) {
        let args = !Array.isArray(arguments) && Array.prototype.slice.call(arguments) || arguments;
        if ($console.auto_color) args.unshift(RESET), $console.auto_ts && args.unshift(_ts(), LEVEL_LOG) || args.unshift(LEVEL_LOG), args.unshift(BLUE);
        else $console.auto_ts && args.unshift(_ts(), LEVEL_LOG);
        return $console.log.apply($console.thiz, args)
    }
    const _inf: EngineLogger = function (...arg: any[]) {
        let args = !Array.isArray(arguments) && Array.prototype.slice.call(arguments) || arguments;
        if ($console.auto_color) args.unshift(""), args.push(RESET), $console.auto_ts && args.unshift(_ts(), LEVEL_INF) || args.unshift(LEVEL_INF), args.unshift(YELLOW);
        else $console.auto_ts && args.unshift(_ts(), LEVEL_INF);
        return $console.log.apply($console.thiz, args)
    }
    const _err: EngineLogger = function (...arg: any[]) {
        let args = !Array.isArray(arguments) && Array.prototype.slice.call(arguments) || arguments;
        if ($console.auto_color) args.unshift(""), args.push(RESET), $console.auto_ts && args.unshift(_ts(), LEVEL_ERR) || args.unshift(LEVEL_ERR), args.unshift(RED);
        else $console.auto_ts && args.unshift(_ts(), LEVEL_ERR);
        return $console.error.apply($console.thiz, args)
    }
    const _extend = function (opt: any, opts: any) {      // simple object extender.
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
    _$.environ = _environ;
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
    const $U = new utilities(_$);
    _$.U = $U;

    //! make http-proxy.
    _$.createHttpProxy = (name: string, endpoint: string | {endpoint: string; headers?: any}) => {
        return httpProxy(_$, name, endpoint);
    }

    //! make web-proxy
    _$.createWebProxy = (name: string, options?: {headers: any}) => {
        return webProxy(_$, name, options);
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
    webProxy(_$, 'WS');                     // load service, and register as 'WS'
    cognito(_$, 'CS');                      // load service, and register as 'CS'
    lambda(_$, 'LS');                       // load service, and register as 'LS'
    protocol(_$, 'PR');                     // load service, and register as 'PR'
    cron(_$, 'CR');                         // load service, and register as 'CR'
    agw(_$, 'AG');                          // load service, and register as 'AG'

    _inf('! engine-service-ready');

    //! returns finally.
    return _$;
}
