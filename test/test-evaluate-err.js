var main = require("../");
const { fakeResponseObj, openDevToolsFocusURLPlayer, setupTestContentServer, testCleanup, testServer } = require("./testutils.js");
const { before, after } = require("sdk/test/utils");

exports["test evaluate 2"] = function(assert, done) {
	openDevToolsFocusURLPlayer().then(function(panel) {
		var resp = new fakeResponseObj(assert, true, function(){
			var result = this._json();
			assert.ok(result.success, "We think we succeeded");
			// We evaluate a number of things..
			// Sorry about the callback hell..
			var resp2 = new fakeResponseObj(assert, true, function(){
				assert.strictEqual(this._json().result.message, "undefined is not a function", "Runtime error - message");
				assert.strictEqual(this._json().result.kind, "Error", "Runtime error - kind");
				assert.strictEqual(this._json().result.name, "TypeError", "Runtime error - name");
				resp2 = new fakeResponseObj(assert, true, function(){
					assert.strictEqual(this._json().result.message, "expected expression, got end of script", "Compile error - message");
					assert.strictEqual(this._json().result.kind, "Error", "Compile error - kind");
					assert.strictEqual(this._json().result.name, "SyntaxError", "Compile error - name");
					resp2 = new fakeResponseObj(assert, true, function(){
						assert.strictEqual(this._json().result.message, "wot?", "Custom error - message");
						assert.strictEqual(this._json().result.kind, "Exception", "Custom error - kind");
						assert.strictEqual(this._json().result.name, "CustomException", "Custom error - name");
						done();
					});
					panel.apishim.evaluate({script: "throw 'wot?'"}, resp2);
				});
				panel.apishim.evaluate({script: "foo("}, resp2);

			});
			panel.apishim.evaluate({script: "undefined()"}, resp2);
		});
		// First we trigger an open request, this will call the resp.finish() method
		// we defined above when navigation is done
		panel.apishim.open({url: "http://" + testServer + "/test/eval"}, resp);
	});
}

before(exports, setupTestContentServer);
after(exports, testCleanup);

require("sdk/test").run(exports);
