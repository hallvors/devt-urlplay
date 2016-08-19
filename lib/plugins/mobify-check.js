var MobifyCheck = function (page, manager) {
	'use strict';
	this.name = "mobify-check";
	this.res = false;
	this._page = page;
	this.manager = manager;
};

MobifyCheck.prototype.onLoadFinished = function () {
    this.manager.pluginAsync(this.name); // We're not done until we're done..
	var self = this;
    this._page.evaluate(function(){
		for (var i = 0; i < document.scripts.length; i+=1) {
			var s = document.scripts[i];
			if (s.src.indexOf('mobify') > -1) {
				return s.src;
			}
		}
		return false;
	}).then(function(result) {
		self.res = result;
        self.manager.pluginDone(self.name);
	});
};

MobifyCheck.prototype.getResult = function () {
	return this.res;
};

try {
	if (exports) {
		exports.Plugin = MobifyCheck;
	}
} catch (ex) {
	MobifyCheck = module.exports;
}

