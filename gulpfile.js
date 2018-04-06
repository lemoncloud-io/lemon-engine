/**
 * gulp configuration to build js
 * - minify /src to /dist
 * 
 * usage:
 * $ gulp dist
 * 
 * @auth steve (steve@lemoncloud.io)
 * @date 2018/04/06
 */
var path = require('path');
var gulp = require('gulp');
var concat = require('gulp-concat');
let babel = require('gulp-babel');          // for ES6
var uglify = require('gulp-uglify');
var empty = require("gulp-empty");
var change = require("gulp-change");
//var plug = require('gulp-load-plugins')();

// main configuration..
var conf = {
	'dist':{
		src: './src',
		dist: './dist',
		// dist: '../dist-host/test',
		tmp: '.tmp'
	},
}

//! main folder.
gulp.paths = conf['dist'];      // default as nano.
function set_conf(name){
	gulp.paths = conf[name]||{};
}

/////////////////////////////////////////////////////////////////////////////
// require('require-dir')('./gulp');
//- uglify the scripts files.
gulp.task('scripts', [], function() {
	//! function to build gulp pipe.
	function scripts(folder, noBabel){
		folder = folder ||'';
		return gulp.src([
			    path.join(gulp.paths.src, folder+'/*.js'),
			    '!'+path.join(gulp.paths.src, folder+'/*.min.js')
		    ])
            // .pipe(concat('all.min.js'))
            .pipe(noBabel ? empty() : babel({presets:['env']}))
            .pipe(uglify())
            .on('error', function (err) { console.error('error=', err); })
            //.pipe(uglify({preserveComments:'license'}))
            //.pipe(plug.uglify({preserveComments:'all'}))
            .pipe(gulp.dest(path.join(gulp.paths.dist, folder+'/')))
            // .pipe(gulp.dest(gulp.paths.dist))
	}

	//! returns target js files.
	return [scripts(''), scripts('/api'), scripts('/lib'), scripts('/service')];
	// return [scripts(''), scripts('/core')];
})

//- just copies of others
gulp.task('copy-all', function() {
	return gulp.src([
		path.join(gulp.paths.src, '/**/*'),
		'!'+path.join(gulp.paths.src, '/**/*.vscode'),
		'!'+path.join(gulp.paths.src, '/**/*.log')
	]).pipe(gulp.dest(gulp.paths.dist));
})

//- just copies of others
gulp.task('package', function() {
	const ver = require('./package.json').version||'0.0.1';
	console.log('#version =', ver);
	const myChange = (body)=>{
		body = body.trim();
		// console.log('> body=', typeof body, body);
		if (body.startsWith('{') && body.endsWith('}')){
			const $body = JSON.parse(body);
			// console.log('> body=', $body);
			console.log('> version =', ver,'<-',$body.version);
			if($body.version) 
				$body.version = ver;
			//TODO - sync dependencies version.
			body = JSON.stringify($body);
		}
		return body;
	}
	//! run copy & replace.
	return gulp.src([
		path.join(gulp.paths.src, '/package.json'),
		path.join(gulp.paths.src, '/README.md'),
	])
	.pipe(change(myChange))
	.pipe(gulp.dest(gulp.paths.dist));
})

//- default to build.
gulp.task('default', ['scripts', 'package']);

//! simple build.
gulp.task('simple', () =>
    gulp.src([
            //'src/**/*.js'
            path.join(gulp.paths.src, '/**/*.js'),
            '!'+path.join(gulp.paths.src, '/sample/*'),
            '!'+path.join(gulp.paths.src, '/**/*.log')
        ])
        // .pipe(sourcemaps.init())
        // .pipe(babel({presets: ['env']}))     // problem in core module.
        // .pipe(concat('all.js'))              // NOT GOOD due to exports
		.pipe(uglify())
		.on('error', function (err) { console.error('error=', err); })
        // .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist'))
);

