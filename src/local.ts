/**
 * local.ts
 * - Local Standalone Express
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
//NOTE - 다음이 있어야, Error 발생시 ts파일에서 제대로된 스택 위치를 알려줌!!!.
require('source-map-support').install();

//TODO - generate config.json out of package.json.
import config from './config.json';
// import environ from './environ';
// import dotenv from 'dotenv';

// if (process.env.NODE_ENV === 'development')
const NODE_ENV = process.env.NODE_ENV || 'development';

//! override environment with yml
// process.env = environ(process.env);

//! Load environment variables from .env file if exists.
// dotenv.config({ path: '.env.sample' });

//! logging options.
const NS = 'local';
import { _log, _inf, _err } from './common/logger';

const PORT = getRunParam('port', config.port || 8080);
const HOST = getRunParam('host', config.host || 'http://127.0.0.1');

//! now loading application.
import { createApp } from './app';

const app = createApp()
    .listen(PORT, () => {
        _inf(NS, `[${NODE_ENV.toUpperCase()} ENV]`);
        _log(NS, `Running on port ${HOST}:${PORT}`);
        // _log(NS, `env.stage :=`, process.env.STAGE);
    })
    .on('error', function(e) {
        _err(NS, '!ERR - server.err = ', e);
    });

// get running parameter like -h api.
function getRunParam(o: string, defval: boolean | number | string) {
    const argv = process.argv || []; // use scope.
    let i = -1;
    i = i > 0 ? i : argv.indexOf('-' + o);
    i = i > 0 ? i : argv.indexOf('--' + o);
    i = i > 0 ? i : argv.indexOf(o);
    if (i >= 0) {
        var ret = argv[i + 1];
        if (typeof defval === 'boolean') {
            return ret === 'true' || ret === 't' || ret === 'y' || ret === '1';
        } else if (typeof defval === 'number') {
            return parseInt(ret);
        } else {
            return ret;
        }
    }
    return defval;
}

//! default export.
export default app;
