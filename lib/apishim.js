// This does the heavy lifting: handling the actual commands sent from Jannah,
// setting up event listeners, command implementations to fulfil the Jannah requests etc.

/* 

['open', 'addCookie', 'setUserAgent', 'getResources', 'getRedirects',
'getScreenshot', 'destroy', 'evaluate', 'evaluateOnGecko', 'getPluginResults',
'getConsoleLog', 'getErrorLog', 'getCookies', 'waitForResources', 'setScreenSize'].forEach(function(m) {

*/

const { Cu, Ci } = require("chrome");
const timer = require("sdk/timers");
Cu.import("resource://services-common/utils.js");
// var prefs = require('sdk/preferences/service');
const { devtools } = Cu.import("resource://devtools/shared/Loader.jsm", {});
//const { StyleSheetFront } = require("resource://devtools/shared/fronts/stylesheets");

function APIShim(panelObj, target){
	this._reset();
	this.panelObj = panelObj;
	this.target = target;
	this._setupConsoleMessageHandling();
	this._pluginManager = new (require("./pluginManager.js").PluginManager)(this);
	this._evalID = 0;
	/*timer.setTimeout((function(){
		var as = this;
		this.open({url:"http://google.com"}, {write: function(str){console.log(str)}, processAsync: function(){}, 
		finish: function(){
			console.log(as._requestLog, as._pluginManager.getResults(), as._consoleLog, as._errorLog);
		}})
	}).bind(this), 1000); */
}

APIShim.prototype._reset = function(){
	this._consoleLog = [];
	this._errorLog = [];
	this._requestLog = {};
	this._redirects = {};
	this._pendingRequests = {};
	this._pendingJS = ["Object.freeze(window.console)"];
	this._lastOpenTimeStamp = null;
	if(this._pluginManager) {
		this._pluginManager.reset();
	}

}

APIShim.prototype.open = function(data, resp) {
	console.log('Navigation request: ' + data.url);
	resp.processAsync();
	// To make sure we don't end up in race conditions
	// where components like screenshotActor isn't registered
	// we do a panel.checkInitState()
	Promise.all([this.panelObj.checkInitState(), this._pluginManager.promiseAllIsDone()]).then((function(){
		this._pluginManager.onNavigationStart(data.url);
		var target = this.target;
		// forget all stored data from previous navigation when a
		// new page gets opened
		this._reset();
		this._opening = true;
		var startTime = new Date();
		this._lastOpenTimeStamp = startTime;
	  	target.activeTab.navigateTo(data.url);
	  	// TODO: pendingJS
	  	target.once("navigate", (function onNav(event, evtData){
	  		this._pluginManager.onLoadFinished(evtData, null);
		  	// should return success and elapsed time
		  	this.waitForResources(data, resp, (new Date()).getTime() - startTime.getTime());
	  	}).bind(this));

	}).bind(this));
}

APIShim.prototype.setUserAgent = function(data, resp) {
	try{
		this.target.activeTab.reconfigure({customUserAgent: data.userAgent});
	}catch(e){
		console.log('error setting UA', se);
	}
  	resp.write(JSON.stringify({success:true, elapsedTime: 0}));

}

APIShim.prototype.setScreenSize = function(data, resp) {
	// Not necessarily available on all platforms..nor necessarily desirable
	this._pendingJS.push('window.resizeTo(' + data.size.width + ', ' + data.size.height + ')');
  	resp.write(JSON.stringify({success:true, elapsedTime: 0}));
}

APIShim.prototype.getScreenshot = function(data, resp) {
	resp.processAsync();
    this.panelObj.screenshotActor.takeScreenshot().then(response => {
      console.log('screenshotActor response');
      // We need to remove the prefixed data:image/png;base64,
      //  - we want nothing but the encoded data here
      response.data = response.data.replace(/^data:.+,/, '');

	  resp.write(JSON.stringify({success:true, data: response.data}));
	  resp.finish();
     }, error => {
     	console.log('screenshotActor ERROR', error);
		resp.write(JSON.stringify({success:false, data: error}));
		resp.finish();

     });
    console.log('initiated takeScreenshot');
}

APIShim.prototype.addCookie = function(data, resp) {
	resp.write(JSON.stringify({success:false, data: "not implemented"}));
}

APIShim.prototype.getResources = function(data, resp) {
	resp.write(JSON.stringify({success:true, resources: this._requestLog}))
}

APIShim.prototype.getRedirects = function(data, resp) {
	resp.write(JSON.stringify({redirects: this._redirects}));

}

APIShim.prototype.destroy = function(data, resp) {
  	resp.write(JSON.stringify({success:true, elapsedTime: 0}));
}

APIShim.prototype.evaluate = function(data, resp) {
	// TODO: sort out a frame story!
	// we can do 
	// consoleClient.evaluateJS({text:data.script, frameActor: actor_reference})
	// to run JS in a specific frame
	if(resp) {
		resp.processAsync();
	}
	if(this.consoleClient) {
		var p = new Promise((function(resolve, reject) {
			var script = data.script || data.toString();
			if(typeof data === 'function') {
				// support anonymous function expressions..
				script = '(' + script + ')()';
			}
			console.log('evaluating ', script);
			this.consoleClient.evaluateJSAsync(script, function(result) {
				var realResult;
				try{
					console.log(JSON.stringify(result, null, 2));
				}catch(e){console.log(e)}
				try {
					realResult = JSON.parse(result.result);
				}catch(e) {
					realResult = result.result;
				}
				if(resp && resp.write) {
					resp.write(JSON.stringify({success: true, result: realResult}));
					resp.finish();
				}
				resolve(realResult);
			});
		}).bind(this));
		return Promise.all([p]);
	} else {
		if(resp && resp.write) {
			resp.write(JSON.stringify({success: false, result: ''}));
		} else {
			throw 'no console client';
		}
	}
}

APIShim.prototype.evaluateOnGecko = function(data, resp) {
	resp.write(JSON.stringify({success: false, results: 'Not implemented'}));
}

APIShim.prototype.getPluginResults = function(data, resp) {
	resp.processAsync();
	this._pluginManager.getResults(function(results){
		resp.write(JSON.stringify({results:results}));
		resp.finish();
	});
}

APIShim.prototype.getConsoleLog = function(data, resp) {
	resp.write(JSON.stringify({consoleLog: this._consoleLog}));
}

APIShim.prototype.getErrorLog = function(data, resp) {
	resp.write(JSON.stringify({errorLog: this._errorLog}));
}

APIShim.prototype.getCookies = function(data, resp) {
	resp.write(JSON.stringify({success:false, data: "not implemented"}));
}

APIShim.prototype.waitForResources = function(data, resp, elapsedTime) {
	// We check if all resources are loaded - but apply a "hard timeout" of 30 seconds..
	var waitStartTime = new Date();
	var hardTimeout = 30000;
	console.log('waitForResources - ', data);
	resp.processAsync();
	console.log(2);
	// Maybe there's nothing to do here..?
	if(this._opening === false && Object.keys(this._pendingRequests).length === 0) {
		console.log('direct');
		resp.write(JSON.stringify({success:true, data: "", elapsedTime: elapsedTime}));
		resp.finish();
	} else {
		// we're busy loading something, let's wait a bit..
		resp.processAsync();
		var timeoutfn = (function() {
			console.log('waiting.. ', this._opening, Object.keys(this._pendingRequests));
			if(Object.keys(this._pendingRequests).length===1) {
				console.log('pending req', this._pendingRequests[Object.keys(this._pendingRequests)[0]]);
			}
			if ((this._opening === false && Object.keys(this._pendingRequests).length === 0) || Date.now() - waitStartTime.getTime() > hardTimeout) {
				let timedout = Date.now() - waitStartTime.getTime() > hardTimeout;
				resp.write(JSON.stringify({success:true, data: "", elapsedTime: elapsedTime, hardTimeout: timedout}));
				resp.finish();
			} else {
				timeout = timer.setTimeout(timeoutfn, 500);
			}
		}).bind(this);
		var timeout = timer.setTimeout(timeoutfn, 1000);
	}
}

APIShim.prototype._messageHandler = function(evt, details) {
	// {"from":"server1.conn0.consoleActor2","type":"consoleAPICall","message":{"arguments":["foo foo"],"columnNumber":1,"counter":null,"filename":"http://hallvord.com/temp/moz/compatTesterTesting/console1.htm","functionName":"","groupName":"","level":"log","lineNumber":4,"private":false,"styles":[],"timeStamp":1470200757916,"timer":null,"workerType":"none","category":"webdev"}}
	// {"from":"server1.conn0.consoleActor2","type":"consoleAPICall","message":{"arguments":["foo foo"],"columnNumber":1,"counter":null,"filename":"http://hallvord.com/temp/moz/compatTesterTesting/console2.htm","functionName":"","groupName":"","level":"error","lineNumber":4,"private":false,"styles":[],"timeStamp":1470200897927,"timer":null,"stacktrace":[{"columnNumber":1,"filename":"http://hallvord.com/temp/moz/compatTesterTesting/console2.htm","functionName":"","language":2,"lineNumber":4}],"workerType":"none","category":"webdev"}}
	console.log(evt, JSON.stringify( details, null, 2));
	// We only need some of that..
	var wanted = ["filename", "lineNumber", "columnNumber", "functionName", "level"];
	var extractedDetails = {
		message: details.message.arguments[0],
		messages: details.message.arguments
	};
	wanted.forEach((detail)=> extractedDetails[detail] = details.message[detail]);
	this._pluginManager.onConsoleMessage(details.message.arguments[0], details.from);
  	this._consoleLog.push(extractedDetails);
}

APIShim.prototype._errorHandler = function(evt, details) {
	console.log(evt, JSON.stringify( details, null, 2));

	// {"from":"server1.conn0.consoleActor2","type":"pageError","pageError":{"errorMessage":"ReferenceError: bar is not defined","sourceName":"http://hallvord.com/temp/moz/compatTesterTesting/console3.htm","lineText":"","lineNumber":4,"columnNumber":1,"category":"content javascript","timeStamp":1470199314151,"warning":false,"error":false,"exception":true,"strict":false,"info":false,"private":false,"stacktrace":[{"filename":"http://hallvord.com/temp/moz/compatTesterTesting/console3.htm","lineNumber":4,"columnNumber":1,"functionName":null}]}}
	// console.log: devtools-urlplayer: {"from":"server1.conn0.consoleActor2","type":"pageError","pageError":{"errorMessage":"SyntaxError: missing ) after argument list","sourceName":"http://hallvord.com/temp/moz/compatTesterTesting/console4.htm","lineText":"","lineNumber":5,"columnNumber":0,"category":"content javascript","timeStamp":1470199225211,"warning":false,"error":false,"exception":true,"strict":false,"info":false,"private":false,"stacktrace":null}}
	// We only need some of that..
	var wanted = ["errorMessage", "sourceName", "lineText", "lineNumber", "columnNumber", "strict", "category"];
	var extractedDetails = {};
	wanted.forEach((detail)=> extractedDetails[detail] = details.pageError[detail]);
	var typestr = details.pageError.warning ? "warning" : details.pageError.error ? "error" : details.pageError.exception ? "exception" : details.pageError.info ? "info" : "other";
	extractedDetails.errType = typestr;
  	this._errorLog.push(extractedDetails);
}

APIShim.prototype._processPendingJS = function (){
	var js;
	while(js = this._pendingJS.pop()) {
		this.evaluate(js);
	}
}

APIShim.prototype._setupConsoleMessageHandling = function() {
	if(!this.target.client)return console.error("NO CLIENT?!");
	var self = this;
	var client = this.target.client;
	client.addListener("consoleAPICall", this._messageHandler.bind(this));
	client.addListener("consoleMessage", this._messageHandler.bind(this));
	client.addListener("pageError", this._errorHandler.bind(this));

	client.addListener("tabNavigated", function(e, obj){
		if(obj.state === 'stop' && ! obj.isFrameSwitching) {
			self._pluginManager.onInitialized(obj, obj.from);
			self._processPendingJS();
		}
	});
	client.attachConsole(this.target.form.consoleActor, ["PageError", "ConsoleAPI", "NetworkActivity"], 
		(function(response, webConsoleClient){
	     	if(response.error) {
	     		console.error("console connect failed");
	     		return;
	     	}
	     	this.consoleClient = webConsoleClient;
	     	// Monitor network stuff too - here we get resource details
		    webConsoleClient.on("networkEvent", (function(type, data){
		    	// Each request has a serial number for identification - 
		    	// data.actor ends with this serial number
		    	var id = data.actor.match(/\d+$/)[0];
		    	this._pendingRequests[id] = data.request.url;
		    	this._requestLog[id] = {
		    		request: {
		    	  		method: data.request.method,
		    	  		url: data.request.url,
			    		time: new Date(data.timeStamp),
		    			headers: []
		    		}, 
		    		response: {id:id, url: data.request.url}
		    	}
		    	//console.log(type, data);
		    }).bind(this));
		    webConsoleClient.on("networkEventUpdate", (function(type, {packet, networkInfo}){
		    	let {actor} = networkInfo;
		    	var id = actor.match(/\d+$/)[0];
		    	//console.log(type, packet, actor);
		    	switch(packet.updateType){
			    	case "requestHeaders":
			    		webConsoleClient.getRequestHeaders(actor, function(rhdata){
			    			self._requestLog[id].request.headers = rhdata.headers;
			    			self._pluginManager.onResourceRequested(self._requestLog[id].request, actor);
			    		});
			    		break;
			    	case "responseHeaders":
			    		webConsoleClient.getResponseHeaders(actor, function(rhdata){
			    			self._requestLog[id].response.headers = rhdata.headers;
			    			var http_status = self._requestLog[id].response.status;
				    		if(http_status > 299 && http_status < 400) { // some sort of redirect..
			    				var loc = rhdata.headers.filter(function(element){return !!element.name.match(/location/i);})
			    				if(loc && loc[0]) {
			    					self._requestLog[id].response.redirectURL = loc[0].value;
			    					self._redirects[self._requestLog[id].request.url] = loc[0].value;
			    				} else {
			    					self._redirects[self._requestLog[id].request.url] = ' status ' + http_status + ' but no location header ' + JSON.stringify(rhdata);
			    				}
				    		}
			    		});
			    		break;
			    	case "securityInfo":
			    		self._requestLog[id].securityInfo = packet.state;
			    		break;
			    	case "responseStart":
			    		let http_status = parseInt(packet.response.status);
			    		self._requestLog[id].response.status = http_status;
			    		self._requestLog[id].response.statusText = packet.response.statusText;
			    		if(http_status > 299 && http_status < 400) { // some sort of redirect..
			    			webConsoleClient.getResponseHeaders(actor, function(rhdata){
			    				var loc = rhdata.headers.filter(function(element){return !!element.name.match(/location/i);})
			    				if(loc && loc[0]) {
			    					self._requestLog[id].response.redirectURL = loc[0].value;
			    					self._redirects[self._requestLog[id].request.url] = loc[0].value;
			    				} else {
			    					self._redirects[self._requestLog[id].request.url] = ' status ' + http_status + ' but no location header ' + JSON.stringify(rhdata);
			    				}
			    			});
			    		}
			    		// TODO: replace ._opening with isHTML check if possible..
			    		if(http_status === 200 && self._opening) {
			    			self._pluginManager.onLoadStarted(self._requestLog[id].response, actor);
			    		}
			    		break;
			    	case "responseContent":
			    		// at this point we have response.headers but there's no packet.url -
			    		// TODO: can we set self._requestLog[id].response.url to real URL of resource?
			    		// hopefully redirectURL is set .. so 
			    		self._requestLog[id].response.bodySize = packet.contentSize;
			    		self._requestLog[id].response.contentType = packet.mimeType;
			    		var isHTML = /text\/html/i.test(packet.mimeType);
			    		var thisReqLoaded = packet.contentSize === packet.transferredSize;
			    		console.log('PACKET', packet.contentSize, packet.mimeType);
			    		if(/(^text)/i.test(packet.mimeType) || /(javascript|xml)/i.test(packet.mimeType)) {
				    		webConsoleClient.getResponseContent(actor, function(contentData){
				    			// from, content, contentDiscarded
				    			self._requestLog[id].response.body = contentData.content;
				    			self._pluginManager.onResourceReceived(self._requestLog[id].response, actor);
				    		});
			    		}
			    		if(self._opening && isHTML){
			    			// we make the assumption that the first responseContent event after a navigation
			    			// means the HTML is loaded and we're no longer "opening" - however, we're still 
			    			// tracking loading resources in _pendingRequests
			    			self._opening = false;
			    			self._processPendingJS();
			    		}
			    		delete self._pendingRequests[id];
			    		break;

		    	}
		    }).bind(this));
    }).bind(this));


}


exports.APIShim = APIShim;