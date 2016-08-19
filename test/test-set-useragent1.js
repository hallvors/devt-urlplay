var main = require("../");
const { fakeResponseObj, openDevToolsFocusURLPlayer, setupTestContentServer, testCleanup, testServer } = require("./testutils.js");
const { before, after } = require("sdk/test/utils");

var ua1 = "Moz1lla/5.0 (AndroSheep 5.0; Mobile-TV) Gecko/23.0 Firefox/24.5";

exports["test set User-Agent"] = function(assert, done) {
	openDevToolsFocusURLPlayer().then(function(panel) {
		var resp = new fakeResponseObj(assert, false, function(){
			var result = JSON.parse(this.output);
			assert.ok(result.success, "We think we succeeded");
		});
		var resp2 = new fakeResponseObj(assert, true, function() {
			// This test page logs UA strings to the console
			// We will call getConsoleLog() to get some data to inspect
			var resp3 = new fakeResponseObj(assert, false, function () {

				var consoleOutput = JSON.parse(this.output).consoleLog;
				assert.equal(consoleOutput.length, 2, 'Two error messages were recorded');
				var actualHTTTPUA = consoleOutput[0].message;
				var actualJSUA = consoleOutput[1].message;
				assert.strictEqual(actualHTTTPUA, 'HTTP: ' + ua1); // prefixed HTTP: by page
				assert.strictEqual(actualJSUA, 'JS: ' + ua1); // prefixed JS: by page

				done();
				
			});
			panel.apishim.getConsoleLog({}, resp3);
			resp3.finish();
		});
		// Set UA before trying to load any page
		panel.apishim.setUserAgent({userAgent: ua1}, resp);
		resp.finish(); // sync, we have to call finish() ourselves..
		// First we trigger an open request, this will call the resp2.finish() method
		// we defined above when navigation is done
		panel.apishim.open({url: 'http://' + testServer + '/test/ua1'}, resp2);
	});
}

before(exports, setupTestContentServer);
after(exports, testCleanup);

require("sdk/test").run(exports);
