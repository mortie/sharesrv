var express = require("express");
var handlebars = require("handlebars");
var fs = require("fs");
var crypto = require("crypto");
var pathlib = require("path");
var textorbinary = require("istextorbinary");
var urllib = require("url");

process.on("unhandledRejection", function(err) {
	console.trace(err);
});

var File = require("./js/file.js");

var conf = JSON.parse(fs.readFileSync("conf.json"));

var shared = {frompath: {}};

//Custom helpers
handlebars.registerHelper("urlenc", function(val, options) {
	return encodeURIComponent(val).replace(/'/g, "%27");
});
handlebars.registerHelper("ifeq", function(val1, val2, options) {
	if (val1 === val2)
		return options.fn(this);
});
handlebars.registerHelper("ifneq", function(val1, val2, options) {
	if (val1 !== val2)
		return options.fn(this);
});
handlebars.registerHelper("arrdots", function(index, arr, options) {
	var str = "";
	for (var i = index + 1, l = arr.length; i < l; ++i) {
		str += "../";
	}
	return str;
});

function series(funcs) {
	var i = 0;

	function next(res) {
		funcs[i++](res, next);
	}

	funcs[i++](next);
}

function template(name, state, ctx) {
	if (!template.index)
		template.index = handlebars.compile(fs.readFileSync("index.hbs", "utf8"));
	if (!template.compiled)
		template.compiled = {};

	ctx = ctx || {};

	var view = template.compiled[name];
	if (!view) {
		view = handlebars.compile(fs.readFileSync("views/"+name+".hbs", "utf8"));
		template.compiled[name] = view;
	}

	var obj = state;
	obj.view = view(ctx);
	obj.viewname = name;
	obj.conf = conf;
	return template.index(obj);
}

function getmime(path) {
	var ext = pathlib.extname(path).substring(1);
	switch (ext) {
	case "html":
	case "htm":
		return "text/html";

	case "js":
		return "application/javascript";

	case "css":
		return "text/css";

	case "mp4":
	case "ogv":
	case "webm":
	case "mkv":
	case "avi":
	case "wav":
		return "video/"+ext;

	case "mp3":
	case "m4a":
	case "ogg":
	case "aac":
	case "flac":
		return "audio/"+ext;

	case "jpg":
	case "jpeg":
	case "png":
	case "gif":
		return "image/"+ext;

	case "md":
	case "mdn":
	case "txt":
	case "java":
	case "py":
	case "xml":
		return "text/plain";

	default:
		return "application/octet-stream";
	}
}

function streamfile(req, res, path) {

	fs.stat(path, function(err, stat) {

		var range = req.headers.range;

		var parts;
		if (range)
			parts = range.replace("bytes=", "").split("-");
		else
			parts = [0];

		var start = parseInt(parts[0]) || 0;
		var end;
		if (parts[1])
			end = Math.min(parseInt(parts[1]), stat.size - 1);
		else
			end = stat.size - 1;

		var chunksize = (end - start) + 1;

		res.writeHead(range ? 206 : 200, {
			"Content-Range": "bytes " + start + "-" + end + "/" + stat.size,
			"Accept-Ranges": "bytes",
			"Content-Length": chunksize,
			"Content-Type": getmime(path),
			"Icy-Name": pathlib.basename(path)
		});

		fs.createReadStream(path, {start: start, end: end}).pipe(res);
	});
}

function rand() {
	return crypto.randomBytes(16).toString("hex");
}

function error(req, res, msg) {
	res.end(template("err", req.session, { msg: msg.toString() }));
}

function getRealPath(path, relative) {
	var key = path.split("/")[0];
	if (shared[key])
		path = path.replace(key, shared[key]);

	if (relative)
		return path;
	else
		return pathlib.join(conf.path, path);
}

function isSharedPath(path) {
	path = getRealPath(path, true);
	for (var i in shared) {
		var p = shared[i];
		if (typeof p !== "string")
			continue;

		if (path.indexOf(p) === 0)
			return true;
	}
	return false;
}

var app = express();
app.use(require("express-session")({
	resave: false,
	saveUninitialized: false,
	secret: crypto.randomBytes(32).toString("hex")
}));
app.use(express.static("web"));
app.use(require("body-parser").urlencoded({extended: false}));
app.listen(conf.port);

app.get("*", function(req, res, next) {
	if (req.session.loggedIn === undefined)
		req.session.loggedIn = false;

	next();
});

app.get("/", function(req, res) {
	res.writeHead(302, { location: "/list" });
	res.end();
});

app.post("/login", function(req, res) {
	console.log(req.body.username, req.body.password);
	if (req.body.username === conf.username && req.body.password === conf.password) {
		req.session.loggedIn = true;

		var referer = req.headers.referer;
		var redir;
		if (!referer || urllib.parse(referer).path.indexOf("/login"))
			redir = referer;
		else
			redir = "/";
		console.log(redir);

		res.writeHead(302, { location: redir });
		res.end();
	} else {
		error(req, res, "Invalid username or password.");
	}
});

app.get("/view/:key", function(req, res) {
	var key = req.params.key;
	var relpath = shared[req.params.key];

	if (!relpath) {
		res.writeHead(404);
		error(req, res, "404");
		return;
	}

	var path = pathlib.join(conf.path, shared[key]);
	var stream = fs.createReadStream(path);
	stream.pipe(res);
	stream.on("error", function(err) {
		if (err.code === "EISDIR") {
			res.writeHead(302, { location: "/list/"+req.params.key});
			res.end();
		} else {
			res.writeHead(500);
			res.end(err.toString());
		}
	});
});

app.get("/share/:path(*)", function(req, res) {
	if (!req.session.loggedIn)
		return error(req, res, "Not logged in.");

	var path = getRealPath(req.params.path, true);

	var key;
	if (shared.frompath[path]) {
		key = shared.frompath[path];
	} else {
		key = rand();
		shared[key] = path;
		shared.frompath[path] = key;
	}

	res.writeHead(302, {
		location: "/view/"+key
	});
	res.end();

	//Unshare after some time
	setTimeout(function() {
		delete shared[key];
		delete shared.frompath[path];
	}, conf.timeout);
});

app.head("/list/:path(*)", function(req, res) {
	var path = req.params.path || "/";
	var realpath = getRealPath(path);
	res.writeHead(200, {
		"Content-Type": getmime(realpath)
	});
	res.end("hey there");
});

app.get("/list/:path(*)?", function(req, res) {
	var path = req.params.path || "/";
	var realpath = getRealPath(path);
	var dir = new File(realpath);

	var isShared = isSharedPath(path);

	if (!req.session.loggedIn && !isShared) {
		res.writeHead(200);
		error(req, res, "You must be logged in to see this.");
		return;
	}

	series([
	function stat(next) {
		dir.stat().then(next, function(err) { error(req, res, err); });
	},

	function read(stat, next) {
		if (stat.isDirectory() && req.url[req.url.length - 1] !== "/") {
			res.writeHead(302, { location: req.url + "/" });
			res.end();
			return;
		}

		if (stat.isFile()) {
			streamfile(req, res, realpath);
		} else {
			dir.readdir().then(next, function(err) { error(req, res, err); });
		}
	},

	function mkfiles(files, next) {
		var promises = files.map(function(file) {
			return new Promise(function(resolve, reject) {
				file.stat().then(function(stat) {
					resolve({
						name: file.basename,
						type: stat.isFile() ? "file" : "dir",
						isdir: stat.isDirectory(),
						isfile: stat.isFile()
					});
				});
			});
		});

		Promise.all(promises)
			.then(next, function(err) { error(req, res, err); });
	},

	function draw(files) {

		//Sort dirs to the top, and alphabetically
		files.sort(function(a, b) {
			if (a.type === "file" && b.type === "dir")
				return 1;
			else if (a.type === "dir" && b.type === "file")
				return -1;
			else
				return a.name > b.name ? 1 : -1;
		});

		res.end(template("list", req.session, {
			path: path.split("/").filter(function(p) { return p !== ""; }),
			base: path,
			files: files,
			isshared: isShared,
			loggedIn: req.session.loggedIn
		}));
	}]);
});

console.log("Server listening on port "+conf.port);
