const self = require("sdk/self");

const { Cu, Ci } = require("chrome");
Cu.import("resource://services-common/utils.js");


var {nsHttpServer} = require("../node_modules/addon-httpd/test/httpd.js");
var shim, srv;
var activeServers = {};

function _getRequestData (req) {
	try {
		return JSON.parse(decodeURIComponent(CommonUtils.readBytesFromInputStream(req.bodyInputStream).replace(/\+/g, "%20")));
	} catch(e) {
		console.log(e);
		return decodeURIComponent(CommonUtils.readBytesFromInputStream(req.bodyInputStream).replace(/\+/g, "%20"));
	}
}



function startServer(listen_ip, port, public_ip, config_method){
	srv = new nsHttpServer();
	// If caller passes a config method, we assume it will define all required paths
	if(config_method) {
		config_method(srv);
	} else {
		srv.registerPathHandler("/tab", function(request, response){
			var reqData = _getRequestData(request);
			//console.log(reqData);
			response.setHeader("Content-Type", "application/json; charset=utf8", false);
			response.write("{\"url\":\"http://" + public_ip + ":" + port + "\"}");
		});
		srv.registerPathHandler("/announceTab", function(request, response){ // This is not really required with this implementation..
			response.write("annTAB");
		});
		// set up API
		["open", "addCookie", "setUserAgent", "getResources", "getRedirects",
			"getScreenshot", "destroy", "evaluate", "evaluateOnGecko", "getPluginResults",
			"getConsoleLog", "getErrorLog", "getCookies", "waitForResources", "setScreenSize"].forEach(function(path) {
				srv.registerPathHandler("/" + path, function(req, resp){
					console.log("gonna " + path);
					resp.setHeader("Content-Type", "application/json; charset=utf8", false);
					var data = _getRequestData(req);
					//console.log(data, shim);
					if(shim) {
						if(shim[path]) {
							shim[path](data, resp);
						} else {
							console.error("no shim implementation of " + path);
						}
					} else {
						console.error("no shim!! " + path);
					}
				});
			});
	}
	// Start listening on port 8000
	srv.start(port, listen_ip);
	activeServers[listen_ip + ":" + port] = true;
}

function registerShim(theShim){
	shim = theShim;
}

// Stop it.
function stopServer(listen_ip, port, done){
	srv.stop(function() {
		delete activeServers[listen_ip + ":" + port];
		done(); 
	});
}

function isServerStarted(listen_ip, port) {
	return (listen_ip + ":" + port) in activeServers;
}

exports.startServer = startServer;
exports.isServerStarted = isServerStarted;
exports.registerShim = registerShim;
exports.stopServer = stopServer;



