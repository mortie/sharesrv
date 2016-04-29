"use strict";
var urllib = require("url");
var fs = require("fs");
var template = require("./template");
var getmimetype = require("./getmimetype");
var streamfile = require("./streamfile");

function fileHeaders(path, cb) {
	getmimetype(path, (mime) => {
		var name = path.match(/\/[^\/]+$/)[0].substring(1);
		cb({
			"content-type": mime,
			"content-disposition": "attachment; filename="+name,
			"icy-name": name
		});
	});
}

var endpoints = {
	"get /": (req, res) => { res.redirect("/list/") },

	"post /login": (req, res, sharer, conf) => {
		if ((req.body.username === conf.username)
		&&  (req.body.password === conf.password)) {
			req.session.loggedIn = true;

			// Redirect to wherever the user came from if possible
			var referer = req.headers.referer;
			var redir;
			if (referer && urllib.parse(referer).path.indexOf("/login") === -1) {
				redir = referer;
			} else {
				redir = "/list/";
			}

			res.redirect(redir);
		} else {
			res.error("Invalid username or password.");
		}
	},

	"get /share/:rel(*)": (req, res, sharer, conf) => {
		var rel = req.params.rel || "/";

		if (!req.hasPermission(rel))
			return res.errs.notLoggedIn();

		var key = sharer.share(rel, conf.timeout);

		var path = sharer.toAbs(rel);
		fs.stat(path, (err, stat) => {
			if (err)
			return res.error(err);

			if (stat.isDirectory())
				res.redirect("/list/"+key);
			else
				res.redirect("/view/"+key);
		});
	},

	"head /dl/:rel(*)": (req, res, sharer) => {
		var rel = req.params.rel || "/";

		if (!req.hasPermission(rel))
			return res.end("You must be logged in to see this.");

		var path = sharer.toAbs(rel);
		fileHeaders(path, (headers) => {
			res.setHeaders(headers);
			res.end();
		});
	},

	"get /dl/:rel(*)": (req, res, sharer) => {
		var rel = req.params.rel || "/";

		if (!req.hasPermission(rel))
			return res.errs.notLoggedIn();

		var path = sharer.toAbs(rel);
		fileHeaders(path, (headers) => {
			streamfile(req, res.res, path, headers);
		});
	},

	"get /get/:rel(*)": (req, res, sharer) => {
		var rel = req.params.rel || "/";

		if (!req.hasPermission(rel))
			return res.errs.notLoggedIn();

		var path = sharer.toAbs(rel);

		getmimetype(path, (mime) => {
			streamfile(req, res.res, path, {
				"content-type": mime
			});
		});
	},

	"get /view/:rel(*)": (req, res, sharer, conf) => {
		var rel = req.params.rel || "/";

		// Don't allow people who aren't logged in to see
		// things which aren't shared
		if (!req.hasPermission(rel))
			return res.errs.notLoggedIn();

		var pathparts = rel.split("/").filter(p => p !== "");
		var name = pathparts.pop();

		var base;
		if (rel.indexOf("/") == -1)
			base = "";
		else
			base = rel.replace(/\/[^\/]+$/, "/");

		res.template("view", {
			path: pathparts,
			base: base,
			name: name,
			isShared: sharer.isShared(rel),
			loggedIn: req.session.loggedIn
		});
	},

	"get /list/:rel(*)?": (req, res, sharer, conf) => {
		var rel = req.params.rel || "/";

		// We need a / at the end because we're listing a directory.
		if (req.url[req.url.length - 1] !== "/")
			return res.redirect(req.url+"/");

		// Don't allow people who aren't logged in to see
		// things which aren't shared
		if (!req.hasPermission(rel))
			return res.errs.notLoggedIn();

		sharer.readdir(rel, (err, files) => {
			if (err) return res.error(err);

			// Get a .vids file if it exists
			var watched = [];
			var watchedFile = files.filter(f => f.name === ".vids")[0];
			if (watchedFile) {
				fs.readFile(watchedFile.abs, "utf-8", (err, content) => {
					watched = content.split("\n");
					draw(files, watched)
				});
			} else {
				draw(files, watched);
			}
		});

		function draw(files, watched) {

			// Remove broken files
			files = files.filter(f => !f.stat.err);

			// Transform the file objects into something
			// the template understands
			files = files.map(file => {
				return {
					name: file.name,
					type: file.stat.isFile() ? "file" : "dir",
					isDir: file.stat.isDirectory(),
					isFile: file.stat.isFile(),
					isShared: file.isShared(),
					isWatched: watched.indexOf(file.name) !== -1
				}
			});

			// Sort alphabetically, with dirs on top and files below
			files.sort((a, b) => {
				if (a.type === "file" && b.type === "dir")
				return 1;
				else if (a.type === "dir" && b.type === "file")
				return -1;
				else
				return a.name > b.name ? 1 : -1;
			});

			// Template!
			res.template("list", {
				path: rel.split("/").filter(p => p !== ""),
				base: rel,
				files: files,
				isShared: sharer.isShared(rel),
				loggedIn: req.session.loggedIn
			});
		}
	}
}

module.exports = function(sharer, conf, app) {

	// Go over all the endpoints to add them
	Object.keys(endpoints).forEach(i => {

		// Endpoint keys are "<method> <target>"
		var parts = i.split(" ");
		var method = parts[0];
		var target = parts[1];

		// Add the endpoint, and add some utility functions
		app[method](target, (req, res) => {

			req.hasPermission = (rel) => {
				return req.session.loggedIn || sharer.isShared(rel || "/");
			}

			var response = {
				res: res,

			status: 200,
			headers: {
				"content-type": "text/html"
			},

			redirect: (loc) => {
				res.writeHead(302, { location: loc });
				res.end();
			},

			template: (name, ctx) => {
				response.end(template(name, req.session, ctx));
			},

			error: (err) => {
				response.template("err", { msg: err });
			},

			errs: {
				notLoggedIn: () =>
					response.error("You must be logged in to see this.")
			},

			writeHead: () => {
				res.writeHead(response.status, response.headers);
			},

			setHeaders: (obj) => {
				for (var i in obj) {
					response.headers[i] = obj[i].toLowerCase();
				}
			},

			end: (str) => {
				response.writeHead();
				res.end(str);
			},

			write: (str) => {
				res.write(str);
			}
			}

			// Run the specific endpoint
			console.log(req.method, req.url);
			endpoints[i](req, response, sharer, conf);
		});
	});
}
