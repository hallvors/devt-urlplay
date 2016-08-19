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
				assert.deepEqual(this._json().result, {"foo":"bar"}, "Returning object data (as JSON)");
				resp2 = new fakeResponseObj(assert, true, function(){
					assert.deepEqual(this._json().result, [1,2,"a","b", {"aCap": "A"}], "Returning array data (as JSON)");
					resp2 = new fakeResponseObj(assert, true, function(){
						var expected = (new Array(10000)).join("a");
						assert.strictEqual(this._json().result, expected, "Evaluating very long string");
						done();
					});
					panel.apishim.evaluate({script: "(new Array(10000)).join(\"a\")"}, resp2);
				});
				panel.apishim.evaluate({script: "JSON.stringify([1,2,\"a\",\"b\", {\"aCap\": \"A\"}])"}, resp2);

			});
			panel.apishim.evaluate({script: "JSON.stringify({'foo': 'bar'})"}, resp2);
		});
		// First we trigger an open request, this will call the resp.finish() method
		// we defined above when navigation is done
		panel.apishim.open({url: "http://" + testServer + "/test/eval"}, resp);
	});
}

before(exports, setupTestContentServer);
after(exports, testCleanup);

require("sdk/test").run(exports);
