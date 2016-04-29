"use strict";
var crypto = require("crypto");
var pathlib = require("path");
var fs = require("fs");

module.exports = Sharer;

function SharedFile(rel, ttl, key) {
	var self = {};
	self.rel = rel;
	self.key = key;

	function ontimeout() {
		if (self.ontimeout) {
			self.ontimeout();
		} else {
			throw new Error("Timeout function not set for "+rel+"!");
		}
	}

	var timeout = setTimeout(ontimeout, ttl);

	self.resetTimeout = function() {
		clearTimeout(timeout);
		timeout = setTimeout(ontimeout, ttl);
	}

	return self;
}

function Sharer(dir) {
	var self = {};

	var shared = {};
	shared.keyFromRel = {};

	/*
	 * Expand keys into real relative paths
	 */
	function toRealRel(arg) {
		var rel;
		var possibleKey = arg.split("/")[0];
		if (shared[possibleKey]) {
			rel = arg.replace(possibleKey, shared[possibleKey].rel);
		} else {
			rel = arg;
		}
		return rel;
	}

	/*
	 * Return the absolute path from a relative path,
	 * with any keys expanded into real relative paths
	 */
	function toAbs(arg) {
		return pathlib.join(dir, toRealRel(arg));
	}

	/*
	 * Return if a relative path is shared or not
	 */
	function isShared(arg) {
		var key = arg.split("/")[0];
		if (shared[key]) return true;
		if (shared.keyFromRel[arg]) return true;
		return false;
	}

	/*
	 * If the file is already shared, reset its timeout.
	 * If it's not already shared, share it.
	 * Returns the key.
	 */
	function share(rel, ttl) {
		if (shared.keyFromRel[rel]) {
			var file = shared[shared.keyFromRel[rel]];
			file.resetTimeout();
			return file.key;
		} else {
			var key = crypto.createHash("sha1")
				.update(rel)
				.digest("base64")
				.substring(0, 20);

			var file = SharedFile(rel, ttl, key);
			shared[key] = file;
			shared.keyFromRel[rel] = key;

			file.ontimeout = function() {
				delete shared[key];
				delete shared.keyFromRel[rel];
			}
			return key;
		}
	}

	/*
	 * Get the files and directories in a directory.
	 * Calls back with an error object, and an array of file objects like this:
		 * name: the file's name,
		 * rel: the file's relative name,
		 * stat: the result of fs.stat(), or { err: error } on error,
		 * isShared: function, returns whether it's shared or not,
	 */
	function readdir(arg, cb) {
		var rel = toRealRel(arg);
		fs.readdir(toAbs(rel), (err, names) => {
			if (err) return cb(err);

			// Create neat file objects
			var files = names.map((name) => {
				var r = pathlib.join(rel, name);
				return {
					name: name,
					rel: r,
					abs: toAbs(r),
					stat: null,
					isShared: () => {
						return isShared(r);
					}
				}
			});

			// Stat all the files, because we'll probably need that
			var promises = files.map((file) => {
				return new Promise((resolve, reject) => {
					fs.stat(toAbs(file.rel), (err, stat) => {
						if (err) {
							file.stat = { err: err }
						} else {
							file.stat = stat;
						}
						resolve();
					});
				});
			});

			// Call back once all stats are done
			Promise.all(promises).then(() => cb(null, files));
		});
	}

	self.share = share;
	self.readdir = readdir;
	self.isShared = isShared;
	self.toAbs = toAbs;

	return self;
}
