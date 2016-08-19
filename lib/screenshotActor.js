/* Most of this file is copied from the customActor example */

"use strict";

const { Cc, Ci, Cu } = require("chrome");
const { devtools } = Cu.import("resource://devtools/shared/Loader.jsm", {});
let protocol = devtools["require"]("devtools/server/protocol");
let { method, RetVal, ActorClass, FrontClass, Front, Actor } = protocol;

/**
 * A method decorator that ensures the actor is in the expected state before
 * proceeding. If the actor is not in the expected state, the decorated method
 * returns a rejected promise.
 *
 * @param String expectedState
 *        The expected state.
 *
 * @param Function method
 *        The actor method to proceed with when the actor is in the expected
 *        state.
 *
 * @returns Function
 *          The decorated method.
 */
function expectState(expectedState, method) {
  return function(...args) {
    if (this.state !== expectedState) {
      const msg = "Wrong State: Expected '" + expectedState + "', but current "
                + "state is '" + this.state + "'";
      return Promise.reject(new Error(msg));
    }

    return method.apply(this, args);
  };
}

/**
 * TODO: description
 */
var ScreenshotActor = ActorClass({
  typeName: "screenshotActor",

  get dbg() {
    if (!this._dbg) {
      this._dbg = this.parent.makeDebugger();
    }
    return this._dbg;
  },

  initialize: function(conn, parent) {
    Actor.prototype.initialize.call(this, conn);
    this.parent = parent;
    this.state = "detached";
    this._dbg = null;
  },

  destroy: function() {
    if (this.state === "attached") {
      this.detach();
    }

    Actor.prototype.destroy.call(this);
  },

  /**
   * Attach to this actor.
   */
  attach: method(expectState("detached", function() {
    this.dbg.addDebuggees();
    this.dbg.enabled = true;
    this.state = "attached";
  }), {
    request: {},
    response: {
      type: "attached"
    }
  }),

  /**
   * Detach from this actor.
   */
  detach: method(expectState("attached", function() {
    this.dbg.removeAllDebuggees();
    this.dbg.enabled = false;
    this._dbg = null;
    this.state = "detached";
  }), {
    request: {},
    response: {
      type: "detached"
    }
  }),
  /**
   * The method that takes screenshot
   */
  takeScreenshot: method(function createScreenshotData() {
    var window = this.parent.window;
    let left = 0;
    let top = 0;
    let width;
    let height;
    const currentX = window.scrollX;
    const currentY = window.scrollY;


    // Bug 961832: GCLI screenshot shows fixed position element in wrong
    // position if we don't scroll to top
    window.scrollTo(0,0);
    width = window.innerWidth + window.scrollMaxX - window.scrollMinX;
    height = window.innerHeight + window.scrollMaxY - window.scrollMinY;

    const winUtils = window.QueryInterface(Ci.nsIInterfaceRequestor)
                         .getInterface(Ci.nsIDOMWindowUtils);
    const scrollbarHeight = {};
    const scrollbarWidth = {};
    winUtils.getScrollbarSize(false, scrollbarWidth, scrollbarHeight);
    width -= scrollbarWidth.value;
    height -= scrollbarHeight.value;

    const canvas = window.document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
    const ctx = canvas.getContext("2d");
    const ratio = window.devicePixelRatio;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.scale(ratio, ratio);
    ctx.drawWindow(window, left, top, width, height, "#fff");
    var data = canvas.toDataURL("image/png", "")

    // See comment above on bug 961832
    window.scrollTo(currentX, currentY);

    return {
      data: data,
      height: height,
      width: width
    };
  }
  , {
    request: {},
    response: RetVal("json"),
  }),
});

exports.ScreenshotActor = ScreenshotActor;

exports.ScreenshotActorFront = FrontClass(ScreenshotActor, {
  initialize: function(client, form) {
    Front.prototype.initialize.call(this, client, form);

    this.actorID = form[ScreenshotActor.prototype.typeName];
    this.manage(this);
  }
});

