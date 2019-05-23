import { Request, Response, Router, NextFunction } from 'express';
import { LemonStandardApi } from '../common/types';

import { APIGatewayProxyEvent, Context } from 'aws-lambda';

//! Name Space.
const NS = 'RTRS';
import { _log, _inf, _err } from '../common/logger';

/** ********************************************************************************************************************
 *  COMMON Functions.
 ** ********************************************************************************************************************/
const middleware = (req: Request, res: Response, next: NextFunction) => {
    // middleware
    _log(NS, `Request type: ${req.method}`);
    _log(NS, `Request from: ${req.originalUrl}`);
    next();
};

function buildResponse(statusCode: number, body: any) {
    //@0612 - body 가 string일 경우, 응답형식을 텍스트로 바꿔서 출력한다.
    return {
        statusCode: statusCode,
        headers: {
            'Content-Type': typeof body == 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*', // Required for CORS support to work
            'Access-Control-Allow-Credentials': true, // Required for cookies, authorization headers with HTTPS
        },
        body: typeof body == 'string' ? body : JSON.stringify(body),
    };
}

function success(body: any) {
    return buildResponse(200, body);
}

function notfound(body: any) {
    return buildResponse(404, body);
}

function failure(body: any) {
    return buildResponse(503, body);
}

/**
 * clear internal properties.
 */
function cleanup(body: any) {
    return Object.keys(body).reduce(function($N, key) {
        if (key.startsWith('_')) delete $N[key];
        if (key.startsWith('$')) delete $N[key];
        return $N;
    }, body);
}

/**
 * 'aws-serverless-express/middleware'.eventContext()를 통해서, apiGateway의 객체 정보를 얻을 수 있음.
 */
interface MyRequest extends Request {
    //! only for lambda + api-gateway with 'aws-serverless-express/middleware'
    apiGateway?: { event?: APIGatewayProxyEvent; context?: Context };
}

/**
 * Helper function to map routes.
 *
 * @param func LemonStandardApi
 */
export const handleRequest = (func: LemonStandardApi) => (req: MyRequest, res: Response) => {
    // event, context, callback
    const { id } = req.params;
    const params = req.query;
    const body = req.body;

    const agw = req.apiGateway;
    // _inf(NS, '! agw =', agw);

    //TODO - translate `identity` 정보를 얻음. (simple, jwt, cognitoIdentity)
    //  - http 호출시 해더에 x-lemon-identity = '{"ns": "SS", "sid": "SS000002", "uid": "", "gid": "", "role": "guest"}'
    //  - lambda 호출시 requestContext.identity = {"ns": "SS", "sid": "SS000002", "uid": "", "gid": "", "role": "guest"}
    // _log(NS,'headers['+HEADER_LEMON_IDENTITY+']=', event.headers[HEADER_LEMON_IDENTITY]);
    const identity: any = (agw && agw.event && agw.event.requestContext && agw.event.requestContext.identity) || {};

    //! call target function.
    const ctx = { source: 'express', identity };
    return func(id, params, body, ctx)
        .then((_: any) => {
            //! cleanup internals.
            if (_ && typeof _ === 'object') _ = cleanup(_);
            return success(_);
        })
        .catch((e: Error) => {
            const message = (e && e.message) || '';
            if (message.startsWith('404 NOT FOUND')) {
                return notfound(e.message);
            } else {
                _err(NS, '!!! callback err=', e);
                return failure(message);
            }
        })
        .then((data: any) => {
            if (data.headers) {
                Object.keys(data.headers).map(k => {
                    res.setHeader(k, data.headers[k]);
                });
            }
            const body = data.body || '';
            res.setHeader('Content-Type', 'application/json');
            res.status(data.statusCode || 200).send(body);
        });
};

/** ********************************************************************************************************************
 *  Router Config
 ** ********************************************************************************************************************/
import helloRouter from './hello';
import testRouter from './test';
import { agent } from 'supertest';

const routes: Router = Router();

routes.use('/hello', helloRouter);
routes.use('/test', testRouter);

export default routes;
