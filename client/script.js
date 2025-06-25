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

// Always set ontrack early
peer.ontrack = (event) => {
  console.log("👁️ Viewer received remote stream.");
  video.srcObject = event.streams[0];
};

peer.onicecandidate = (event) => {
  if (event.candidate) {
    socket.emit("candidate", { roomId, candidate: event.candidate });
  }
};

// Emit join
socket.emit("join-room", roomId);

// ----- HOST -----
if (role === "host") {
  shareBtn.onclick = async () => {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      video.srcObject = screenStream;
      shareBtn.style.display = "none";
      stopBtn.style.display = "inline";

      // Add track
      screenStream.getTracks().forEach(track => {
        peer.addTrack(track, screenStream);
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("offer", { roomId, offer });
    } catch (err) {
      alert("Error sharing screen: " + err.message);
    }
  };

  stopBtn.onclick = () => {
    screenStream.getTracks().forEach(track => track.stop());
    shareBtn.style.display = "inline";
    stopBtn.style.display = "none";
  };
} else {
  shareBtn.style.display = "none";
  stopBtn.style.display = "none";
}

// ----- VIEWER -----
socket.on("offer", async ({ offer }) => {
  try {
    console.log("📩 Viewer received offer");
    await peer.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("answer", { roomId, answer });
  } catch (err) {
    console.error("Error handling offer:", err);
  }
});

socket.on("answer", async ({ answer }) => {
  try {
    console.log("✅ Host received answer");
    await peer.setRemoteDescription(new RTCSessionDescription(answer));
  } catch (err) {
    console.error("Error setting remote description on host:", err);
  }
});

socket.on("candidate", async ({ candidate }) => {
  if (candidate) {
    try {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("Failed to add ICE candidate:", err);
    }
  }
});

// 💬 Chat
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

// 🌙 Dark mode
document.getElementById("toggleModeBtn").onclick = () => {
  document.body.classList.toggle("dark");
};

// 📋 Copy room invite
document.getElementById("copyLinkBtn").onclick = () => {
  const link = `${window.location.origin}/room.html?room=${roomId}&role=viewer`;
  navigator.clipboard.writeText(link);
  alert("✅ Invite link copied!");
};
