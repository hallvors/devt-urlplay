var pageWidthCheck = function (page, manager) {
  'use strict';
  this.name = "page-width-check";
  this.res = {};
  this._page = page;
  this.manager = manager;
};

pageWidthCheck.prototype.onLoadFinished = function () {
  this.manager.pluginAsync(this.name); // We're not done until we're done..
  var self = this;
  this._page.evaluate(function(){
    var docwidth = 0;
    if(document.body) { // For unknown reasons, doc.body is not always there/ready when this runs
      docwidth = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth);
    } else {
      docwidth = document.documentElement.scrollWidth;
    }
    if(docwidth > (window.innerWidth * 1.01)) {
      return 'too wide'; // page is more than 1 percentage points wider than than window width
    }
    return 'fits screen';
  }).then(function(result) {
    self.res = result;
    self.manager.pluginDone(self.name);
  });
};

pageWidthCheck.prototype.getResult = function () {
  return this.res;
};

try {
  if (exports) {
    exports.Plugin = pageWidthCheck;
  }
} catch (ex) {
  pageWidthCheck = module.exports;
}

