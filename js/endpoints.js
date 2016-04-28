"use strict";
var urllib = require("url");
var fs = require("fs");
var template = require("./template");
var getmimetype = require("./getmimetype");
var streamfile = require("./streamfile");

function fileHeaders(path, cb) {
	getmimetype(path, function(mime) {
		var name = path.match(/\/[^\/]+$/)[0].substring(1);
		cb({
			"content-type": mime,
			"content-disposition": "attachment; filename="+name,
			"icy-name": name
		});
	});
}

var endpoints = {
	"get /": function(req, res) { res.redirect("/list/") },

	"post /login": function(req, res, sharer, conf) {
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

	"get /share/:rel(*)": function(req, res, sharer, conf) {
		var rel = req.params.rel || "/";

		if (!req.hasPermission(rel))
			return res.errs.notLoggedIn();

		var key = sharer.share(rel, conf.timeout);

		var path = sharer.toAbs(rel);
		fs.stat(path, function(err, stat) {
			if (err)
			return res.error(err);

		if (stat.isDirectory())
			res.redirect("/list/"+key);
		else
			res.redirect("/view/"+key);
		});
	},

	"head /dl/:rel(*)": function(req, res, sharer) {
		var rel = req.params.rel || "/";

		if (!req.hasPermission(rel))
			return res.end("You must be logged in to see this.");

		var path = sharer.toAbs(rel);
		res.setHeaders(fileHeaders(path));
		res.end();
	},

	"get /dl/:rel(*)": function(req, res, sharer) {
		var rel = req.params.rel || "/";

		if (!req.hasPermission(rel))
			return res.errs.notLoggedIn();

		var path = sharer.toAbs(rel);
		fileHeaders(path, function(headers) {
			streamfile(req, res.res, path, headers);
		});
	},

	"get /get/:rel(*)": function(req, res, sharer) {
		var rel = req.params.rel || "/";

		if (!req.hasPermission(rel))
			return res.errs.notLoggedIn();

		var path = sharer.toAbs(rel);

		getmimetype(path, function(mime) {
			streamfile(req, res.res, path, {
				"content-type": mime
			});
		});
	},

	"get /view/:rel(*)": function(req, res, sharer, conf) {
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

	"get /list/:rel(*)?": function(req, res, sharer, conf) {
		var rel = req.params.rel || "/";

		// We need a / at the end because we're listing a directory.
		if (req.url[req.url.length - 1] !== "/")
			return res.redirect(req.url+"/");

		// Don't allow people who aren't logged in to see
		// things which aren't shared
		if (!req.hasPermission(rel))
			return res.errs.notLoggedIn();

		sharer.readdir(rel, function(err, files) {
			if (err) return res.error(err);

			// Transform the file objects into something
			// the template understands
			files = files.map(file => {
				return {
					name: file.name,
				  type: file.stat.isFile() ? "file" : "dir",
				  isDir: file.stat.isDirectory(),
				  isFile: file.stat.isFile(),
				  isShared: file.isShared()
				}
			});

			// Sort alphabetically, with dirs on top and files below
			files.sort(function(a, b) {
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
		});
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
		app[method](target, function(req, res) {

			req.hasPermission = function(rel) {
				return req.session.loggedIn || sharer.isShared(rel || "/");
			}

			var response = {
				res: res,

			status: 200,
			headers: {
				"content-type": "text/html"
			},

			redirect: function(loc) {
				res.writeHead(302, { location: loc });
				res.end();
			},

			template: function(name, ctx) {
				response.end(template(name, req.session, ctx));
			},

			error: function(err) {
				response.template("err", { msg: err });
			},

			errs: {
				notLoggedIn: () =>
					response.error("You must be logged in to see this.")
			},

			writeHead: function() {
				res.writeHead(response.status, response.headers);
			},

			setHeaders: function(obj) {
				for (var i in obj) {
					response.headers[i] = obj[i].toLowerCase();
				}
			},

			end: function(str) {
				response.writeHead();
				res.end(str);
			},

			write: function(str) {
				res.write(str);
			}
			}

			// Run the specific endpoint
			console.log(req.method, req.url);
			endpoints[i](req, response, sharer, conf);
		});
	});
}
