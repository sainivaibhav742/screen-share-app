const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("room");
const role = urlParams.get("role");

document.getElementById("room-id").innerText = roomId;
const video = document.getElementById("screenVideo");
const shareBtn = document.getElementById("shareBtn");
const stopBtn = document.getElementById("stopBtn");

let screenStream;
let peer = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
});

// ✅ Always set ontrack listener first
peer.ontrack = (event) => {
  console.log("📥 Viewer received stream:", event.streams[0]);
  video.srcObject = event.streams[0];
};

// ✅ Handle ICE candidates
peer.onicecandidate = (event) => {
  if (event.candidate) {
    socket.emit("candidate", { roomId, candidate: event.candidate });
  }
};

// ✅ Join room via socket
socket.emit("join-room", roomId);

if (role === "host") {
  // Start screen sharing
  shareBtn.onclick = async () => {
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    video.srcObject = screenStream;
    shareBtn.style.display = "none";
    stopBtn.style.display = "inline";

    // Add screen tracks to peer connection
    screenStream.getTracks().forEach(track => {
      peer.addTrack(track, screenStream);
    });

    // Send offer
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("offer", { roomId, offer });
  };

  // Stop screen share
  stopBtn.onclick = () => {
    screenStream.getTracks().forEach(track => track.stop());
    shareBtn.style.display = "inline";
    stopBtn.style.display = "none";
  };
} else {
  // Viewer should not see share button
  shareBtn.style.display = "none";
  stopBtn.style.display = "none";
}

// ✅ Receive offer (viewer side)
socket.on("offer", async ({ offer }) => {
  console.log("📩 Offer received");
  await peer.setRemoteDescription(offer);
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  socket.emit("answer", { roomId, answer });
});

// ✅ Receive answer (host side)
socket.on("answer", async ({ answer }) => {
  console.log("✅ Answer received");
  await peer.setRemoteDescription(answer);
});

// ✅ Receive ICE candidates (both sides)
socket.on("candidate", async ({ candidate }) => {
  if (candidate) {
    try {
      await peer.addIceCandidate(candidate);
    } catch (err) {
      console.error("❌ Error adding candidate", err);
    }
  }
});


// 🗨️ Chat system
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
  alert("✅ Invite link copied!");
};
