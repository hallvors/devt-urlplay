var main = require("../");
const { fakeResponseObj, openDevToolsFocusURLPlayer, setupTestContentServer, testCleanup, testServer } = require("./testutils.js");
const { before, after } = require('sdk/test/utils');


exports["test error logging"] = function(assert, done) {
	openDevToolsFocusURLPlayer().then(function(panel) {
		var resp = new fakeResponseObj(assert, true, function() {
			// Page loaded, we're ready to call getErrorLog()
			// we need a new fake response object for this second request
			var resp2 = new fakeResponseObj(assert, false, function () {
				var wanted = [
  					{"errorMessage":"TypeError: undefined is not a function",
  					"sourceName":"http://" + testServer + "/test/error1",
  					"lineText":"","lineNumber":4,"columnNumber":1,
  					"strict":false,"category":"content javascript",
  					"errType":"exception"},
					{"errorMessage":"SyntaxError: missing ) in parenthetical",
					"sourceName":"http://" + testServer + "/test/error1",
					"lineText":"void('foo ' + location.href ' bar'); /* compile error */",
					"lineNumber":5,"columnNumber":28,"strict":false,
					"category":"content javascript","errType":"exception"},
					{"errorMessage":"uncaught exception: foo http://" + testServer + "/test/error1 bar",
					"sourceName":"","lineText":"","lineNumber":0,"columnNumber":0,
					"strict":false,"category":"content javascript","errType":"other"}
				];

				var consoleOutput = JSON.parse(this.output).errorLog;
				assert.equal(consoleOutput.length, 3, 'Three error messages were recorded');
				assert.deepEqual(consoleOutput, wanted, "Error details are correct");

				done();
				
			});
			panel.apishim.getErrorLog({}, resp2);
			resp2.finish();
		});
		// First we trigger an open request, this will call the resp.finish() method
		// we defined above when navigation is done
		panel.apishim.open({url: "http://" + testServer + "/test/error1"}, resp);
	});
}

before(exports, setupTestContentServer);
after(exports, testCleanup);

require("sdk/test").run(exports);
