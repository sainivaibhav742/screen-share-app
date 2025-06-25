const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("room");
const role = urlParams.get("role");

document.getElementById("room-id").innerText = roomId;
const video = document.getElementById("screenVideo");
const shareBtn = document.getElementById("shareBtn");
const stopBtn = document.getElementById("stopBtn");
const streamStatus = document.getElementById("streamStatus");

let screenStream;
let peer = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
});

peer.ontrack = (event) => {
  console.log("🎥 Viewer ontrack triggered!", event.streams);
  if (event.streams && event.streams[0]) {
    video.srcObject = event.streams[0];
    streamStatus.innerText = "✅ Viewer: Live Stream Active";
    streamStatus.style.color = "green";
  } else {
    console.warn("⚠️ No stream attached in ontrack event!");
  }
};

peer.onicecandidate = (event) => {
  if (event.candidate) {
    console.log("📡 ICE candidate sent:", event.candidate);
    socket.emit("candidate", { roomId, candidate: event.candidate });
  }
};

peer.onconnectionstatechange = () => {
  console.log("🔄 Connection State:", peer.connectionState);
};

socket.emit("join-room", roomId);

if (role === "host") {
  shareBtn.onclick = async () => {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      console.log("🖥️ Host captured stream:", screenStream);
      video.srcObject = screenStream;

      shareBtn.style.display = "none";
      stopBtn.style.display = "inline";

      screenStream.getTracks().forEach(track => {
        peer.addTrack(track, screenStream);
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      console.log("📤 Host sending offer");
      socket.emit("offer", { roomId, offer });
    } catch (err) {
      alert("Error sharing screen: " + err.message);
      console.error("❌ getDisplayMedia error:", err);
    }
  };

  stopBtn.onclick = () => {
    screenStream.getTracks().forEach(track => track.stop());
    shareBtn.style.display = "inline";
    stopBtn.style.display = "none";
    streamStatus.innerText = "🛑 Sharing stopped";
    streamStatus.style.color = "gray";
  };
} else {
  shareBtn.style.display = "none";
  stopBtn.style.display = "none";

setTimeout(() => {
  if (!video.srcObject) {
    console.warn("⚠️ Viewer did not receive any stream in time.");
    streamStatus.innerText = "❌ Viewer: No Stream Received. Retrying...";
    streamStatus.style.color = "red";

    // ⏳ Attempt to reconnect (send 'join-room' again)
    socket.emit("join-room", roomId);
  }
}, 5000);
}

// Handle signaling
socket.on("offer", async ({ offer }) => {
  try {
    console.log("📩 Viewer received offer");
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("answer", { roomId, answer });
  } catch (err) {
    console.error("❌ Error handling offer:", err);
  }
});

socket.on("answer", async ({ answer }) => {
  try {
    console.log("✅ Host received answer");
    await peer.setRemoteDescription(new RTCSessionDescription(answer));
  } catch (err) {
    console.error("❌ Error setting remote description:", err);
  }
});

socket.on("candidate", async ({ candidate }) => {
  if (candidate) {
    try {
      console.log("📶 Received ICE candidate", candidate);
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("🚨 Failed to add ICE candidate:", err);
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

// 🌙 Dark mode toggle
document.getElementById("toggleModeBtn").onclick = () => {
  document.body.classList.toggle("dark");
};

// 📋 Copy invite link
document.getElementById("copyLinkBtn").onclick = () => {
  const link = `${window.location.origin}/room.html?room=${roomId}&role=viewer`;
  navigator.clipboard.writeText(link);
  alert("✅ Invite link copied!");
};
