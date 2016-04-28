var fs = require("fs");

module.exports = streamfile;

function streamfile(req, res, path, customHeaders) {
	fs.stat(path, function(err, stat) {
		if (err)
			return res.end(err.toString());

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

		var headers = {
			"content-range": "bytes " + start + "-" + end + "/" + stat.size,
			"accept-ranges": "bytes",
			"content-length": chunksize,
		};
		for (var i in customHeaders) {
			headers[i] = customHeaders[i];
		}

		res.writeHead(range ? 206 : 200, headers);
		fs.createReadStream(path, {start: start, end: end}).pipe(res);
	});
}
