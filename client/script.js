const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("room");
const role = urlParams.get("role");

document.getElementById("room-id").innerText = roomId;
const video = document.getElementById("screenVideo");
const shareBtn = document.getElementById("shareBtn");
const stopBtn = document.getElementById("stopBtn");

let peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
let screenStream;

socket.emit("join-room", roomId);

if (role === "host") {
  shareBtn.onclick = async () => {
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    video.srcObject = screenStream;
    shareBtn.style.display = "none";
    stopBtn.style.display = "inline";

    screenStream.getTracks().forEach(track => peer.addTrack(track, screenStream));

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("offer", { roomId, offer });
  };

  stopBtn.onclick = () => {
    screenStream.getTracks().forEach(track => track.stop());
    shareBtn.style.display = "inline";
    stopBtn.style.display = "none";
  };
} else {
  shareBtn.style.display = "none";
}

peer.ontrack = event => {
  video.srcObject = event.streams[0];
};

peer.onicecandidate = e => {
  if (e.candidate) socket.emit("candidate", { roomId, candidate: e.candidate });
};

socket.on("offer", async ({ offer }) => {
  await peer.setRemoteDescription(offer);
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  socket.emit("answer", { roomId, answer });
});

socket.on("answer", ({ answer }) => {
  peer.setRemoteDescription(answer);
});

socket.on("candidate", ({ candidate }) => {
  peer.addIceCandidate(candidate);
});

// 🔁 Chat
const messages = document.getElementById("messages");
document.getElementById("chatInput").addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});
function sendMessage() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg) return;
  socket.emit("chat", { roomId, msg });
  appendMsg(`🧑 You: ${msg}`);
  input.value = "";
}
socket.on("chat", ({ msg }) => appendMsg(`👤 Viewer: ${msg}`));
function appendMsg(m) {
  messages.innerHTML += `<div>${m}</div>`;
  messages.scrollTop = messages.scrollHeight;
}

// 🌙 Toggle Dark Mode
document.getElementById("toggleModeBtn").onclick = () => {
  document.body.classList.toggle("dark");
};

// 📋 Copy Invite Link
document.getElementById("copyLinkBtn").onclick = () => {
  const link = `${window.location.origin}/room.html?room=${roomId}&role=viewer`;
  navigator.clipboard.writeText(link);
  alert("Invite link copied!");
};
