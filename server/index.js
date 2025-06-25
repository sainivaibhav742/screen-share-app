const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const path = require("path");

app.use(express.static(path.join(__dirname, "../client")));

io.on("connection", socket => {
  socket.on("join-room", room => {
    socket.join(room);
  });

  socket.on("offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("offer", { offer });
  });

  socket.on("answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("answer", { answer });
  });

  socket.on("candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("candidate", { candidate });
  });

  socket.on("chat", ({ roomId, msg }) => {
    socket.to(roomId).emit("chat", { msg });
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
