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
const handle_user = (req, res) =>      handler.user(req.$event, req.$context, req.$callback);
const handle_group = (req, res) =>     handler.group(req.$event, req.$context, req.$callback);
const handle_chat = (req, res) =>      handler.chat(req.$event, req.$context, req.$callback);


/** ********************************************************************************************************************
 *  ROUTE SETTING
 ** *******************************************************************************************************************/
//! default app.
app.get('', (req, res)=>{
    res.status(200).send(package.name||'LEMON API');
});

//! user
app.get('/user',            middle, handle_user);
app.get('/user/:id',        middle, handle_user);
app.get('/user/:id/:cmd',   middle, handle_user);
app.put('/user/:id',        middle, handle_user);
app.put('/user/:cmd',       middle, handle_user);
app.post('/user/:id',       middle, handle_user);
app.delete('/user/:id',     middle, handle_user);

//! group
app.get('/group',            middle, handle_group);
app.get('/group/:id',        middle, handle_group);
app.get('/group/:id/:cmd',   middle, handle_group);
app.put('/group/:id',        middle, handle_group);
app.put('/group/:cmd',       middle, handle_group);
app.post('/group/:id',       middle, handle_group);
app.delete('/group/:id',     middle, handle_group);

//! chat
app.get('/chat',            middle, handle_chat);
app.get('/chat/:id',        middle, handle_chat);
app.get('/chat/:id/:cmd',   middle, handle_chat);
app.put('/chat/:id',        middle, handle_chat);
app.put('/chat/:cmd',       middle, handle_chat);
app.post('/chat/:id',       middle, handle_chat);
app.delete('/chat/:id',     middle, handle_chat);


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