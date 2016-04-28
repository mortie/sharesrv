"use strict";
var handlebars = require("handlebars");
var fs = require("fs");

module.exports = template;

//Custom helpers
handlebars.registerHelper("escape", function(val, options) {
	return escape(val);
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

/*
 * Templates
 */
function template(name, state, ctx) {
	if (!template.index)
		template.index = handlebars.compile(fs.readFileSync("index.hbs", "utf8"));
	if (!template.compiled)
		template.compiled = {};

	ctx = ctx || {};

	var view = template.compiled[name];
	if (!view) {
		console.log("loading");
		view = handlebars.compile(fs.readFileSync("views/"+name+".hbs", "utf8"));
		template.compiled[name] = view;
	}

	var obj = {
		view: view(ctx),
		viewname: name
	}
	for (var i in state) {
		obj[i] = state[i];
	}
	return template.index(obj);
}
