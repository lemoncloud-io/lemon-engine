/**
 * types.ts
 * - common types
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */

//! General Interface
interface Shape {
    getArea(): number;
}

//! Function Interface.
interface NumberOperation {
    (arg1: number, arg2: number): number;
}

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

//! hybrid interface
interface QueryElement {
    (query: string): string;
}
interface QueryInterface {
    (query: string): QueryElement;
    each: Function;
    ajax: Function;
    // ...
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
