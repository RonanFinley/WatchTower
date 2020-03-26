var http = require('http');

//create a server object:
http.createServer(function (req, res) {
  res.write('Hello World!'); //write a response to the client
  console.log(JSON.stringify(req));
  res.end(); //end the response
}).listen(8080); //the server object listens on port 8080 