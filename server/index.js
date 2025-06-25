const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('client'));

io.on('connection', socket => {
  socket.on('join-room', room => {
    socket.join(room);
    socket.to(room).emit('user-connected');
  });

  socket.on('offer', data => socket.to(data.roomId).emit('offer', data));
  socket.on('answer', data => socket.to(data.roomId).emit('answer', data));
  socket.on('candidate', data => socket.to(data.roomId).emit('candidate', data));
  socket.on('chat', data => socket.to(data.roomId).emit('chat', data));
});

server.listen(8080, () => console.log('Server running at http://localhost:8080'));