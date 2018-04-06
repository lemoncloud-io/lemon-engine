/**
 * Express Server Application.
 * - standalone http service with express + nodemon.
 * 
 * run-server:
 * $ npm install -g nodemon
 * $ nodemon express.js
 */
const NS = 'EXPR';

const debug = require('debug')('lemon-engine');
const package = require('./package.json');
const express = require('express');
const http = require('http');
const url = require('url');

const app = express();
const server = http.createServer(app);
// const WebSocket = require('ws');

//! determine source target.
const env = process && process.env || {};
const STAGE = env['STAGE'] || env['NODE_ENV'] || env['ENV'] || 'local';
const IS_OP = (STAGE === 'prod' || STAGE === 'production' || STAGE === 'op');
const SRC = IS_OP ? './dist/' : './src/';

//! initialize environment via 'env.yml'
(function(env, file){
    const fs   = require('fs');
    const yaml = require('js-yaml');
    try {
        var doc = yaml.safeLoad(fs.readFileSync(file, 'utf8'));
        var env2 = doc && doc[STAGE]||{};
        // console.log(env2);
        Object.keys(env2).forEach((key)=>{
            if (env[key] === undefined){
                // console.log(''+key+'=', env2[key]);
                env[key] = env2[key];
            }
        })
        env.STAGE = STAGE;
    } catch (e) {
        console.error(e);
    }
})(env, 'env.yml');

//! load configuration.
const handler = require(SRC+'index')(global);

//! middle ware
const middle = (req, res, next) => {
    //! prepare event
    const event = {
        queryStringParameters : req.query||{},
        pathParameters : req.params,
        httpMethod: req.method,
        connection: req.connection,
        url: req.url,
        headers: req.headers,
        body: req.body
    }
    const context = {source:'express'};
    const callback = (err, data) => {
        if (data.headers){
            Object.keys(data.headers).map(k => {
                res.setHeader(k, data.headers[k]);
            })
        }
        const body = data.body||'';
        res.setHeader('Content-Type', 'application/json');
        res.status(data.statusCode||200)
            .send(data.body);
    }

    //! attach to req.
    req.$event = event;
    req.$context = context;
    req.$callback = callback;

    // _log(NS, 'params @1=', req.params);

    //! pass to next
    next();
};

//! handle request to handler.
const handle_dynamo = (req, res) =>     handler.dynamo(req.$event, req.$context, req.$callback);
const handle_elastic = (req, res) =>    handler.elastic(req.$event, req.$context, req.$callback);
const handle_mysql = (req, res) =>      handler.mysql(req.$event, req.$context, req.$callback);
const handle_redis = (req, res) =>      handler.redis(req.$event, req.$context, req.$callback);


/** ********************************************************************************************************************
 *  ROUTE SETTING
 ** *******************************************************************************************************************/
//! default app.
app.get('', (req, res)=>{
    res.status(200).send(package.name||'LEMON API');
});

//! WARN - MUST sync with 'serverless.yml'
//! dynamo
app.get('/dynamo',                  middle, handle_dynamo);
app.get('/dynamo/:type',            middle, handle_dynamo);
app.get('/dynamo/:type/:id',        middle, handle_dynamo);
app.get('/dynamo/:type/:id/:cmd',   middle, handle_dynamo);
app.put('/dynamo/:type/:id',        middle, handle_dynamo);
app.put('/dynamo/:type/:id/:cmd',   middle, handle_dynamo);
app.post('/dynamo/:type/:id',       middle, handle_dynamo);
app.delete('/dynamo/:type',         middle, handle_dynamo);

//! elastic
app.get('/elastic',                 middle, handle_elastic);
app.get('/elastic/:type',           middle, handle_elastic);
app.get('/elastic/:type/:id',       middle, handle_elastic);
app.get('/elastic/:type/:id/:cmd',  middle, handle_elastic);
app.put('/elastic/:type/:id',       middle, handle_elastic);
app.post('/elastic/:type/:id',      middle, handle_elastic);
app.post('/elastic/:type/:id/:cmd', middle, handle_elastic);
app.delete('/elastic/:type',        middle, handle_elastic);

//! mysql
app.get('/mysql',                   middle, handle_mysql);
app.get('/mysql/:type',             middle, handle_mysql);
app.get('/mysql/:type/:id',         middle, handle_mysql);
app.get('/mysql/:type/:id/:cmd',    middle, handle_mysql);
app.put('/mysql/:type/:id',         middle, handle_mysql);
app.post('/mysql/:type/:id',        middle, handle_mysql);
app.delete('/mysql/:type',          middle, handle_mysql);

//! redis
app.get('/redis',                   middle, handle_redis);
app.get('/redis/:type',             middle, handle_redis);
app.get('/redis/:type/:id',         middle, handle_redis);
app.get('/redis/:type/:id/:cmd',    middle, handle_redis);
app.put('/redis/:type/:id',         middle, handle_redis);
app.post('/redis/:type/:id',        middle, handle_redis);
app.delete('/redis/:type',          middle, handle_redis);


/** ********************************************************************************************************************
 *  SERVER LISTEN
 ** *******************************************************************************************************************/
//! finally listen to port.
if (server)
{
    //! fetch server post.
    const port = _get_run_param('-port', 3000);

    //! list port.
    server.listen(port, function listening() {
        _inf(NS, 'Server Listen on Port =', server.address().port);
    }).on('error', function(e){
        _err(NS, '!ERR - listen.err = ', e);
    })
    
	// get running parameter like -h api.
	function _get_run_param(o, defval){
		var argv = process.argv || [];		// use scope.
		var nm = '-'+o;
		var i = argv.indexOf(nm);
		if (i >= 0) {
			var ret = argv[i+1];
			//! decode param.
			if (typeof defval === 'boolean'){
				return ret === 'true' || ret === 't' || ret === 'y' || ret === '1';
			} else if (typeof defval === 'number'){
				return parseInt(ret);
			}
		}
		return defval;
	}
}