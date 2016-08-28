"use strict";
const self = require("sdk/self");
const { Cu, Ci } = require("chrome");
const { ScreenshotActorFront } = require("./lib/screenshotActor.js");
const { MessageChannel } = require("sdk/messaging");
const { gDevTools } = Cu.import("resource://devtools/client/framework/gDevTools.jsm", {});
const { devtools } = Cu.import("resource://devtools/shared/Loader.jsm", {});
const timer = require("sdk/timers");

const { ActorRegistryFront } = devtools["require"]("devtools/server/actors/actor-registry");

var jannahConnection = require("./lib/jannahConnection.js"); // sets up socket.io connection to Jannah when given the right details
var restServer = require("./lib/restServer.js"); // listen to incoming test requests
var APIShim = require("./lib/apishim.js").APIShim; // translates BOAR API to commands


function UrlPlayerPanel(window, target){
	this.window = window; // ChromeWindow whose .content is the DOMWindow of the page being debugged (at least if it's a local tab?)
	// .parent is the toolbox.xul ChromeWindow
	this.target = target._target; // Object representing (not being) the debuggee. It has emit(), on(), off() and once() but no postMessage()
	// target._target is also full of interesting stuff, perhaps especially .client and .activeTab
    this.apishim = new APIShim(this, this.target);
    // We need to track all the bits that need to be initialized..
    this._components = {
    	"contentCommunication": false,
    	"screenshotActor": false
    };
    console.log('UrlPlayerPanel init method' + window);
	window.onload = this.onReady.bind(this);
}

UrlPlayerPanel.prototype.checkInitState = function(){
	// TODO: fail at hard timeout.. (30 sec?)
	var self = this;
    var p = new Promise(function(resolve, reject) {
    	var _check = function(){
    		console.log('checkInitState', self._components.contentCommunication, self._components.screenshotActor )
    		if(self._components.contentCommunication && self._components.screenshotActor) {
    			resolve();
    		} else {
    			timer.setTimeout(_check, 500);
    		}
    	};
    	timer.setTimeout(_check, 200);
    });
    return p;
}

UrlPlayerPanel.prototype.destroy = function() { // TODO: what else do we need to clean up here?
	this.disconnect();
}

UrlPlayerPanel.prototype.onReady = function() {
	console.log('onReady', this.window, this.window.document);
	restServer.registerShim(this.apishim);

	const { port1, port2 } = new MessageChannel();
	this.content = port1;

	// Listen for messages sent from the panel content.
	this.content.onmessage = this.onContentMessage.bind(this);

	// Start up channels
	this.content.start();
	//this.debuggee.start();

	// Pass channels to the panel content scope (myPanelContent.js).
	// The content scope can send messages back to the chrome or
	// directly to the debugger server.
	this.window.postMessage("initialize", "*", [port2]);

}

UrlPlayerPanel.prototype.onContentMessage = function(event) {
    console.log("onContentMessage", event);
    this._components.contentCommunication = true;
    switch (event.data.type) {
    case "connect":
      this.connect();
      break;
    case "disconnect":
      this.disconnect();
      if(this.onceFrameUnload)this.onceFrameUnload();
      break;
    case "jannahDetails":
      this.jannahConnect(event.data.host, event.data.port, event.data.self_host, event.data.self_port);
    }

  }


/**
* Connect to our custom {@ScreenshotActor} actor.
*/
UrlPlayerPanel.prototype.connect = function() {

let target = this.target;
target.client.listTabs((response) => {
	//console.log('listTabs response', response);

  // The actor might be already registered on the backend.
  let tab = response.tabs[response.selected];
  //console.log('selected tab', tab)
  if (tab[ScreenshotActorFront.prototype.typeName]) {
    //console.log("actor already registered, so use it", tab);

    this.attachActor(tab);
    return;
  }

  // Register actor.
  this.registerActor(response);
});
},

/**
* Disconnect to our custom {@ScreenshotActor} actor.
*/
UrlPlayerPanel.prototype.disconnect = function() {return;
console.log("Disconnect from the backend actor; " + this.screenshotActorClass);
try{undefined()}catch(e){console.log(e.stack)}
// Unregistration isn't done right, see also:
// https://bugzilla.mozilla.org/show_bug.cgi?id=1146889
// If an actor is unregistered and then immediately registered
// there is the following exception:
// Error: Wrong State: Expected 'detached', but current state is 'attached'
// It's because the existing actor instance in the server side pool
// isn't removed during the unregistration process.
// The user needs to close and open the toolbox to re-establish
// connection (to ensure clean actor pools).
if (this.screenshotActorClass) {
  this.screenshotActorClass.unregister();
  this.screenshotActorClass = null;

  this.content.postMessage("unregistered");
}
}

UrlPlayerPanel.prototype.registerActor = function(response) {
	// The actor is registered as 'tab' actor (an instance created for
	// every browser tab).
	//console.log('will register actor ', response);
	let options = {
	  prefix: "screenshotActor",
	  constructor: "ScreenshotActor",
	  type: { tab: true }
	};

	let actorModuleUrl = self.data.url("../lib/screenshotActor.js");

	let registry = this.target.client.getActor(response["actorRegistryActor"]);
	if (!registry) {
	  registry = ActorRegistryFront(this.target.client, response);
	}

	registry.registerActor(actorModuleUrl, options).then(screenshotActorClass => {
	  //console.log("My actor registered");

	  // Remember, so we can unregister the actor later.
	  this.screenshotActorClass = screenshotActorClass;
	  // Post message to the panel content.
	  this.content.postMessage("registered");

	  this.target.client.listTabs(({ tabs, selected }) => {
	    this.attachActor(tabs[selected]);
	  });
	});
};

UrlPlayerPanel.prototype.attachActor = function(form) {
	var self = this;
	this.screenshotActor = ScreenshotActorFront(this.target.client, form);
	this.screenshotActor.attach().then(() => {
		self._components.screenshotActor = true;
  		console.log("My actor attached");
  		//this.screenshotActor.takeScreenshot().then(function(response){console.log(response)});
	});
};

UrlPlayerPanel.prototype.jannahConnect = function(host, port, self_host, self_port){
	//console.log('will connect to ws://' + host + ':' + port);
	restServer.startServer("0.0.0.0", 8000, self_host);
	// Jannah master keeps a list of hubs. 
	var jc = jannahConnection.init({master_ip: host, master_port: port, ip:self_host,port:self_port,maxTabs:1,"location": ""}, self_host, self_port);
};


var tooldef = {
	id: "devtools_urlplay",
	name: "Devtools-Urlplay",
	label: "URLPlay",
	icon: self.data.url("./icons/millipede.svg"),
	tooltip: "Pass urls to target device",
	url: self.data.url("./form.html"),
	build: function(window, target) {
		var panel = new UrlPlayerPanel(window, target);
		return panel;
	},
	isTargetSupported: () => true

}

exports.tooldef = tooldef;
