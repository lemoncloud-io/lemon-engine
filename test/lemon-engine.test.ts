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
//! build engine.
const $engine: LemonEngine = engine(scope, {
    name: 'test-engine',
    env: { LS, STAGE, DUMMY, MS_ENDPOINT: `${BACKBONE}/mysql`, WS_ENDPOINT: `${BACKBONE}/web` },
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
        $http.do_get('').then((_: any) => {
            expect(`${_}`.split('/')[0]).toEqual('lemon-backbone-api');
            done();
        });
    });

    //! web-proxy
    test('test web-proxy', (done: any) => {
        const $web = $engine.createWebProxy('backbone-web', BACKBONE);
        expect($web.name().split(':')[0]).toEqual('web-proxy');
        $web.do_get(BACKBONE, '/').then((_: any) => {
            expect(`${_}`.split('/')[0]).toEqual('lemon-backbone-api');
            done();
        });
    });

    //! mysql-proxy
    // NOTE! create table `CREATE TABLE test_seq (id int(10) unsigned NOT NULL AUTO_INCREMENT, PRIMARY KEY ('id'));`
    test('test mysql-proxy', (done: any) => {
        const $mysql = $engine('MS') as MysqlProxy;
        expect($mysql.name().split(':')[0]).toEqual('mysql-proxy');
        $mysql.do_get_next_id('test').then((a: number) => {
            return $mysql.do_get_next_id('test').then((b: number) => {
                expect(`${b - a}`).toEqual('1');
                done();
            });
        });
    });

    //! dynamo-proxy
    test('test dynamo-proxy', () => {
        const $dynamo = $engine('DS') as DynamoProxy;
        expect($dynamo.name().split(':')[0]).toEqual('dynamo-proxy');
    });

    //! redis-proxy
    test('test redis-proxy', () => {
        const $redis = $engine('RS') as RedisProxy;
        expect($redis.name().split(':')[0]).toEqual('redis-proxy');
    });

    //! elastic6-proxy
    test('test elastic6-proxy', () => {
        const $redis = $engine('ES6') as Elastic6Proxy;
        expect($redis.name().split(':')[0]).toEqual('elastic6-proxy');
    });

    //! s3-proxy
    test('test s3-proxy', () => {
        const $s3 = $engine('S3') as S3Proxy;
        expect($s3.name().split(':')[0]).toEqual('s3-proxy');
    });

    //! sqs-proxy
    test('test sqs-proxy', () => {
        const $sqs = $engine('SS') as SQSProxy;
        expect($sqs.name().split(':')[0]).toEqual('sqs-proxy');
    });

    //! sns-proxy
    test('test sns-proxy', () => {
        const $sns = $engine('SN') as SNSProxy;
        expect($sns.name().split(':')[0]).toEqual('sns-proxy');
    });

    //! ses-proxy
    test('test ses-proxy', () => {
        const $ses = $engine('SE') as SESProxy;
        expect($ses.name().split(':')[0]).toEqual('ses-proxy');
    });

    //! cognito-proxy
    test('test cognito-proxy', () => {
        const $cognito = $engine('CS') as CognitoProxy;
        expect($cognito.name().split(':')[0]).toEqual('cognito-proxy');
    });

    //! lambda-proxy
    test('test lambda-proxy', () => {
        const $lambda = $engine('LS') as LambdaProxy;
        expect($lambda.name().split(':')[0]).toEqual('lambda-proxy');
    });

    //! protocol-proxy
    test('test protocol-proxy', () => {
        const $protocol = $engine('PR') as ProtocolProxy;
        expect($protocol.name().split(':')[0]).toEqual('protocol-proxy');
    });

    //! cron-proxy
    test('test cron-proxy', () => {
        const $cron = $engine('CR') as CronProxy;
        expect($cron.name().split(':')[0]).toEqual('cron-proxy');
    });

    //! agw-proxy
    test('test agw-proxy', () => {
        const $agw = $engine('AG') as AGWProxy;
        expect($agw.name().split(':')[0]).toEqual('agw-proxy');
    });
});
