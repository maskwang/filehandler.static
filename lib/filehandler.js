var fs = require('fs'),
	url = require('url'),
	path = require('path'),
	mimes = require('../cfg/mimes'),
	expires = require('../cfg/expires'),
	directories = require('../cfg/directories');

// streaming file to response
exports.onHandle = function(ctx) {
	var request = ctx.request;
	var response = ctx.response;
	var pathname = url.parse(request.url).pathname;
	
	// Get the full path of file.
	var directory;
	if( ctx.routeArgs && ctx.routeArgs[0] && ctx.routeArgs[0].path ) {
		// The routeArgs[0] is item route settings. It could be like:
		//	{
		//		module : 'filehandler',
		//		path : '{root}/htdocs'
		//	}
		directory = ctx.routeArgs[0].path.replace('{root}', ctx.rootDirectory);
	}else{
		var host = request.headers['host'];
		directory = directories[host] ? directories[host] : directories['*'];
	}
	
	if (directory) {
		var filename = directory + pathname;
		
		// Remove version in pathname.
		filename = filename.replace(/v_[a-z0-9]*\//i, '');
				
		var ext = path.extname(filename);

		// Set mime header
		var contentType = mimes[ext] ? mimes[ext] : mimes['*'];
		if (contentType) {
			response.setHeader('Content-Type', contentType ? contentType
					: 'application/octet-stream');
		}
	
		fs.stat(filename, function(err, stat) {
			if(err) {
				module.onError(ctx, 404, 'File Not Exist');
			}else{
				// Set expire header
				var maxAge = expires[ext] ? expires[ext] : expires['*'];
				if (maxAge) {
					var expiretime = new Date();
					expiretime.setTime(expiretime.getTime() + maxAge * 1000);
					response.setHeader("Expires", expiretime.toUTCString());
					response.setHeader("Cache-Control", "public, max-age=" + maxAge);
				}
		
				// Set last modified header
				var lastModified = stat.mtime.toUTCString();
				response.setHeader('Last-Modified', lastModified);
		
				// Process ifModifiedSince logic
				var ifModifiedSince = request.headers['if-modified-since'];
				if (ifModifiedSince && lastModified == ifModifiedSince) {
					response.writeHead(304, "Not Modified");
					response.end();
				} else {
					fs.readFile(filename, "binary", function(err, file) {
						if (err) {
							module.onError(ctx, 500, 'Internal Server Error');
						} else {
							response.writeHead(200, {
								'Content-Length' : file.length
							});
							response.write(file, "binary");
							response.end();
						}
					});
				}
			}
		});
	}else{
		module.onError(ctx, 404, 'File Not Found');
	}
};

//handle error request
module.onError = function(ctx, code, msg) {
	// Failed to handle the request.
	ctx.response.writeHead(code, msg);
	ctx.response.end();
};
