/**
 * types.ts
 * - common types
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
import { Utilities } from '../core/utilities';
import { HttpProxy } from '../plugins/http-proxy';

//! Indexable.
interface Indexable {
    [key: string]: any;
}

//! Interface with default member.
interface Animal {
    name: string;
    age: number;
    size?: number;
}

//! 생성자 인터페이스
interface AnimalConstructor {
    new (name: string, age: number): Animal;
}

export interface GeneralFuntion {
    (...arg: any[]): any;
}

export interface EnginePluggable {
    (options?: any): EnginePluggable;
}
export interface EnginePluginService extends EnginePluggable {
    [key: string]: GeneralFuntion;
}

export interface EngineService {
    (name: string, service?: EnginePluginService): EnginePluginService;
    log: GeneralFuntion;
    inf: GeneralFuntion;
    err: GeneralFuntion;
    U: Utilities;
    _: any; // = require('lodash/core')
    environ: (name: string, defValue?: string | boolean | number | undefined) => string | boolean | number | undefined;
}

export interface EngineInterface extends EngineService {
    // (name: string, opts: any): any;
    STAGE: string;
    id: string;
    extend: (a: any, b: any) => any;
    ts: (d?: Date | number) => string;
    $console: EngineConsole;
    createModel: ServiceMaker;
    createHttpProxy: HttpProxyBuilder;
    createWebProxy: ServiceMaker;
    $plugins: { [key: string]: EnginePluginService };
}

export interface EnginePluginMaker {
    ($engine: EngineService, name: string, options?: any): EnginePluginService;
}

export interface HttpProxyBuilder {
    (name: string, endpoint: string | { endpoint: string; headers?: any }): HttpProxy;
}

export interface EngineOption {
    name?: string;
    env?: { [key: string]: string };
}

export interface EngineLogger {
    (...arg: any[]): void;
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

/**
 * Standard Method for handling API call.
 * - 표준화된 API 처리 핸들러 형식을 지정함.
 *
 * @author steve@lemoncloud.io
 * @copyright LemonCloud Co,. LTD 2019.
 */
export interface LemonStandardApi {
    (id: string, param: any, body: any, ctx: any): Promise<any>;
}
