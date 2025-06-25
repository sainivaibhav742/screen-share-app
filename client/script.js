const socket = io();
const urlParams = new URLSearchParams(window.location.search);
let roomId = urlParams.get("room");
const role = urlParams.get("role");

// 🔧 Auto-generate room if not present
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
let peer = null;

function createPeerConnection() {
  peer = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  // Viewer: Receive screen stream
  peer.ontrack = (event) => {
    console.log("🟣 Viewer: Received ontrack");
    if (event.streams && event.streams[0]) {
      video.srcObject = event.streams[0];
      streamStatus.innerText = "✅ Viewer: Live Stream Active";
      streamStatus.style.color = "green";
    } else {
      console.warn("⚠️ No stream found on event.");
    }
  };

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("candidate", { roomId, candidate: event.candidate });
    }
  };
}

createPeerConnection();
socket.emit("join-room", roomId);

// 📺 Host: Start screen sharing
if (role === "host") {
  shareBtn.onclick = async () => {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
          cursor: "always"
        },
        audio: false
      });

      video.srcObject = screenStream;

      screenStream.getTracks().forEach(track => {
        peer.addTrack(track, screenStream);
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("offer", { roomId, offer });

      shareBtn.style.display = "none";
      stopBtn.style.display = "inline";
    } catch (err) {
      alert("Screen sharing failed: " + err.message);
      console.error("⛔ Error:", err);
    }
  };

  stopBtn.onclick = () => {
    screenStream.getTracks().forEach(t => t.stop());
    peer.close();
    createPeerConnection();
    video.srcObject = null;
    shareBtn.style.display = "inline";
    stopBtn.style.display = "none";
  };
} else {
  // Viewer UI
  shareBtn.style.display = "none";
  stopBtn.style.display = "none";

  // If no stream received in 10 seconds
  let attempts = 0;
  const checkStream = setInterval(() => {
    if (video.srcObject) {
      clearInterval(checkStream);
      return;
    }
    attempts++;
    if (attempts >= 10) {
      streamStatus.innerText = "❌ Viewer: No Stream Received";
      streamStatus.style.color = "red";
      clearInterval(checkStream);
    }
  }, 1000);
}

// 🔄 WebRTC Signaling

socket.on("offer", async ({ offer }) => {
  try {
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("answer", { roomId, answer });
  } catch (err) {
    console.error("⚠️ Offer error:", err);
  }
});

socket.on("answer", async ({ answer }) => {
  try {
    await peer.setRemoteDescription(new RTCSessionDescription(answer));
  } catch (err) {
    console.error("⚠️ Answer error:", err);
  }
});

socket.on("candidate", async ({ candidate }) => {
  try {
    if (candidate) {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    }
  } catch (err) {
    console.error("⚠️ ICE error:", err);
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

// 📋 Copy link
document.getElementById("copyLinkBtn").onclick = () => {
  const link = `${window.location.origin}/room.html?room=${roomId}&role=viewer`;
  navigator.clipboard.writeText(link);
  alert("✅ Link copied:\n" + link);
};
