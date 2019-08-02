//! import core engine.
import engine, { LemonEngine } from '../src/index';
import { MysqlProxy } from '../src/plugins/mysql-proxy';

//! common config
const scope = {};
const LS = '1';
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
});
