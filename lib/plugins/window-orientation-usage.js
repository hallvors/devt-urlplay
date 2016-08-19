var messageString = 'window.orientation was read!'

var WindowOrientationUsage = function (page, manager) {
  'use strict';
  this.name = "window-orientation-usage";
  this.res = false;
  this._started = false;
  this._page = page;
};

WindowOrientationUsage.prototype.onInitialized = function () {
  if (!this._started) {
    if (this._page.url) {
      this._page.evaluate(function(){
        var messageString = arguments[0];
        Object.defineProperty(window, 'orientation', {
          get: function () {
            console.log(messageString);
            return 1;
          }
        });
      }, [messageString]);
      this._started = true;
    }
  }
};

WindowOrientationUsage.prototype.onConsoleMessage = function (msg, lineNum, sourceId) {
  if(msg === messageString) {
    this.res = true;
    return true;
  }
}

WindowOrientationUsage.prototype.getResult = function () {
  return this.res;
};

try {
  if (exports) {
    exports.Plugin = WindowOrientationUsage;
  }
} catch (ex) {
  WindowOrientationUsage = module.exports;
}

