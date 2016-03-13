function error(msg) {
	console.log(msg);
	alert(msg);
}
function player(tag, src, preventActive) {
	var rm = document.querySelector("#player-container");
	if (rm)
		rm.parentNode.removeChild(rm);

	var container = document.createElement("div");
	container.id = "player-container";
	if (!preventActive) {
		setTimeout(function() { container.className = "active" }, 10);
	}

	var closeBtn = document.createElement("button");
	closeBtn.innerHTML = "X";
	closeBtn.addEventListener("click", function() {
		container.className = "";
		setTimeout(function() {
			container.parentNode.removeChild(container);
		}, 1000);
	});
	container.appendChild(closeBtn);

	var player = document.createElement("div");
	container.appendChild(player);

	document.body.appendChild(container);

	var elem = document.createElement(tag);
	elem.src = location.href+src;
	elem.className = "elem";
	elem.style =
		"width: 100%;";
	player.appendChild(elem);

	elem.show = function() {
		setTimeout(function() {
			container.className = "active";
		}, 100);
	}

	return elem;
}

var viewers = {
	"video": function(path) {
		var elem = player("video", path);
		elem.controls = true;
		elem.play();
	},

	"audio": function(path) {
		var elem = player("audio", path);
		elem.controls = true;
		elem.play();
	},

	"image": function(path) {
		var elem = player("img", path);
	},

	"text": function(path) {
		var elem = player("iframe", path, true);
		elem.addEventListener("load", function() {
			var elemBody = elem.contentWindow.document.querySelector("body");
			elem.height = Math.min(elemBody.scrollHeight, 500);
			elem.show();
		});
	}
}
function play(path) {
	var req = new Request(path, {
		method: "HEAD"
	});

	fetch(req).then(function(res) {
		var mime = res.headers.get("Content-Type");

		if (viewers[mime]) {
			viewers[mime](path);
		} else if (viewers[mime.split("/")[0]]) {
			viewers[mime.split("/")[0]](path);
		} else {
			error("Can't open files of type "+mime);
		}
	}).catch(error);
}
