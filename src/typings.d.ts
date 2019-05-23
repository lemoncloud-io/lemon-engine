/**
 * typings.d.ts
 * - support json import in ts
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
declare module '*.json' {
    const value: any;
    export default value;
}
