//! import core engine.
import engine, { LemonEngine } from '../src/index';

//! build base engine to test.
const scope = {};
const STAGE = 'test';
const $engine: LemonEngine = engine(scope, {
    name: 'test-engine',
    env: { LS: '1', DUMMY: 'dummy', STAGE },
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
    test('test http-proxy', () => {
        const $proxy = $engine.createHttpProxy('backbone-http', 'http://localhost:8081');
        expect((done: any) =>
            $proxy.do_get('').then((_: any) => {
                expect(_).toEqual('lemon-backbone-api/2.1.4');
                done();
            }),
        );
    });

    //! web-proxy
    test('test web-proxy', () => {
        const $proxy = $engine.createWebProxy('backbone-web', 'http://localhost:8081');
        expect((done: any) =>
            $proxy.do_get('').then((_: any) => {
                expect(_).toEqual('lemon-backbone-api/2.1.4');
                done();
            }),
        );
    });
});
