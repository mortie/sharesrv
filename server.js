"use strict";
var Sharer = require("./js/sharer");
var endpoints = require("./js/endpoints");
var fs = require("fs");
var express = require("express");
var crypto = require("crypto");

var conf = JSON.parse(fs.readFileSync("conf.json"));

var sharer = Sharer(conf.path);

var app = express();
app.use(require("express-session")({
	resave: false,
	saveUninitialized: false,
	secret: crypto.randomBytes(32).toString("hex")
}));
app.use(express.static("web"));
app.use(require("body-parser").urlencoded({extended: false}));
app.listen(conf.port);

app.get("*", (req, res, next) => {
	if (req.session.loggedIn === undefined)
		req.session.loggedIn = false;

	next();
});

endpoints(sharer, conf, app);
