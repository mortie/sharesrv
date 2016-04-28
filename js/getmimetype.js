"use strict";
var pathlib = require("path");
var fs = require("fs");

function firstline(path, cb) {
	var acc = '';
	var pos = 0;
	var index;
	var rs = fs.createReadStream(path, {encoding: "utf-8"});
	rs
		.on('data', function (chunk) {
			index = chunk.indexOf('\n');
			acc += chunk;
			index !== -1 ? rs.close() : pos += chunk.length;
		})
		.on('close', function () {
			cb(null, acc.slice(0, pos + index));
		})
		.on('error', function (err) {
			cb(err);
		});
}

function mimefromname(name) {
	switch (name.toLowerCase()) {
	case "node":
	case "nodejs":
		return "text/javascript";
	case "python":
		return "text/x-python";
	case "ruby":
		return "text/x-ruby";
	case "sh":
	case "bash":
		return "text/x-shellscript";
	default:
		return "text/plain";
	}
}

function mimefromext(ext) {
	switch (ext.toLowerCase()) {

	case "pdf":
		return "application/pdf";

	case "html":
	case "htm":
	case "hbs":
		return "text/html";
	case "js":
		return "text/javascript";
	case "css":
		return "text/css";
	case "md":
	case "mdn":
		return "text/markdown";
	case "java":
		return "text/x-java";
	case "py":
		return "text/x-python";
	case "c":
	case "h":
		return "text/x-c";
	case "cpp":
	case "hpp":
		return "text/x-cpp";
	case "xml":
		return "text/xml";
	case "sql":
		return "text/x-sql";
	case "txt":
		return "text/plain";

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

	default:
		return null;
	}
}

module.exports = function(path, cb) {
	var ext = pathlib.extname(path).substring(1);
	var mime = mimefromext(ext);
	if (mime)
		return cb(mime);

	firstline(path, function(err, line) {
		if (err)
			return cb("application/octet-stream");

		var trimmed = line.trim();

		if (trimmed.indexOf("#!") === 0) {
			var nameparts = trimmed.split(" ")[0].split("/");
			var name = nameparts.pop();

			if (name === "env") {
				var progname = trimmed.split(" ")[1];
				cb(mimefromname(progname));
			} else {
				cb(mimefromname(name));
			}
		} else {
			cb("application/octet-stream");
		}
	});
}
