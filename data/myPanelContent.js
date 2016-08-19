/* See license.txt for terms of usage */

"use strict";

/**
 * This object implements two communication channels. One allows sending
 * messages to the current 'debuggee' (RDP server side) and the other
 * can be used to send messages to the chrome scope where the rest
 * of this extension lives, e.g. {@MyPanel} object.
 */
function Connection(win) {
  this.win = win;
  this.doc = win.document;
}

Connection.prototype = {
  // Direct communication channel to 'debuggee' (RDP server side).
  debuggee: null,

  // Communication channel to the chrome scope.
  chrome: null,

  /**
   * Initialization steps.
   */
  initialize: function() {
    var self = this;
    // The initialization sequence is based on a message sent
    // from {@MyPanel.onReady}. It passes the channel ports
    // to the Debuggee and Chrome scope.
    return new Promise((resolve, reject) => {
      self._initEvtListener = (function(event) {
        console.log('window message listener in panel content got ', event, event.data);
        this.chrome = event.ports[0];

        // Register channel event handlers
        this.chrome.onmessage = this.onChromeMessage.bind(this);
        connection.sendChromeMessage({type:'connect'});

        resolve(event);
      }).bind(self);

      this.win.addEventListener("message", self._initEvtListener);
    });
  },

  /**
   * Send message to the chrome scope. It's handled by
   * {@MyPanel.onContentMessage} method.
   */
  sendChromeMessage: function(packet) {
    this.chrome.postMessage(packet);
  },

  /**
   * Handle message coming from the chrome scope.
   */
  onChromeMessage: function(event) {
    console.log("connection.onChromeMessage", event);
    if(event === 'unregistered') {
      // We're going down - or something. Clean up mode..
      // remove event listener on window
      this.win.removeEventListener("message", this._initEvtListener);
      // remove this.chrome.onmessage ?
      this.chrome.onmessage = null;
      // set connection = null
      connection = null;
    }
  }
}

// Create and initialize the connection object. The initialization
// is asynchronous and depends on an 'initialization' message
// sent from {@MyPanel}.
var connection = new Connection(window);
connection.initialize().then(event => {
  // Send a message back to the chrome scope. The data is
  // send as JSON packet (string).
  connection.sendChromeMessage({
    type: "message",
    content: "Hello from the content scope!"
  });
});
