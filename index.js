const { Cu, Ci } = require("chrome");
const panel = require("./panel.js");
const { gDevTools } = Cu.import("resource://devtools/client/framework/gDevTools.jsm", {});

gDevTools.registerTool(panel.tooldef);

