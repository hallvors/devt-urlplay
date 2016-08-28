const { Cu, Ci } = require("chrome");
const { before, after } = require('sdk/test/utils');
const { getMostRecentBrowserWindow } = require("sdk/window/utils");
const { gDevTools } = Cu.import("resource://devtools/client/framework/gDevTools.jsm", {});
const { devtools } = Cu.import("resource://devtools/shared/Loader.jsm", {});

const {gDevToolsBrowser} = devtools.require("resource://devtools/client/framework/devtools-browser.js");
const {TargetFactory} = devtools.require("resource://devtools/client/framework/target");

var restServer = require("../lib/restServer.js"); // We re-use this to serve test content
var panelRef;
var testServerIP = "127.0.0.1";
var testServerPort = 8000;

exports.testServer = testServerIP + ":" + testServerPort;

function setupTestContentServer(){
	if(!restServer.isServerStarted(testServerIP, testServerPort)) {
		console.log('setting up server');
		restServer.startServer(testServerIP, testServerPort, "0.0.0.0", function(srv){
			// Serving some test requests
			srv.registerPathHandler("/test/example1", function(request, response) {
				response.setHeader("Content-Type", "text/html; charset=utf8", false);
				response.write("<!DOCTYPE html><html>\r\n<head><title>example1</title></head>\r\n<body>Test file 1</body>\r\n</html>");
			});
			srv.registerPathHandler("/test/console1", function(request, response) {
				response.setHeader("Content-Type", "text/html; charset=utf8", false);
				response.write("<!DOCTYPE html><html>\r\n<head><title>console1</title></head>\r\n<body>Console test file 1\r\n<script>console.log('foo ' + location.href + ' bar')</script>\r\n</body>\r\n</html>");
			});
			srv.registerPathHandler("/test/error1", function(request, response) {
				response.setHeader("Content-Type", "text/html; charset=utf8", false);
				response.write("<!DOCTYPE html><html>\r\n<head><title>error1</title></head>\r\n<body>Error logging test file 1\r\n<script>undefined('foo ' + location.href + ' bar') /* runtime error */</script>\r\n<script>void('foo ' + location.href ' bar'); /* compile error */</script>\r\n<script>throw ('foo ' + location.href + ' bar'); /* custom error */</script>\r\n</body>\r\n</html>");
			});
			srv.registerPathHandler("/test/ua1", function(request, response) {
				var http_ua = '';
				if(request.hasHeader("User-Agent")) {
					http_ua = request.getHeader("User-Agent");
				}
				response.setHeader("Content-Type", "text/html; charset=utf8", false);
				response.write("<!DOCTYPE html><html>\r\n<head><title>UA1</title></head>\r\n<body>User-Agent spoof test file 1. UA header: <pre>" + http_ua + "</pre>\r\n<script>document.write('<p>Seen by JS:</p><pre>' + navigator.userAgent + '</pre>');\r\nconsole.log('HTTP: " + http_ua.replace(/'/g, "\\'") + "');\r\nconsole.log('JS: ' + navigator.userAgent);</script>\r\n</body>\r\n</html>");
			});
			srv.registerPathHandler("/test/eval", function(request, response) {
				response.setHeader("Content-Type", "text/html; charset=utf8", false);
				response.write("<!DOCTYPE html><html>\r\n<head><title>eval1</title></head>\r\n<body>Eval test file\r\n<script>var a='A'; function one(){return 1;}</script>\r\n</body>\r\n</html>");
			});
			srv.registerPathHandler("/test/video1", function(request, response) {
				response.setHeader("Content-Type", "text/html; charset=utf8", false);
				response.write("<!DOCTYPE html><html>\r\n<head><title>video 1</title></head>\r\n<body>Video test file\r\n<script>window.videojs={}</script><video id=\"myVid\" class=\"bigvideo\"><source type=\"video/x-foo-mime\" src=\"/video/anim.foo.foo\"><source type=\"video/x-bar-mime\" src=\"/video/anim.foo.bar\"></video>\r\n</body>\r\n</html>");
			});
		});
	}
}

var fakeResponseObj = function(assert, expectAsync, finishMethod) {
	this.assert = assert;
	this.expectAsync = expectAsync;
	this.output = '';
	if(!finishMethod) {
		throw "Define a finishMethod with asserts"
	}
	this.finish = finishMethod;
}

fakeResponseObj.prototype.processAsync = function() {
	if(this.expectAsync) {
		this.assert.ok(true, "Async method triggered")
	} else {
		this.assert.fail(false, "Async method called for a request we don't expect async handling for");
	}
}

fakeResponseObj.prototype.write = function(str) {
	this.output += str;
}

fakeResponseObj.prototype._json = function(){
	return JSON.parse(this.output);
}

function openDevToolsFocusURLPlayer() {
	var w = getMostRecentBrowserWindow(), p;
	if(gDevToolsBrowser.hasToolboxOpened(w)) {
	    let target = TargetFactory.forTab(w.gBrowser.selectedTab);
	    let toolbox = gDevTools.getToolbox(target);
		p = new Promise(function(resolve, reject){
			toolbox.getPanelWhenReady("devtools_urlplay").then(function(panel) {
				panelRef = panel;
				resolve(panel);
			});
		});
	} else {
		console.log('no hasToolboxOpened');
		p = new Promise(function(resolve, reject) {
			gDevTools.once("toolbox-ready", function(evt, toolbox) {
				gDevTools.once("select-tool-command", function(){
					toolbox.getPanelWhenReady("devtools_urlplay").then(function(panel) {
						panelRef = panel;
						resolve(panel);
					});
				});
				gDevToolsBrowser.selectToolCommand(w.gBrowser, 'devtools_urlplay');
			});
		});
		gDevToolsBrowser.toggleToolboxCommand(w.gBrowser);
	}
	return p;	
}

function testCleanup(name, assert, callback){
	console.log('cleanup', name);
	panelRef.target.activeTab.navigateTo("about:blank");
	callback();

}

exports.testCleanup = testCleanup;
exports.setupTestContentServer = setupTestContentServer;
exports.fakeResponseObj = fakeResponseObj;
exports.openDevToolsFocusURLPlayer = openDevToolsFocusURLPlayer;
