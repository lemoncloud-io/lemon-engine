import { createApp } from '../../../src/app';
import request from 'supertest';

describe('hello', () => {
    it('should be tested on hello', () => {
        const a = 'hello';
        expect(a).toBe('hello');
    });

    it('It should response the GET method', done => {
        const app = createApp();
        request(app)
            .get('/hello')
            .then((res: any) => {
                expect(res.statusCode).toBe(200);
                done();
            });
    });
});
