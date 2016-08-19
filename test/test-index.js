var main = require("../");
const { fakeResponseObj, openDevToolsFocusURLPlayer, setupTestContentServer, testCleanup, testServer } = require("./testutils.js");
const { before, after } = require('sdk/test/utils');

exports["test request log data"] = function(assert, done) {
  var the_promise = openDevToolsFocusURLPlayer();
  the_promise.then(function (panel){
  	var responseObj = new fakeResponseObj(assert, true, function(){
		var as = panel.apishim;
		var firstReqID = Object.keys(as._requestLog)[0];
		assert.equal(as._requestLog[firstReqID].request.url, "http://" + testServer + "/test/example1", "request URL is correct");
		assert.equal(as._requestLog[firstReqID].response.status, 200, "response.status is correct");
		assert.equal(as._requestLog[firstReqID].response.contentType, "text/html; charset=utf8", "response contentType is correct");
		assert.equal(as._consoleLog.length, 0, "no console messages logged on this page");
		assert.equal(as._errorLog.length, 0, "no errors logged on this page");
	  	done();
	});
  	panel.apishim.open({url:"http://" + testServer + "/test/example1"}, responseObj);
  }, function(err){console.log("ERROR", err)});
};

before(exports, setupTestContentServer);
after(exports, testCleanup);

require("sdk/test").run(exports);
