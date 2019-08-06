//! import core engine.
import engine, { LemonEngine } from '../src/index';

import { LemonEngineModel, MysqlProxy, DynamoProxy, RedisProxy, Elastic6Proxy } from '../src/index';
import { HttpProxy, WebProxy, S3Proxy, SQSProxy, SNSProxy, SESProxy } from '../src/index';
import { CognitoProxy, LambdaProxy, ProtocolProxy, CronProxy, AGWProxy } from '../src/index';

//! common config
const scope = {};
const LS = 1 ? '1' : '0'; // log silence flag.
const STAGE = 'test';
const DUMMY = 'dummy';
const BACKBONE = `http://localhost:8081`;
const $env: any = {
    LS,
    STAGE,
    DUMMY,
    BACKBONE_API: BACKBONE,
    MS_ENDPOINT: `${BACKBONE}/mysql`,
    DS_ENDPOINT: 1 ? undefined : `${BACKBONE}/dynamo`,
    WS_ENDPOINT: `${BACKBONE}/web`,
    PROTOCOL_PROXY_API: `${BACKBONE}/protocol`,
};

//! build engine.
const $engine: LemonEngine = engine(scope, {
    name: 'test-engine',
    env: $env,
});

describe(`test lemon-engine`, () => {
    //! members
    test('test name', () => {
        expect($engine.toString()).toEqual('test-engine');
        expect($engine.STAGE).toEqual(STAGE);
    });

    //! environ()
    test('test environ', () => {
        expect($engine.environ('NOP', '1')).toEqual('1');
        expect($engine.environ('DUMMY', '1')).toEqual('dummy');
    });

    //! ts()
    test('test ts', () => {
        expect($engine.ts().length).toEqual('2019-08-02 11:08:24'.length);
        expect($engine.ts().substr(0, 4)).toEqual(`${new Date().getFullYear()}`);
        expect($engine.ts(1564711704963)).toEqual('2019-08-02 11:08:24');
    });

    //! http-proxy
    test('test http-proxy', (done: any) => {
        const $http = $engine.createHttpProxy('backbone-http', BACKBONE);
        expect($http.name().split(':')[0]).toEqual('http-proxy');
        expect($http.endpoint()).toEqual(`${BACKBONE}`);
        $http
            .do_get('')
            .then((_: any) => {
                expect(`${_}`.split('/')[0]).toEqual('lemon-backbone-api');
                done();
            })
            .catch((e: Error) => {
                expect(e.message).toEqual('connect ECONNREFUSED 127.0.0.1:8081');
                done();
            });
    });

    //! web-proxy
    test('test web-proxy', (done: any) => {
        const $web = $engine.createWebProxy('backbone-web', BACKBONE);
        expect($web.name().split(':')[0]).toEqual('web-proxy');
        expect($web.endpoint()).toEqual(`${BACKBONE}/web`);
        $web.do_get(BACKBONE, '/')
            .then((_: any) => {
                expect(`${_}`.split('/')[0]).toEqual('lemon-backbone-api');
                done();
            })
            .catch((e: Error) => {
                expect(e.message).toEqual('connect ECONNREFUSED 127.0.0.1:8081');
                done();
            });
    });

    //! mysql-proxy
    // NOTE! create table `CREATE TABLE test_seq (id int(10) unsigned NOT NULL AUTO_INCREMENT, PRIMARY KEY ('id'));`
    test('test mysql-proxy', (done: any) => {
        const $mysql = $engine('MS') as MysqlProxy;
        expect($mysql.name().split(':')[0]).toEqual('mysql-proxy');
        expect($mysql.endpoint()).toEqual(`${BACKBONE}/mysql`);
        $mysql
            .do_get_next_id('test')
            .then((a: number) => {
                return $mysql.do_get_next_id('test').then((b: number) => {
                    expect(`${b - a}`).toEqual('1');
                    done();
                });
            })
            .catch((e: Error) => {
                expect(e.message).toEqual('connect ECONNREFUSED 127.0.0.1:8081');
                done();
            });
    });

    //! dynamo-proxy
    test('test dynamo-proxy', (done: any) => {
        const $dynamo = $engine('DS') as DynamoProxy;
        expect($dynamo.name().split(':')[0]).toEqual('dynamo-proxy');
        expect($dynamo.endpoint()).toEqual(`${BACKBONE}/dynamo`);
        $dynamo
            .do_list_tables('', 1)
            .then(_ => {
                const tables = _.TableNames;
                console.log('list-tables =', tables);
                expect(tables.length).toBe(1);
                done();
            })
            .catch((e: Error) => {
                expect(e.message).toEqual('connect ECONNREFUSED 127.0.0.1:8081');
                done();
            });
    });

    //! redis-proxy
    test('test redis-proxy', () => {
        const $redis = $engine('RS') as RedisProxy;
        expect($redis.name().split(':')[0]).toEqual('redis-proxy');
        expect($redis.endpoint()).toEqual(`${BACKBONE}/redis`);
    });

    //! elastic6-proxy
    test('test elastic6-proxy', () => {
        const $elastic6 = $engine('ES6') as Elastic6Proxy;
        expect($elastic6.name().split(':')[0]).toEqual('elastic6-proxy');
        expect($elastic6.endpoint()).toEqual(`${BACKBONE}/elastic6`);
    });

    //! s3-proxy
    test('test s3-proxy', () => {
        const $s3 = $engine('S3') as S3Proxy;
        expect($s3.name().split(':')[0]).toEqual('s3-proxy');
        expect($s3.endpoint()).toEqual(`${BACKBONE}/s3`);
    });

    //! sqs-proxy
    test('test sqs-proxy', () => {
        const $sqs = $engine('SS') as SQSProxy;
        expect($sqs.name().split(':')[0]).toEqual('sqs-proxy');
        expect($sqs.endpoint()).toEqual(`${BACKBONE}/sqs`);
    });

    //! sns-proxy
    test('test sns-proxy', () => {
        const $sns = $engine('SN') as SNSProxy;
        expect($sns.name().split(':')[0]).toEqual('sns-proxy');
        expect($sns.endpoint()).toEqual(`${BACKBONE}/sns`);
    });

    //! ses-proxy
    test('test ses-proxy', () => {
        const $ses = $engine('SE') as SESProxy;
        expect($ses.name().split(':')[0]).toEqual('ses-proxy');
        expect($ses.endpoint()).toEqual(`${BACKBONE}/ses`);
    });

    //! cognito-proxy
    test('test cognito-proxy', () => {
        const $cognito = $engine('CS') as CognitoProxy;
        expect($cognito.name().split(':')[0]).toEqual('cognito-proxy');
        expect($cognito.endpoint()).toEqual(`${BACKBONE}/cognito`);
    });

    //! lambda-proxy
    test('test lambda-proxy', (done: any) => {
        const $lambda = $engine('LS') as LambdaProxy;
        expect($lambda.name().split(':')[0]).toEqual('lambda-proxy');
        expect($lambda.endpoint()).toEqual(`${BACKBONE}/lambda`);
        //! invoke by labmda function name.
        $lambda
            .do_get('lemon-hello-api-prod-hello', '')
            .then((_: any) => {
                expect(Array.isArray(_.list)).toEqual(true);
                expect(_.name).toEqual('lemon');
                done();
            })
            .catch((e: Error) => {
                expect(e.message).toEqual('connect ECONNREFUSED 127.0.0.1:8081');
                done();
            });
    });

    //! protocol-proxy
    test('test protocol-proxy', (done: any) => {
        const $protocol = $engine('PR') as ProtocolProxy;
        expect($protocol.name().split(':')[0]).toEqual('protocol-proxy');
        expect($protocol.endpoint()).toEqual(`${BACKBONE}/protocol`);
        //! invoke by protocol format.
        $protocol
            .do_execute('lemon://lemon-hello-api/hello')
            .then((_: any) => {
                expect(Array.isArray(_.list)).toEqual(true);
                expect(_.name).toEqual('lemon');
                done();
            })
            .catch((e: Error) => {
                expect(e.message).toEqual('connect ECONNREFUSED 127.0.0.1:8081');
                done();
            });
    });

    //! cron-proxy
    test('test cron-proxy', () => {
        const $cron = $engine('CR') as CronProxy;
        expect($cron.name().split(':')[0]).toEqual('cron-proxy');
        expect($cron.endpoint()).toEqual(`${BACKBONE}/cron`);
    });

    //! agw-proxy
    test('test agw-proxy', () => {
        const $agw = $engine('AG') as AGWProxy;
        expect($agw.name().split(':')[0]).toEqual('agw-proxy');
        expect($agw.endpoint()).toEqual(`${BACKBONE}/agw`);
    });
});
