import { Request, Response, Router } from 'express';
import engine from '../../';
//! router setting.
const router: Router = Router();

//! create engine in global scope.
const $engine = engine(global, { env: process.env });

//! reuse core module
const $U = $engine.U;
if (!$U) throw new Error('$U(utilities) is required!');

//! load common(log) functions
const _log = $engine.log;
const _inf = $engine.inf;
const _err = $engine.err;

// NAMESPACE TO BE PRINTED.
const NS = $U.NS('WEB2', 'red');

import webProxy from '../../plugins/web-proxy';

const $svc = () => {
    const options = {
        headers: {
            'content-type': 'application/json',
            'api-key': 'lemon-access-key',
        },
    };
    return webProxy($engine, 'WEBS', options);
};

/**
 * ```sh
 * $ http ':8080/web/
 */
router.get('/', async (req: Request, res: Response) => {
    // https://uxzuebm6k7.execute-api.ap-northeast-2.amazonaws.com/prod/todaq/0/hello'
    _log(NS, `get().....`);
    const data = await $svc().do_get('http://localhost:8231', '/hello');
    _log(NS, '> data=', data);
    res.json(data);
});

/**
 * ```sh
 * $ http PATCH ':8080/web/
 */
router.patch('/', async (req: Request, res: Response) => {
    _log(NS, `patch().....`);
    const data = await $svc().do_patch('http://localhost:8231', '/hello');
    _log(NS, '> data=', data);
    res.json(data);
});

export default router;
