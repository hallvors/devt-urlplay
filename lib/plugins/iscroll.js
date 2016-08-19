var IScroll = function (page, manager) {
  'use strict';
  this.name = "old-iScroll-check";
  this.res = {};
  this._page = page;
  this.manager = manager;
};

IScroll.prototype.onLoadFinished = function () {
  this.manager.pluginAsync(this.name); // We're not done until we're done..
	var self = this;
  this._page.evaluate(function(){
        if (window.iScroll && !window.IScroll){
            return true;
        }
        return false;
    }).then(function(result) {
      self.res = result;
      self.manager.pluginDone(self.name);
    });
};

IScroll.prototype.getResult = function () {
  return this.res;
};

try {
  if (exports) {
    exports.Plugin = IScroll;
  }
} catch (ex) {
  IconLink = module.exports;
}

