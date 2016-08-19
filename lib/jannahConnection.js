/*
* This file manages the connection to Compatipede (v/Jannah)
* see https://github.com/asynchq/jannah/
* Some of his code is copied from backchannel.js
*
* Devtools-urplayer will connect to Jannah as a hub
* and send regular pings
*/

//var {Services} = require('resource://gre/modules/Services.jsm');
const pageWorker = require("sdk/page-worker"); // Workaround to get WebSockets access..
var { setInterval, clearInterval} = require("sdk/timers");

function JannahConnection(serverDetails, self_host, self_port){
	var self = this;
	this._hubDetails = serverDetails;
	this.self_host = self_host;
	this.self_port = self_port;
	this.pw = pageWorker.Page({
	    contentURL: './websocket.html'
	});
	this.pw.port.on('loaded', function() {
	    // If you want to do something when the pageworker loads,
	    //  you can put it here.
		self.connect();
	});
	this.pw.port.on('message', function(message) {
	    console.log('got message: ' + message);
	});
	this._tabList = [];
	this._sendIntervalTime = 5000;
	this._sendInterval = null;
}

JannahConnection.prototype.connect = function() {
  let self = this;
  this.pw.port.emit('connect', {url:'ws://' + this._hubDetails.master_ip + ':' + this._hubDetails.master_port});
  this.pw.port.on('open', () => {
    console.info('Backchannel connected');
    self._connected = true;
    self._sendUpdate();
    self._setupSendLoop();
  });

  //this.pw.port.on('close', this._handleDisconnect.bind(this));
  this.pw.port.on('error', this._handleDisconnect.bind(this));
};

JannahConnection.prototype._setupSendLoop = function() {
  this._sendInterval = setInterval(this._sendUpdate.bind(this),
    this._sendIntervalTime);
};

/**
 * Sends update to master
 *
 * Could be called from outside, for example,
 * if tab list changes
 */
JannahConnection.prototype._sendUpdate = function() {
  if(!this._connected) {
    console.info('Tried to send update while disconnected');
    return;
  }
  //console.log(this._hubDetails)
  this.pw.port.emit('update', {
    ip         : this.self_host,
    port       : this.self_port,
    maxTabs    : this._hubDetails.maxTabs,
    location   : this._hubDetails.location,
    activeTabs : this._tabList.length,
  });

  //send update could be called out of order
  //to minimize amount of traffic send interval
  //can be reset
  if(this._sendInterval !== null) {
    clearInterval(this._sendInterval);
    this._sendInterval = null;
    this._setupSendLoop();
  }
};

/**
 * When socket disconnects happens for some reason it is required that it
 * tries to connect to master again, there might be active tabs etc. they
 * should not be affected by this
 */
JannahConnection.prototype._handleDisconnect = function() {
  console.info('Backchannel socket disconnected');

  if(this._sendInterval !== null) {
    clearInterval(this._sendInterval);
    this._sendInterval = null;
  }

  this._connected = false;

  //this.connect();
};


function jannahInit(serverDetails, self_host, self_port){
	var jc = new JannahConnection(serverDetails, self_host, self_port);
	return jc;
}

exports.init = jannahInit;
