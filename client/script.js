const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("room");
const role = urlParams.get("role");

document.getElementById("room-id").innerText = roomId;
const video = document.getElementById("screenVideo");
const shareBtn = document.getElementById("shareBtn");
const stopBtn = document.getElementById("stopBtn");
const streamStatus = document.getElementById("streamStatus");

let screenStream = null;
let peer = null;

function createPeerConnection() {
  peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  peer.ontrack = (event) => {
    console.log("🎥 Stream received!");
    video.srcObject = event.streams[0];
    video.play().catch(console.error);
    streamStatus.innerText = "✅ Viewer: Live Stream Active";
    streamStatus.style.color = "green";
  };

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("candidate", { roomId, candidate: event.candidate });
    }
  };
}

createPeerConnection();

// Socket: Join room
socket.emit("join-room", roomId);

// 🎥 HOST SIDE
if (role === "host") {
  shareBtn.onclick = async () => {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      video.srcObject = screenStream;
      shareBtn.style.display = "none";
      stopBtn.style.display = "inline";

      screenStream.getTracks().forEach(track => {
        peer.addTrack(track, screenStream);
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("offer", { roomId, offer });
    } catch (err) {
      alert("Screen sharing failed: " + err.message);
    }
  };

  stopBtn.onclick = () => {
    screenStream.getTracks().forEach(t => t.stop());
    shareBtn.style.display = "inline";
    stopBtn.style.display = "none";
    video.srcObject = null;
    createPeerConnection(); // reset peer
  };
} else {
  shareBtn.style.display = "none";
  stopBtn.style.display = "none";

  setTimeout(() => {
    if (!video.srcObject) {
      streamStatus.innerText = "❌ Viewer: No Stream Received";
      streamStatus.style.color = "red";
    }
  }, 5000);
}

// 📡 Viewer receives offer
socket.on("offer", async ({ offer }) => {
  try {
    console.log("📩 Viewer received offer");
    if (!peer) createPeerConnection();
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("answer", { roomId, answer });
  } catch (err) {
    console.error("Offer handling error:", err);
  }
});

// Host receives answer
socket.on("answer", async ({ answer }) => {
  try {
    console.log("✅ Host received answer");
    await peer.setRemoteDescription(new RTCSessionDescription(answer));
  } catch (err) {
    console.error("Answer set failed:", err);
  }
});

// Candidate sharing
socket.on("candidate", async ({ candidate }) => {
  if (candidate) {
    try {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("ICE candidate error:", err);
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

// 🌙 Dark Mode
document.getElementById("toggleModeBtn").onclick = () => {
  document.body.classList.toggle("dark");
};

// 📋 Copy Invite
document.getElementById("copyLinkBtn").onclick = () => {
  const link = `${window.location.origin}/room.html?room=${roomId}&role=viewer`;
  navigator.clipboard.writeText(link);
  alert("✅ Link copied!");
};
