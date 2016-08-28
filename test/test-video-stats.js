var main = require("../");
const { fakeResponseObj, openDevToolsFocusURLPlayer, setupTestContentServer, testCleanup, testServer } = require("./testutils.js");
const { before, after } = require('sdk/test/utils');

exports["test video stats plugin"] = function(assert, done) {
  openDevToolsFocusURLPlayer().then(function (panel){
  	var responseObj = new fakeResponseObj(assert, true, function(){
		var as = panel.apishim;
		var resp2 = new fakeResponseObj(assert, true, function(){
			var plResults = this._json().results["video-stats"];
			console.log("plResults", JSON.stringify(plResults, null, 2) );
			assert.strictEqual(plResults.hasVideo, true, "Page has video");
			assert.deepEqual(plResults.classNames, ["bigvideo"], "video-stats: classNames");
			assert.deepEqual(plResults.IDs, ["myVid"], "video-stats: IDs");
			assert.deepEqual(plResults.types, ["video/x-foo-mime", "video/x-bar-mime"], "video-stats: types");
			assert.deepEqual(plResults.httpTypes, [], "video-stats: httpTypes");
			assert.deepEqual(plResults.readyStates, [0], "video-stats: readyStates");
			assert.deepEqual(plResults.libraries, ["video.js"], "video-stats: libraries");
	  		done();
		});
		panel.apishim.getPluginResults(null, resp2);
	});
  	panel.apishim.open({url:"http://" + testServer + "/test/video1"}, responseObj);
  }, function(err){console.log("ERROR", err)});
};

before(exports, setupTestContentServer);
after(exports, testCleanup);

require("sdk/test").run(exports);
