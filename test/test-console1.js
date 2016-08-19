var main = require("../");
const { fakeResponseObj, openDevToolsFocusURLPlayer, setupTestContentServer, testCleanup, testServer } = require("./testutils.js");
const { before, after } = require('sdk/test/utils');


exports["test console logging"] = function(assert, done) {
	openDevToolsFocusURLPlayer().then(function(panel) {
		var resp = new fakeResponseObj(assert, true, function() {
			// Page loaded, we're ready to call getConsoleLog()
			// we need a new fake response object for this second request
			var resp2 = new fakeResponseObj(assert, false, function () {
				var consoleOutput = JSON.parse(this.output).consoleLog;
				assert.equal(consoleOutput.length, 1, 'One console message was logged');
				assert.strictEqual(consoleOutput[0].message, 'foo http://127.0.0.1:8000/test/console1 bar', 'Console message text correct');
				assert.equal(consoleOutput[0].filename, 'http://127.0.0.1:8000/test/console1', 'Console message meta data: url correct');
				assert.equal(consoleOutput[0].lineNumber, 4, 'Console message meta data: lineNumber correct');
				assert.equal(consoleOutput[0].columnNumber, 1, 'Console message meta data: columnNumber correct');
				assert.strictEqual(consoleOutput[0].functionName, '', 'Console message meta data: functionName correct');
				assert.strictEqual(consoleOutput[0].level, 'log', 'Console message meta data: level correct');
				done();
				
			});
			panel.apishim.getConsoleLog({}, resp2);
			resp2.finish();
			//console.log(JSON.stringify(panel.apishim._requestLog, null, 2));
			//console.log(JSON.stringify(panel.apishim._errorLog), null, 2);
			//console.log(JSON.stringify(panel.apishim._consoleLog), null, 2);
			//console.log(this.output);
		});
		// First we trigger an open request, this will call the resp.finish() method
		// we defined above when navigation is done
		panel.apishim.open({url: 'http://' + testServer + '/test/console1'}, resp);
	});
}

before(exports, setupTestContentServer);
after(exports, testCleanup);

require("sdk/test").run(exports);
