
// Full script with screen sharing, mic, camera, and YouTube sync
const socket = io();
const urlParams = new URLSearchParams(window.location.search);
let roomId = urlParams.get("room");
const role = urlParams.get("role");

if (!roomId || !role) {
  const newRoom = Math.random().toString(36).substring(2, 8);
  window.location.href = `/room.html?room=${newRoom}&role=host`;
}

document.getElementById("room-id").innerText = roomId;
const video = document.getElementById("screenVideo");
const shareBtn = document.getElementById("shareBtn");
const stopBtn = document.getElementById("stopBtn");
const streamStatus = document.getElementById("streamStatus");
let screenStream = null;
let remoteStream = new MediaStream();
let peer = null;

function createPeerConnection() {
  peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  peer.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      video.srcObject = event.streams[0];
      streamStatus.innerText = "✅ Viewer: Live Stream Active";
    }
  };
  peer.onicecandidate = (event) => {
    if (event.candidate) socket.emit("candidate", { roomId, candidate: event.candidate });
  };
}

createPeerConnection();
socket.emit("join-room", roomId);

if (role === "host") {
  shareBtn.onclick = async () => {
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    mic.getAudioTracks().forEach(track => screenStream.addTrack(track));
    screenStream.getTracks().forEach(track => peer.addTrack(track, screenStream));
    video.srcObject = screenStream;
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("offer", { roomId, offer });
    shareBtn.style.display = "none";
    stopBtn.style.display = "inline";
  };

  stopBtn.onclick = () => {
    screenStream.getTracks().forEach(t => t.stop());
    peer.close();
    createPeerConnection();
    shareBtn.style.display = "inline";
    stopBtn.style.display = "none";
  };
} else {
  shareBtn.style.display = "none";
  stopBtn.style.display = "none";
}

socket.on("offer", async ({ offer }) => {
  await peer.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  socket.emit("answer", { roomId, answer });
});

socket.on("answer", async ({ answer }) => {
  await peer.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("candidate", async ({ candidate }) => {
  await peer.addIceCandidate(new RTCIceCandidate(candidate));
});

// Chat
const messages = document.getElementById("messages");
document.getElementById("chatInput").addEventListener("keypress", e => { if (e.key === "Enter") sendMessage(); });
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

// Dark mode toggle
document.getElementById("toggleModeBtn").onclick = () => document.body.classList.toggle("dark");

// Copy invite link
document.getElementById("copyLinkBtn").onclick = () => {
  const link = `${window.location.origin}/room.html?room=${roomId}&role=viewer`;
  navigator.clipboard.writeText(link);
  alert("✅ Link copied: " + link);
};

// YouTube embedding
function embedYouTube() {
  const ytUrl = document.getElementById("ytLink").value.trim();
  if (!ytUrl.includes("youtube.com") && !ytUrl.includes("youtu.be")) return alert("Invalid YouTube link");
  const videoId = ytUrl.split("v=")[1]?.split("&")[0] || ytUrl.split("/").pop();
  document.getElementById("ytPlayer").innerHTML = `
    <iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}?autoplay=1"
      frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
  `;
}
