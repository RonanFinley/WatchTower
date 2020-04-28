const {
  createServer
} = require("http"),
  url = require('url'),
  https = require('https'),
  express = require("express"),
  bodyParser = require("body-parser"),
  multer = require("multer"),
  upload = multer(),
  app = express(),
  WebSocket = require("ws"),
  me = require("./package.json"), //just for metadata
  shasum = require('crypto').createHash('sha1');

console.log(" ____      ____      _          __        _________");
console.log("|_  _|    |_  _|    / |_       [  |      |  _   _  |           v" + me.version);
console.log("  \\ \\  /\\  / /,--. `| |-'.---.  | |--.   |_/ | | \\_|.--.   _   _   __  .---.  _ .--.  ");
console.log("   \\ \\/  \\/ /`'_\\ : | | / /'`\\] | .-. |      | |  / .'`\\ \\[ \\ [ \\ [  ]/ /__\\\\[ `/'`\\]");
console.log("    \\  /\\  / // | |,| |,| \\__.  | | | |     _| |_ | \\__. | \\ \\/\\ \\/ / | \\__., | |");
console.log("     \\/  \\/  \\'-;__/\\__/'.___.'[___]|__]   |_____| '.__.'   \\__/\\__/   '.__.'[___]");
let registry = []; //{repo, secret, connection, conInfo}
app.get("/payload", function (req, res) {
  res.render("form");
});
app.get("/register", function (req, res) {
  res.render("form");
});
// for parsing application/json
app.use(bodyParser.json());

// for parsing application/xwww-
app.use(bodyParser.urlencoded({
  extended: true
}));
//form-urlencoded

// for parsing multipart/form-data
app.use(upload.array());

app.post("/payload", function (req, res) {
  //console.log(req);
  console.log(req.headers);
  res.send("WatchTower v" + me.version);
  for (var i = 0; i < registry.length; i++) {
    if (req.body.repository.full_name === registry[i].repo && req.header('x-hub-signature') === registry[i].secret) {
      if (registry[i].connection == 'ws') {
        forwardWS(registry[i].coninfo, req.body);
      } else if (registry[i].connection == 'http') {
        forwardHTTP(registry[i].coninfo, req.body, req.headers);
      }
    }
  }
});
app.post("/register", function (req, res) {
  console.log(req.body);
  var newid = registry.push({
    'repo': req.body.repo,
    'secret': crypto.createHash('sha1').update(req.body.secret).digest('hex'),
    'connection': 'http',
    'coninfo': req.body.url
  });
  res.send("success");
});

const listener = app.listen(8080, () => {
  console.log("WatchTower is listening on port " + listener.address().port);
});

const server = createServer(app);
const wss = new WebSocket.Server({
  server
});
wss.on("connection", function (ws) {
  ws.id = -1;
  while (ws.id == -1 || !uniqID(ws.id)) {
    ws.id = Math.floor(Math.random() * 9999999);
  }
  ws.send(JSON.stringify({
    'type': 'ready'
  }));
  console.log("Listener Connected")
  ws.on("message", function (message) {
    var data = JSON.parse(message);
    switch (data.type) {
      case "register":
        //{type:register,name:RonanFinley/autoapache,secret:SHA1}
        var newid = registry.push({
          'repo': data.name,
          'secret': crypto.createHash('sha1').update(data.secret).digest('hex'),
          'connection': 'ws',
          'coninfo': ws.id
        });
        ws.send({
          type: 'success',
          id: newid
        });
        console.log("Listener watching for " + data.name);
        break;
      case "deregister":
        if (data.id < 0 || data.id >= registry.length) {
          ws.send(JSON.stringify({
            'type': 'error',
            'error': 'bad id ' + data.id
          }));
        } else if (registry[data.id].coninfo == ws.id) {
          registry.splice(data.id, 1);
          ws.send(JSON.stringify({
            type: 'deregister'
          }))
        } else {
          ws.send(JSON.stringify({
            'type': 'error',
            'error': 'bad id ' + data.id
          }));
        }
        break;
      default:
        ws.send(JSON.stringify({
          'type': 'error',
          'error': 'unknown operation ' + data.type
        }));
    }
  });
});

function uniqID(id) {
  wss.clients.forEach(function each(client) {
    if (client.id == id) {
      return false;
    }
  });
  return true;
}

function forwardWS(id, payload, headers) {
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN && client.id == id) {
      client.send({
        type: 'forward',
        body: payload,
        headers: headers
      });
      console.log("Successful WS forward for " + payload.repository.full_name)
    }
  });
}

function forwardHTTP(id, req, headers) {
  var to = url.parse(id)

  var options = {
    hostname: to.host,
    port: to.port,
    path: to.path,
    method: 'POST',
    headers: {
      'Content-Type': headers['content-type'],
      'Content-Length': req.body.length,
      'x-github-event': headers['x-github-event'],
      'x-github-delivery': headers['x-github-delivery'],
      'x-hub-signature': headers['x-hub-signature'],
      'x-forwarded-host': headers['x-forwarded-host'],
      'traceparent': headers['traceparent'],
      'user-agent': headers['user-agent'],
    }
  }

  var req = https.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`)
    res.on('data', d => {})
  })

  req.on('error', error => {
    console.error(error)
  })

  req.write(req.body)
  req.end()
}