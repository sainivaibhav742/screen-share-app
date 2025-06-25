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
const webcamVideo = document.getElementById("webcamVideo");
const shareBtn = document.getElementById("shareBtn");
const stopBtn = document.getElementById("stopBtn");
const camBtn = document.getElementById("camBtn");
const streamStatus = document.getElementById("streamStatus");
const micStatus = document.getElementById("micStatus");
const sysStatus = document.getElementById("sysStatus");

let screenStream = null;
let webcamStream = null;
let remoteStream = new MediaStream();
let peer = null;

function createPeerConnection() {
  try {
    if (peer) {
      peer.close();
      peer = null;
    }

    peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    peer.ontrack = (event) => {
      if (event.streams[0]) {
        video.srcObject = event.streams[0];
        streamStatus.innerText = "✅ Viewer: Live Stream Active";
        streamStatus.style.color = "green";
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("candidate", { roomId, candidate: event.candidate });
      }
    };

    peer.onconnectionstatechange = () => {
      console.log("Connection state:", peer.connectionState);
      if (peer.connectionState === "failed") {
        alert("Connection failed! Please try again");
        stopAllStreams();
      }
    };
  } catch (err) {
    console.error("Peer connection creation failed:", err);
    alert("WebRTC connection error: " + err.message);
  }
}

function updateStatusIndicators() {
  const hasMic = screenStream?.getAudioTracks().some(t => t.kind === 'audio' && t.label.toLowerCase().includes('microphone'));
  const hasSystem = screenStream?.getAudioTracks().some(t => t.kind === 'audio' && !t.label.toLowerCase().includes('microphone'));

  micStatus.innerText = `🎤 Mic: ${hasMic ? "On" : "Off"}`;
  sysStatus.innerText = `🔊 System Audio: ${hasSystem ? "On" : "Off"}`;
}

async function startScreenShare() {
  try {
    createPeerConnection();
    screenStream = await navigator.mediaDevices.getDisplayMedia({ 
      video: true, 
      audio: true 
    });

    // Add mic if available
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      mic.getAudioTracks().forEach(track => screenStream.addTrack(track));
    } catch {
      alert("⚠️ Mic access denied or not available.");
    }

    screenStream.getTracks().forEach(track => peer.addTrack(track, screenStream));
    video.srcObject = screenStream;

    updateStatusIndicators();

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket.emit("offer", { roomId, offer });

    shareBtn.style.display = "none";
    stopBtn.style.display = "inline";
  } catch (err) {
    console.error("Screen sharing failed:", err);
    alert("Screen sharing failed: " + err.message);
  }
}

function stopAllStreams() {
  screenStream?.getTracks().forEach(t => t.stop());
  webcamStream?.getTracks().forEach(t => t.stop());
  
  if (peer) {
    peer.close();
    peer = null;
  }
  
  video.srcObject = null;
  webcamVideo.srcObject = null;
  shareBtn.style.display = "inline";
  stopBtn.style.display = "none";
  
  // Reset status indicators
  micStatus.innerText = "🎤 Mic: Off";
  sysStatus.innerText = "🔊 System Audio: Off";
}

async function toggleWebcam() {
  if (webcamStream) {
    webcamStream.getTracks().forEach(t => t.stop());
    webcamStream = null;
    webcamVideo.srcObject = null;
    camBtn.innerText = "📷 Turn On Camera";
  } else {
    try {
      if (!peer) createPeerConnection();
      
      webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
      webcamVideo.srcObject = webcamStream;
      webcamStream.getTracks().forEach(track => peer.addTrack(track, webcamStream));
      camBtn.innerText = "📷 Turn Off Camera";
    } catch {
      alert("Camera access denied or not available.");
    }
  }
}

socket.emit("join-room", roomId);

if (role === "host") {
  shareBtn.onclick = startScreenShare;
  stopBtn.onclick = stopAllStreams;
  camBtn.onclick = toggleWebcam;
} else {
  shareBtn.style.display = "none";
  stopBtn.style.display = "none";
  camBtn.style.display = "none";

  // Improved viewer connection handling
  streamStatus.innerText = "⏳ Waiting for host stream...";
  streamStatus.style.color = "orange";
  
  socket.once("offer", () => {
    streamStatus.innerText = "🟡 Connecting to stream...";
    streamStatus.style.color = "orange";
  });
  
  setTimeout(() => {
    if (!video.srcObject) {
      streamStatus.innerText = "❌ Failed to receive stream";
      streamStatus.style.color = "red";
    }
  }, 15000); // 15 seconds timeout
}

socket.on("offer", async ({ offer }) => {
  if (role !== "viewer") return;
  
  createPeerConnection();
  await peer.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  socket.emit("answer", { roomId, answer });
});

socket.on("answer", async ({ answer }) => {
  if (!peer) return;
  await peer.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("candidate", async ({ candidate }) => {
  try {
    if (!peer) {
      console.warn("Received ICE candidate but peer is not initialized");
      return;
    }
    await peer.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.warn("ICE candidate error:", err);
  }
});

// Chat
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

socket.on("chat", ({ msg }) => appendMsg(`👤 ${role === 'host' ? 'Viewer' : 'Host'}: ${msg}`));

function appendMsg(m) {
  messages.innerHTML += `<div>${m}</div>`;
  messages.scrollTop = messages.scrollHeight;
}

// Dark mode
document.getElementById("toggleModeBtn").onclick = () => {
  document.body.classList.toggle("dark");
};

// Copy invite link
document.getElementById("copyLinkBtn").onclick = () => {
  const link = `${window.location.origin}/room.html?room=${roomId}&role=viewer`;
  navigator.clipboard.writeText(link);
  alert("✅ Link copied:\n" + link);
};

// YouTube stream
function embedYouTube() {
  const ytUrl = document.getElementById("ytLink").value.trim();
  if (!ytUrl.includes("youtube.com") && !ytUrl.includes("youtu.be")) return alert("Invalid YouTube link");
  
  let videoId;
  if (ytUrl.includes("youtu.be")) {
    videoId = ytUrl.split("/").pop().split("?")[0];
  } else {
    videoId = ytUrl.split("v=")[1]?.split("&")[0];
  }
  
  if (!videoId) return alert("Could not extract video ID");
  
  document.getElementById("ytPlayer").innerHTML = `
    <iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}?autoplay=1"
    frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
}