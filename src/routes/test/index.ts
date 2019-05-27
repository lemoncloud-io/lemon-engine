import { Request, Response, Router } from 'express';
import engine from '../../';

const router: Router = Router();

//! defines fields in data
/* eslint-disable prettier/prettier */
const FIELDS = [
    'id', 'ns', 'type', 'sid', 'uid', 'gid', 'parent', 'stereo',                    // Core properties
    'name', 'cat', 'company', 'state', 'status',                                    // 제품 기본 정보 (이름, 카테고리, 회사, 상태, 상황)
    'description', 'meta',                                                          // description & meta.
];

//! create engine in global scope.
const $engine = engine(global, { env: process.env });
const name = 'TST';

//! reuse core module
export const $U = $engine.U;
if (!$U) throw new Error('$U(utilities) is required!');

//! load common(log) functions
const _log = $engine.log;
const _inf = $engine.inf;
const _err = $engine.err;

// NAMESPACE TO BE PRINTED.
const NS = $U.NS(name);

//! define model.
/* eslint-disable prettier/prettier */
const model = $engine.createModel(`_${name}`, {
    ID_TYPE: '#STRING',             // WARN! '#' means no auto-generated id.
    ID_NEXT: 0,                     // Next-ID Number (0 means no auto-sequence).
    FIELDS: FIELDS,                 // Properties.
    DYNA_TABLE: 'TodaqTable',       // Target DynamoDB Table
    REDIS_PKEY: '#TDQ',             // '#' means no use redis, but elastic as cache.
    ES_INDEX: 'todaq-v1',           // ES Index Name. (//TODO - dev/prod index)
    ES_TYPE: 'toda',                // ES Type (NOTE! - 별 의미 없지만, ES5 호환을 위해서.)
    ES_FIELDS: FIELDS,              // Only for Indexing Server.
    NS_NAME: name,                  // Notify Service Name. (null means no notifications)
    ES_MASTER: 1,                   // MASTER NODE.
    ES_VERSION: 6,                  // ElasticSearch Engine Version 6.
    CLONEABLE: true,                // 복제 가능하며, parent/cloned 필드를 지원함. (Core 에만 세팅!)
    ES_TIMESERIES: false,           // Time-Series 데이터로, 시계열 정보를 저장할때 이용함.
    PARENT_IMUT: false,             // possible to set parent.
});
_log(NS, '! engine-model created for table=', model.DYNA_TABLE);


router.get('/', async (_: Request, res: Response) => {
    const data = await model.do_search();
    res.json(data);
});

router.get('/!diff', async (_: Request, res: Response) => {
    const A = {a:1, b:2};
    const B = {b:2, c:4};
    const data: any = {diff: $engine.U.diff(A, B)};
    data.TS = $engine.environ('TS');
    res.json(data);
});

router.get('/!hello', async (_: Request, res: Response) => {
    const data: any = {
        hello: model.hello()
    };
    res.json(data);
});


export default router;
