var main = require("../");
const { fakeResponseObj, openDevToolsFocusURLPlayer, setupTestContentServer, testCleanup, testServer } = require("./testutils.js");
const { before, after } = require("sdk/test/utils");

exports["test evaluate 1"] = function(assert, done) {
	openDevToolsFocusURLPlayer().then(function(panel) {
		var resp = new fakeResponseObj(assert, true, function(){
			var result = this._json();
			assert.ok(result.success, "We think we succeeded");
			// We evaluate a number of things..
			// Sorry about the callback hell..
			var resp2 = new fakeResponseObj(assert, true, function(){
				assert.strictEqual(this._json().result, 2, "Evaluating 1+1");
				resp2 = new fakeResponseObj(assert, true, function(){
					assert.strictEqual(this._json().result, "A", "Evaluating a (global variable in page)");

					resp2 = new fakeResponseObj(assert, true, function(){
						assert.strictEqual(this._json().result, 1, "Evaluating one() (global function in page)");

						resp2 = new fakeResponseObj(assert, true, function(){
							assert.strictEqual(this._json().result, 1, "Evaluating call to host function getElementsByTagName");
							resp2 = new fakeResponseObj(assert, true, function() {
								assert.strictEqual(this._json().result, "HTML", "Evaluating JS host property");
								done();
							});
							panel.apishim.evaluate(function(){return document.documentElement.tagName}, resp2);
						});
						panel.apishim.evaluate({script: "document.getElementsByTagName('html').length"}, resp2);

					});
					panel.apishim.evaluate({script: "one()"}, resp2);
				});
				panel.apishim.evaluate({script: "a"}, resp2);

			});
			panel.apishim.evaluate({script: "1+1"}, resp2);
			
			

		});
		// First we trigger an open request, this will call the resp.finish() method
		// we defined above when navigation is done
		panel.apishim.open({url: "http://" + testServer + "/test/eval"}, resp);
	});
}

before(exports, setupTestContentServer);
after(exports, testCleanup);

require("sdk/test").run(exports);
