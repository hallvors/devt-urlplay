function handleRequest(request, response){
	console.log(request);
	console.log(response);
	console.log(this);
	response.setStatusLine(request.httpVersion, 200, "OK");
    response.write("Hello world!  This request was dynamically " +
                 "generated at " + new Date().toUTCString());

}
