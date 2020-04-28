const WebSocket = require('ws');
let myid = -1;
const ws = new WebSocket('wss://ronanfinley-watchtower.glitch.me/ws');
ws.on('message', function incoming(data) {
    data = JSON.parse(data);
    switch(data.type) {
        case "ready":
            ws.send(JSON.stringify({
                type:'register',
                name: 'RonanFinley/autoapache',
                secret: 'lalalala'
            }));
            console.log("Registering...");
            break;
        case "success":
            console.log("Registered. ID: " + data.id);
            myid = data.id;
        case "forward":
            console.log("Recieved Forward!");
            console.log(data)
    }
});