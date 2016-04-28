function error(msg) {
	console.log(msg);
	alert(msg);
}
function createPopup(child) {
	var rm = document.querySelector("#popup");
	if (rm)
		rm.parentNode.removeChild(rm);

	var container = document.createElement("div");
	container.id = "popup";
	setTimeout(function() { container.className = "active" }, 10);

	var topbar = document.createElement("div");
	topbar.className = "topbar";
	container.appendChild(topbar);

	var closeBtn = document.createElement("button");
	closeBtn.innerHTML = "X";
	closeBtn.addEventListener("click", function() {
		container.className = "";
		setTimeout(function() {
			container.parentNode.removeChild(container);
		}, 1000);
	});
	topbar.appendChild(closeBtn);

	var content = document.createElement("div");
	content.className = "content";
	container.appendChild(content);

	content.appendChild(child);

	document.body.appendChild(container);
}

function createViewerBase(tag, src) {
	console.log("create viewer base with tag "+tag+" and src "+src);
	var base = document.createElement("div");

	var elem = document.createElement(tag);
	if (src)
		elem.src = src;
	elem.className = "elem";
	elem.style =
		"width: 100%;";

	return elem;
}

var viewers = {
	"video": function(path) {
		var elem = createViewerBase("video", path);
		elem.controls = true;
		elem.play();
		return elem;
	},

	"audio": function(path) {
		var elem = createViewerBase("audio", path);
		elem.controls = true;
		elem.play();
		return elem;
	},

	"image": function(path) {
		var elem = createViewerBase("img", path);
		return elem;
	},

	"text": function(path) {
		var elem = createViewerBase("pre");
		var code = document.createElement("code");
		elem.appendChild(code);

		var req = new Request(path);
		fetch(req, { credentials: "same-origin" }).then(function(res) {
			var contentType = res.headers.get("content-type");
			console.log(contentType);
			res.text().then(function(text) {
				code.textContent = text;
				if (contentType !== "text/plain")
					hljs.highlightBlock(elem);
			}).catch(error);
		});

		return elem;
	},

	"application/pdf": function(path) {
		var elem = createViewerBase("iframe", path);
		elem.height = (window.innerHeight * 0.8)+"px";
		return elem;
	}
}

function createViewer(path, cb) {
	console.log(path);
	var req = new Request(path, {
		method: "HEAD"
	});

	fetch(req, { credentials: "same-origin" }).then(function(res) {
		var mime = res.headers.get("Content-Type");

		if (viewers[mime]) {
			cb(null, viewers[mime](path));
		} else if (viewers[mime.split("/")[0]]) {
			cb(null, viewers[mime.split("/")[0]](path));
		} else {
			cb("Can't open files of type "+mime);
		}
	}).catch(error);
}

function popupView(path) {
	console.log(path);
	createViewer(path, function(err, elem) {
		if (err) return error(err);

		createPopup(elem);
	});
}
