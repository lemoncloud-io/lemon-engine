/**
 * app.ts
 * - standalone http service with express.
 * - refactored from /express.js
 *
 *
 * @author steve@lemoncloud.io
 * @date   2019-05-23
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
////////////////////////////////////////////////////////////////////////
// COMMON ENVIRONMENT LOADER
// import 'source-map-support/register';

//TODO - generate config.json out of package.json.
import config from './config.json';
const name = config.name || 'LEMON APP';
const version = config.version || '0.0.1';

//! load core modules of express.
import express, { RequestHandler } from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
// import cors from 'cors';
// import { join } from 'path';
//import * as compression from 'compression';

//! load routes.
//NOTE - IMPORTANT after loading env.
import routes from './routes';

//! Create Express App.
export function createApp(middle?: RequestHandler) {
    const app = express();
    // app.set('view engine', 'pug');
    // app.set('views', join(__dirname, '/views'));
    // app.use(compression());
    // app.use(cors());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    middle && app.use(middle);
    app.use(morgan('dev'));
    app.use(routes);

    //! Default App.
    app.get('', (req, res) => {
        res.status(200).send(`${name}/${version}`);
    });

    return app;
}
