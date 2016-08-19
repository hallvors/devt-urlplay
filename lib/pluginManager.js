/*
TODO: 
 [ ] Track if plugin causes exceptions
 [ ] Track if plugin causes navigation
 [ ] Do we use plugin mechanism for site-specific interactivity simulations? Or non-site-specific simulations?

*/

var pluginsToLoad = ['css-analysis', 'iscroll', 'mobify-check', 'page-width-check', 'video-stats', 'window-orientation-usage'];

var _PluginManager = function (page) {
    'use strict';
    this.init(page);
}

_PluginManager.prototype.init = function(page) {
    var pathToPlugins = "./plugins";
    this.plugins = {};
    this.state = "finished";
    this._page = page;
    this._unfinished = []; // tracks ongoing async work
    for(var i = 0; i < pluginsToLoad.length; i++) {
        var plugin = require(pathToPlugins + "/" + pluginsToLoad[i]);
        var p = new plugin.Plugin(this._page, this);
        this.plugins[p.name] = p;
    }
    var self = this;
    this._prom = new Promise(function(resolve, reject){
        self._resolveMe = resolve;
    });
};

_PluginManager.prototype.onNavigationStart = function(url) {
    this.state = "opening";
}

_PluginManager.prototype.promiseAllIsDone = function() {
    console.log('promiseAllIsDone in state ' + this.state)
    if(this.state === "opening" || this.state === "finished") {
        // There's nothing to wait for..
        return new Promise((resolve, reject)=>resolve());
    } else {
        return this._prom;
    }
}

_PluginManager.prototype.reset = function () {
    this.init(this._page);
};

_PluginManager.prototype.pluginAsync = function (name) {
    if(this._unfinished.indexOf(name) === -1) {
        this._unfinished.push(name);
        this.state = "plugin-result-pending";
    }
};

_PluginManager.prototype.pluginDone = function (name) {
    this._unfinished.splice(this._unfinished.indexOf(name), 1);
    if(this._unfinished.length === 0) {
        this.state = "finished";
        this._resolveMe.call(this._prom, this);
    }
};

_PluginManager.prototype.onResourceRequested = function (requestData, actor) {
    for (var p in this.plugins) {
        if (this.plugins[p].onResourceRequested) {
            try {
                if (!this.plugins[p].onResourceRequested(requestData, actor)) {
                    console.warn('Preventing loading of files by returning false in onResourceRequested NOT IMPLEMENTED');
                    // TOCONSIDER: do we need such functionality? 
                }
            } catch (ex) {
                console.log("plugin error onResourceRequested", ex);
            }
        }
    }
};

_PluginManager.prototype.onResourceReceived = function (evtData, actor) {
    for (var p in this.plugins) {
        if (this.plugins[p].onResourceReceived) {
            try {
                this.plugins[p].onResourceReceived(evtData, actor);
            } catch (ex) {
                console.log("plugin error onResourceReceived", ex);
            }
        }
    }
};

_PluginManager.prototype.onInitialized = function (evtData, actor) {
    for (var p in this.plugins) {
        if (this.plugins[p].onInitialized) {
            try {
                this.plugins[p].onInitialized(evtData, actor);
            } catch (ex) {
                console.log("plugin error onInitialized", ex);
            }
        }
    }
};


_PluginManager.prototype.onLoadStarted = function (evtData, actor) {
    for (var p in this.plugins) {
        if (this.plugins[p].onLoadStarted) {
            try {
                this.plugins[p].onLoadStarted(evtData, actor);
            } catch (ex) {
                console.log("plugin error onLoadStarted", ex);
            }
        }
    }
};


_PluginManager.prototype.onLoadFinished = function (evtData, actor) {
    for (var p in this.plugins) {
        if (this.plugins[p].onLoadFinished) {
            try {
                this.plugins[p].onLoadFinished(evtData, actor);
            } catch (ex) {
                console.log("plugin error onLoadFinished", ex, ex.stack);
            }
        }
    }
    if (this.state === "opening") {
        this.state = "finished";
    }
};


_PluginManager.prototype.onConsoleMessage = function (msg, actor) {
    var returnValue = false;
    for (var p in this.plugins) {
        if (this.plugins[p].onConsoleMessage) {
            try {
                // If the plugin returns true it has handled the message
                if(this.plugins[p].onConsoleMessage(msg, actor)) {
                    returnValue = true;
                    break;
                }
            } catch (ex) {
                console.log("plugin error onConsoleMessage", ex);
            }
        }
    }
    return returnValue;
};


_PluginManager.prototype.getResults = function (callback) {
    this.promiseAllIsDone().then(function(){
        var results = {};
        for (var p in this.plugins) {
            try {
                if (this.plugins[p].getResult) {
                    results[p] = this.plugins[p].getResult();
                }
            } catch (ex) {
                console.log("ERROR " + ex);
            }
        }
        callback(results);
    });
};

try {
    exports.PluginManager = _PluginManager;
} catch (ex) {
    var PluginManager = _PluginManager;
    PluginManager = module.exports;
}