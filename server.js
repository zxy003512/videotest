// server.js (Node.js + ws)
const { createServer } = require('http');
const { readFileSync } = require('fs');
const { join } = require('path');
const WebSocket = require('ws');

const index = readFileSync(join(__dirname,'index.html'));

const server = createServer((req,res)=>{
  // 其余所有 GET 请求都返回 index.html（SPA）：
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  res.end(index);
});

const wss = new WebSocket.Server({ noServer: true });
const rooms = {}; // { room: { password, clients: [] } }

wss.on('connection',(ws)=>{
  let curRoom = null;
  ws.on('message',msg=>{
    let data;
    try { data = JSON.parse(msg) } catch { return }
    const { type, room, password, signal } = data;
    if (type==='join') {
      if (!room||!password) {
        return ws.send(JSON.stringify({type:'error',reason:'参数不足'}));
      }
      if (!rooms[room]) rooms[room] = { password, clients: [] };
      if (rooms[room].password !== password) {
        return ws.send(JSON.stringify({type:'error',reason:'密码错误'}));
      }
      curRoom = room;
      rooms[room].clients.push(ws);
      const initiator = rooms[room].clients.length===1;
      ws.send(JSON.stringify({type:'joined',initiator}));
      return;
    }
    if (type==='signal' && curRoom) {
      rooms[curRoom].clients.forEach(c=>{
        if (c!==ws && c.readyState===1) {
          c.send(JSON.stringify({type:'signal',signal}));
        }
      });
    }
  });
  ws.on('close',()=>{
    if (curRoom && rooms[curRoom]) {
      rooms[curRoom].clients = rooms[curRoom].clients.filter(c=>c!==ws);
      if (!rooms[curRoom].clients.length) delete rooms[curRoom];
    }
  });
});

server.on('upgrade',(req,socket,head)=>{
  // 把 /ws 的 Upgrade 请求交给 wss
  if (req.url === '/ws') {
    wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
  } else {
    socket.destroy();
  }
});

server.listen(3000,()=> console.log('listen on 3000'));
