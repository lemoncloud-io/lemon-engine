/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable prettier/prettier */
/**
 * utilities.ts
 * - common utility
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
import { EngineService, GeneralFuntion } from '../common/types'
const NS = 'util';

class Utilities {
    private _$: EngineService;
    private log: GeneralFuntion;
    private err: GeneralFuntion;
    private name: string;

    public constructor (_$: EngineService){
        this._$ = _$;
        this.log = _$.log;
        this.err = _$.err;
        this.name = `${NS}-utils`;
    }

    protected lodash(){
        // use underscore util.
        const $_ = this._$._;
        if (!$_) throw new Error('$_(lodash) is required!');
        return $_;
    }
    
    //! some helper function.s
    public get_env(name: string, def_val?: string): any {
        if (typeof this._$.environ === 'function') return this._$.environ(name, def_val);

        // as default, load from proces.env.
        let val = (process && process.env[name]) || undefined;
        return val === undefined ? def_val : val;
    }

    public env(name: string, def_val?: string): any {
        return this.get_env(name, def_val);
    }

    public is_dev(): boolean {
        const env = this.get_env('ENV') || this.get_env('NODE_ENV') || this.get_env('STAGE');
        return env === 'production' || env === 'op' ? false : true;
    }
    
    /**
     * Load CSV File in data folder.
     *
     * @param name
     * @returns {Promise}
     * @private
     */
    public load_data_csv(name: string) {
        if (!name) throw new Error('param:name is required!');

        const fs = require('fs');
        const parse = require('csv-parse');
        const path = require('path');

        //! calculate the target data file.
        var fname = path.resolve(__dirname, '../data/' + name + (name.endsWith('.csv') ? '' : '.csv'));

        //! prepare promised.
        var chain = new Promise(function(resolve, reject) {
            //! read file-stream.
            fs.readFile(fname, 'UTF-8', (err: any, data: any) => {
                if (err) return reject(err);
                //! call parse.
                parse(data, { columns: true, trim: true }, (err: any, rows: any) => {
                    if (err) return reject(err);
                    return resolve(rows);
                });
            });
        });
        return chain;
    }

    public load_data_yaml(name: any) {
        if (!name) throw new Error('param:name is required!');

        const fs = require('fs');
        const path = require('path');
        const yaml = require('js-yaml');

        //! calculate the target data file.
        const fname = path.resolve(__dirname, '../data/' + name + (name.endsWith('.yml') ? '' : '.yml'));

        this.log(NS, 'load file =', fname);
        //! prepare promised.
        let chain = new Promise(function(resolve, reject) {
            // Get document, or throw exception on error
            try {
                let doc = yaml.safeLoad(fs.readFileSync(fname, 'utf8'));
                resolve(doc);
            } catch (e) {
                reject(e);
            }
        });
        return chain;
    }

    public load_sync_yaml(name: string) {
        if (!name) throw new Error('param:name is required!');

        const fs = require('fs');
        const path = require('path');
        const yaml = require('js-yaml');

        //! calculate the target data file.
        const fname = path.resolve(__dirname, '../data/' + name + (name.endsWith('.yml') ? '' : '.yml'));

        // Get document, or throw exception on error
        try {
            this.log(NS, 'load-sync-file =', fname);
            let doc = yaml.safeLoad(fs.readFileSync(fname, 'utf8'));
            return doc;
        } catch (e) {
            this.err(NS, `error:load-sync-yaml(${name})=`, e);
        }
        return {};
    }

    public extend(a: any, b: any) {
        for (var x in b) a[x] = b[x];
        return a;
    }

    public isset(x: any) {
        return x === undefined ? false : true;
    }

    public empty(x: any) {
        return x ? false : true;
    }

    public min(a: any, b: any) {
        return a < b ? a : b;
    }

    public max(a: any, b: any) {
        return a > b ? a : b;
    }

    public round(a: any) {
        return Math.round(a);
    }

    public json(o: any, isSorted?: any) {
        if (isSorted) {
            var output: any = {};
            Object.keys(o)
                .sort()
                .forEach(function(key) {
                    output[key] = o[key];
                });
            o = output;
        }
        return (o && JSON.stringify(o)) || o;
    }

    // timestamp value.
    public static timestamp(d?: any) {
        var dt = d && typeof d === 'object' ? d : d ? new Date(d) : new Date();
        var y = dt.getFullYear();
        var m = dt.getMonth() + 1; //Months are zero based
        var d = dt.getDate();

        var h = dt.getHours();
        var i = dt.getMinutes();
        var s = dt.getSeconds();

        var ret =
            (y < 10 ? '0' : '') +
            y +
            '-' +
            (m < 10 ? '0' : '') +
            m +
            '-' +
            (d < 10 ? '0' : '') +
            d +
            ' ' +
            (h < 10 ? '0' : '') +
            h +
            ':' +
            (i < 10 ? '0' : '') +
            i +
            ':' +
            (s < 10 ? '0' : '') +
            s;
        return ret;
    }

    public ts(d?: any) {
        return Utilities.timestamp(d);
    }

    // parse timestamp to date.
    public dt(ts?: any) {
        ts = ts || this.ts();
        var aa = ts.split(' ');
        var dd = aa[0].split('-');
        var hh = aa[1].split(':');
        var y = parseInt(dd[0]),
            m = parseInt(dd[1]) - 1,
            d = parseInt(dd[2]);
        var h = parseInt(hh[0]),
            i = parseInt(hh[1]),
            s = parseInt(hh[2]);
        //NOTE - unable to add to prototype.
        // //! addtional function: add_seconds()
        // if (!Date.prototype.add_seconds) {
        // 	Date.prototype.add_seconds = function (dx: number) {
        // 		this.setSeconds(this.getSeconds() + dx);
        // 		return this;
        // 	}
        // }
        // //! format to time-stamp.
        // if (!Date.prototype.ts) {
        // 	Date.prototype.ts = function () {
        // 		return _ts(this);
        // 	}
        // }
        var dt = new Date(y, m, d, h, i, s, 0);
        return dt;
    }

    public now(){
        return this.dt();
    }

    /**
     * 현재 시간값 (number of milliseconds since midnight of January 1, 1970.)
     *
     *
     * @returns {number}
     */
    public current_time_ms() {
        //TODO:XENI - 서버와 시간 동기화를 위해서, 디비서버에등에서 일체화된 시간 동기값을 환산하여 준다.
        var time_shift = 0;

        var ret = new Date().getTime();
        ret += time_shift;
        return ret;
    }

    /**
     * NameSpace Maker.
     *
     * @returns {string}
     */
    public NS(ns: string, color?: string, len?: number) {
        if (!ns) return ns;
        len = len || 4;
        len = len - ns.length;
        len = len < 0 ? 0 : len;
        const SPACE = '           ';
        ns = SPACE.substr(0, len) + ns + ':';
        if (color) {
            const COLORS: any = {
                red: '\x1b[31m',
                green: '\x1b[32m',
                yellow: '\x1b[33m',
                blue: '\x1b[34m',
                magenta: '\x1b[35m',
                cyan: '\x1b[36m',
                white: '\x1b[37m',
            };
            ns = COLORS[color] + ns + '\x1b[0m';
        }
        return ns;
    }

    // escape string for mysql.
    public escape(str: string, urldecode?: any) {
        if (str === undefined) return 'NULL';
        if (this.isInteger(str)) return str;
        str = str || '';
        if (typeof str == 'object') {
            str = JSON.stringify(str);
        }
        str = str
            .replace(/\\/g, '\\\\')
            .replace(/\$/g, '\\$')
            .replace(/'/g, "\\'")
            .replace(/"/g, '\\"');

        if (urldecode) {
            // url-decode
            str = decodeURI(str);
        }
        return "'" + str + "'";
    }

    // convert to integer.
    public isInteger(x: any) {
        return typeof x === 'number' && x % 1 === 0;
    }

    public N(x: any, def?: any) {
        try {
            if (x === '' || x === undefined || x === null) return def;
            if (typeof x === 'number' && x % 1 === 0) return x;
            if (typeof x == 'number') return parseInt('' + x);
            x = '0' + x;
            x = x.startsWith('0-') ? x.substr(1) : x; // minus
            return parseInt(x.replace(/,/gi, '').trim());
        } catch (e) {
            this.err('err at _N: x=' + x + ';' + typeof x + ';' + (e.message || ''), e);
            return def;
        }
    }

    //! parse float number (like 1.01)
    public F(x: any, def?: any) {
        try {
            if (x === '' || x === undefined || x === null) return def;
            if (typeof x === 'number' && x % 1 === 0) return x;
            if (typeof x == 'number') return parseFloat('' + x);
            x = '0' + x;
            x = x.startsWith('0-') ? x.substr(1) : x; // minus
            return parseFloat(x.replace(/,/gi, '').trim());
        } catch (e) {
            this.err('err at _N: x=' + x + ';' + typeof x + ';' + (e.message || ''), e);
            return def;
        }
    }

    //! remove underscore variables.
    public cleanup($N: any) {
        return Object.keys($N).reduce(function($N, key) {
            if (key.startsWith('_')) delete $N[key];
            if (key.startsWith('$')) delete $N[key];
            return $N;
        }, $N);
    }

    //! remove underscore variables.
    public updated(that: any, that2: any) {
        const updated = Object.keys(that2).reduce((self: any, key) => {
            if (that[key] !== that2[key]) {
                if (that[key] === null && that2[key] === '') {
                    // both same.
                    return self;
                }
                self[key] = that2[key];
            }
            return self;
        }, {});
        return updated;
    }

    public copy($N: any) {
        return Object.keys($N).reduce(function($n: any, key) {
            $n[key] = $N[key];
            return $n;
        }, {});
    }

    public copy_node($N: any, isClear?: boolean) {
        isClear = isClear === undefined ? false : isClear;
        return Object.keys($N).reduce(function($n: any, key) {
            if (key.startsWith('_')) return $n;
            if (key.startsWith('$')) return $n;
            $n[key] = isClear ? null : $N[key];
            return $n;
        }, {});
    }

    //! clean up all member without only KEY member.
    public bare_node($N: any, opts?: any) {
        // return Object.keys($N).reduce(function($n, key) {
        // 	if(key.startsWith('_')) return $n;
        // 	if(key.startsWith('$')) return $n;
        // 	$n[key] = $N[key]
        // 	return $n;
        // }, {})
        let $n: any = {};
        $n._id = $N._id;
        $n._current_time = $N._current_time;
        if (opts) $n = this.extend($n, opts);
        return $n;
    }

    public diff(obj1: any, obj2: any) {
        const $_ = this.lodash();
        const diff = Object.keys(obj1).reduce((result, key) => {
            if (!obj2.hasOwnProperty(key)) {
                result.push(key);
            } else if ($_.isEqual(obj1[key], obj2[key])) {
                const resultKeyIndex = result.indexOf(key);
                result.splice(resultKeyIndex, 1);
            }
            return result;
        }, Object.keys(obj2));

        return diff;
    }

    public diff_node(obj1: any, obj2: any) {
        let keys1: any = [],
            keys2: any = [];
        const $_ = this.lodash();
        Object.keys(obj1).forEach(key => {
            if (key.startsWith('_')) return;
            if (key.startsWith('$')) return;
            keys1.push(key);
        });
        Object.keys(obj2).forEach(key => {
            if (key.startsWith('_')) return;
            if (key.startsWith('$')) return;
            keys2.push(key);
        });
        const diff = keys1.reduce((result: any, key: string) => {
            if (!obj2.hasOwnProperty(key)) {
                result.push(key);
            } else if ($_.isEqual(obj1[key], obj2[key])) {
                const resultKeyIndex = result.indexOf(key);
                result.splice(resultKeyIndex, 1);
            }
            return result;
        }, keys2);

        return diff;
    }

    public hash(data: any) {
        data = data || '';
        data = typeof data === 'object' ? this.json(data, true) : data; //WARN! it must be sorted json.
        data = typeof data !== 'string' ? String(data) : data;
        /**
         * Calculate a 32 bit FNV-1a hash
         * Found here: https://gist.github.com/vaiorabbit/5657561
         * Ref.: http://isthe.com/chongo/tech/comp/fnv/
         *
         * @param {string} str the input value
         * @param {boolean} [asString=false] set to true to return the hash value as
         *     8-digit hex string instead of an integer
         * @param {integer} [seed] optionally pass the hash of the previous chunk
         * @returns {integer | string}
         */
        const hashFnv32a = function(str: any, asString?: any, seed?: any) {
            /*jshint bitwise:false */
            let i, l;
            let hval = seed === undefined ? 0x811c9dc5 : seed;

            for (i = 0, l = str.length; i < l; i++) {
                hval ^= str.charCodeAt(i);
                hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
            }
            if (asString) {
                // Convert to 8 digit hex string
                return ('0000000' + (hval >>> 0).toString(16)).substr(-8);
            }
            return hval >>> 0;
        };
        return hashFnv32a(data);
    }

    //! start promise chain.
    public promise(param: any) {
        return new Promise(function(resolve, reject) {
            resolve(param);
        });
    }

    //! promise in sequence.
    // example) promise_sequence([1,2,3], item => item+1);
    public promise_sequence(array: any, func: any) {
        let chain = this.promise(array.shift());
        chain = array.reduce((chain: any, item: any) => {
            return chain.then(() => func(item));
        }, chain.then(item => func(item)));
        return chain;
    }

    public md5(data: any, digest: any) {
        const crypto = require('crypto');
        digest = digest === undefined ? 'hex' : digest;
        return crypto
            .createHash('md5')
            .update(data)
            .digest(digest);
    }

    public hmac(data: any, KEY: any, algorithm: any, encoding: any) {
        const crypto = require('crypto');
        KEY = KEY || 'XENI';
        encoding = encoding || 'base64';
        algorithm = algorithm || 'sha256';
        return crypto
            .createHmac(algorithm, KEY)
            .update(data)
            .digest(encoding);
    }

    public qs_parse(query: any) {
        const QUERY_STRING = require('query-string');
        const param = QUERY_STRING.parse(query);
        Object.keys(param).forEach(key => {
            if (false) {
            }
            //! 빈 파라미터의 값을 빈 문자열로 치환
            else if (param[key] === null) {
                param[key] = '';
            }
            //! 숫자로 된 문자열이 오면 숫자로 변환
            else if (/^[1-9][0-9]*$/.test(param[key])) {
                param[key] = this.N(param[key]);
            }
        });
        return param;
    }

    public qs_stringify(query: string) {
        const QUERY_STRING = require('query-string');
        const param = QUERY_STRING.stringify(query);
        return param;
    }
};

export default Utilities;
