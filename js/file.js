var fs = require("fs");
var pathlib = require("path");

function File(path) {
	this._path = path;
}

File.prototype = {
	get path() {
		return this._path;
	},

	get basename() {
		return pathlib.basename(this.path);
	},

	create: function() {
		return new Promise(function(resolve, reject) {
			fs.open(this.path, "a", function(err, fd) {
				if (err && err.code !== "EEXIST") {
					reject(err);
				} else {
					fs.close(fd, function(err) {
						if (err)
							reject(err);
						else
							resolve();
					});
				}
			});
		}.bind(this));
	},

	mkdir: function() {
		return new Promise(function(resolve, reject) {
			fs.mkdir(this.path, function(err) {
				if (err && err.code !== "EEXIST")
					reject(err);
				else
					resolve();
			});
		}.bind(this));
	},

	sub: function(subPath) {
		return new File(pathlib.join(this.path, subPath));
	},

	createReadStream: function(options) {
		return new Promise(function(resolve, reject) {
			var stream;
			try {
				stream = fs.createReadStream(this.path, options);
			} catch (err) {
				return reject(err);
			}

			//If options.fd exists, no open event will be emitted
			//because the file is already open
			if (options.fd) {
				resolve(stream);
			} else {
				stream.on("open", function() {
					resolve(stream);
				});
			}
		}.bind(this));
	},

	createWriteStream: function(options) {
		return new Promise(function(resolve, reject) {
			var stream;
			try {
				stream = fs.createWriteStream(this.path, options);
			} catch (err) {
				return reject(err);
			}

			//If options.fd exists, no open event will be emitted
			//because the file is already open
			if (options && options.fd) {
				resolve(stream);
			} else {
				stream.on("open", function() {
					resolve(stream);
				});
			}
		}.bind(this));
	},

	read: function(enc) {
		return new Promise(function(resolve, reject) {
			fs.readFile(this.path, enc, function(err, res) {
				if (err)
					reject(err);
				else
					resolve(res);
			});
		}.bind(this));
	},

	readdir: function() {
		return new Promise(function(resolve, reject) {
			fs.readdir(this.path, function(err, files) {
				if (err) {
					reject(err);
				} else {
					resolve(files.map(function(file) {
						return this.sub(file); 
					}.bind(this)));
				}
			}.bind(this));
		}.bind(this));
	},

	stat: function() {
		return new Promise(function(resolve, reject) {
			fs.stat(this.path, function(err, res) {
				if (err)
					reject(err);
				else
					resolve(res);
			});
		}.bind(this));
	},

	access: function(mode) {
		mode = mode || fs.F_OK;
		return new Promise(function(resolve, reject) {
			fs.access(this.path, mode, function(err) {
				if (err)
					resolve(false);
				else
					resolve(true);
			});
		}.bind(this));
	},

	write: function(str) {
		return new Promise(function(resolve, reject) {
			fs.writeFile(this.path, str, function(err) {
				if (err)
					reject(err);
				else
					resolve();
			});
		}.bind(this));
	},

	append: function(str) {
		return new Promise(function(resolve, reject) {
			fs.appendFile(this.path, str, function(err) {
				if (err)
					reject(err);
				else
					resolve();
			});
		}.bind(this));
	},

	rename: function(newPath) {
		return new Promise(function(resolve, reject) {
			fs.rename(this.path, newPath, function(err) {
				if (err) {
					reject(err);
				} else {
					this._path = newPath;
					resolve();
				}
			});
		}.bind(this));
	},

	chmod: function(mode) {
		return new Promise(function(resolve, reject) {
			fs.chmod(this.path, mode, function(err) {
				if (err)
					reject(err);
				else
					resolve();
			});
		});
	},

	chown: function(uid, gid) {
		return new Promise(function(resolve, reject) {
			fs.chown(uid, gid, function(err) {
				if (err)
					reject(err);
				else
					resolve();
			});
		});
	},

	rmdir: function() {
		return new Promise(function(resolve, reject) {
			fs.rmdir(this.path, function(err) {
				if (err)
					reject(err);
				else
					resolve();
			});
		});
	},

	unlink: function() {
		return new Promise(function(resolve, reject) {
			fs.unlink(this.path, function(err) {
				if (err)
					reject(err);
				else
					resolve(err);
			});
		});
	}
}

module.exports = File;
