const socket = io();
const urlParams = new URLSearchParams(window.location.search);
let roomId = urlParams.get("room");
const role = urlParams.get("role");

// Debugging setup
const debugMode = true;
function log(...args) {
  if (debugMode) console.log(`[${role.toUpperCase()}]`, ...args);
}

log("Initializing...");
log(`Room ID: ${roomId}, Role: ${role}`);

if (!roomId || !role) {
  const newRoom = Math.random().toString(36).substring(2, 8);
  log(`Creating new room: ${newRoom}`);
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
let peer = null;
let candidateBuffer = [];
let isProcessingOffer = false;

// Enhanced peer connection creation
function createPeerConnection() {
  try {
    if (peer) {
      log("Closing existing peer connection");
      peer.close();
      peer = null;
    }

    log("Creating new peer connection");
    peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    peer.ontrack = (event) => {
      log("Received track event:", event);
      if (event.streams && event.streams[0]) {
        log("Stream received with tracks:", event.streams[0].getTracks());
        video.srcObject = event.streams[0];
        streamStatus.innerText = "✅ Live Stream Active";
        streamStatus.style.color = "green";
      }
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        log("Sending ICE candidate:", event.candidate);
        socket.emit("candidate", { roomId, candidate: event.candidate });
      } else {
        log("All ICE candidates sent");
      }
    };

    peer.oniceconnectionstatechange = () => {
      log("ICE connection state:", peer.iceConnectionState);
      streamStatus.innerText = `ICE: ${peer.iceConnectionState}`;
      
      if (peer.iceConnectionState === "failed") {
        streamStatus.style.color = "red";
        log("ICE connection failed");
        stopAllStreams();
      }
    };

    peer.onconnectionstatechange = () => {
      log("Connection state:", peer.connectionState);
      if (peer.connectionState === "failed") {
        alert("Connection failed! Please try again");
        stopAllStreams();
      }
    };
    
    peer.onsignalingstatechange = () => {
      log("Signaling state:", peer.signalingState);
    };

    // Process buffered candidates
    while (candidateBuffer.length > 0) {
      const candidate = candidateBuffer.shift();
      log("Processing buffered ICE candidate");
      peer.addIceCandidate(new RTCIceCandidate(candidate))
        .catch(err => log("Error adding buffered candidate:", err));
    }
  } catch (err) {
    log("Peer connection creation failed:", err);
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
    
    log("Requesting display media");
    screenStream = await navigator.mediaDevices.getDisplayMedia({ 
      video: true, 
      audio: true 
    });
    log("Display media obtained with tracks:", screenStream.getTracks());

    try {
      log("Requesting microphone");
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      mic.getAudioTracks().forEach(track => {
        log("Adding microphone track");
        screenStream.addTrack(track);
      });
    } catch (micErr) {
      log("Mic access denied:", micErr);
      alert("⚠️ Mic access denied or not available.");
    }

    log("Adding tracks to peer connection");
    screenStream.getTracks().forEach(track => {
      peer.addTrack(track, screenStream);
    });

    video.srcObject = screenStream;
    updateStatusIndicators();

    log("Creating offer");
    const offer = await peer.createOffer();
    log("Setting local description");
    await peer.setLocalDescription(offer);
    
    log("Sending offer to server");
    socket.emit("offer", { roomId, offer });

    shareBtn.style.display = "none";
    stopBtn.style.display = "inline";
  } catch (err) {
    log("Screen sharing failed:", err);
    alert("Screen sharing failed: " + err.message);
  }
}

function stopAllStreams() {
  log("Stopping all streams");
  screenStream?.getTracks().forEach(t => {
    log("Stopping screen track:", t.kind);
    t.stop();
  });
  webcamStream?.getTracks().forEach(t => {
    log("Stopping webcam track:", t.kind);
    t.stop();
  });
  
  if (peer) {
    log("Closing peer connection");
    peer.close();
    peer = null;
  }
  
  video.srcObject = null;
  webcamVideo.srcObject = null;
  shareBtn.style.display = "inline";
  stopBtn.style.display = "none";
  
  micStatus.innerText = "🎤 Mic: Off";
  sysStatus.innerText = "🔊 System Audio: Off";
}

async function toggleWebcam() {
  if (webcamStream) {
    log("Turning off webcam");
    webcamStream.getTracks().forEach(t => t.stop());
    webcamStream = null;
    webcamVideo.srcObject = null;
    camBtn.innerText = "📷 Turn On Camera";
  } else {
    try {
      log("Turning on webcam");
      if (!peer) createPeerConnection();
      
      webcamStream = await navigator.mediaDevices.getUserMedia({ video: true });
      log("Webcam obtained with tracks:", webcamStream.getTracks());
      webcamVideo.srcObject = webcamStream;
      webcamStream.getTracks().forEach(track => {
        log("Adding webcam track");
        peer.addTrack(track, webcamStream);
      });
      camBtn.innerText = "📷 Turn Off Camera";
    } catch (err) {
      log("Camera access error:", err);
      alert("Camera access denied or not available.");
    }
  }
}

socket.emit("join-room", roomId);
log(`Joined room: ${roomId}`);

// Event listeners for buttons
if (role === "host") {
  log("Initializing as host");
  shareBtn.onclick = startScreenShare;
  stopBtn.onclick = stopAllStreams;
  camBtn.onclick = toggleWebcam;
} else {
  log("Initializing as viewer");
  shareBtn.style.display = "none";
  stopBtn.style.display = "none";
  camBtn.style.display = "none";

  streamStatus.innerText = "⏳ Waiting for host stream...";
  streamStatus.style.color = "orange";
  
  socket.once("offer", () => {
    log("Offer received from host");
    streamStatus.innerText = "🟡 Connecting to stream...";
    streamStatus.style.color = "orange";
  });
  
  setTimeout(() => {
    if (!video.srcObject || video.srcObject.getTracks().length === 0) {
      log("Stream timeout - no stream received");
      streamStatus.innerText = "❌ Failed to receive stream";
      streamStatus.style.color = "red";
    }
  }, 30000);
}

// Signaling event handlers
socket.on("offer", async ({ offer }) => {
  log("Received offer from server");
  if (role !== "viewer") return;
  
  try {
    log("Processing offer");
    isProcessingOffer = true;
    createPeerConnection();
    log("Setting remote description");
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    
    log("Creating answer");
    const answer = await peer.createAnswer();
    log("Setting local description");
    await peer.setLocalDescription(answer);
    
    log("Sending answer to server");
    socket.emit("answer", { roomId, answer });
  } catch (err) {
    log("Error processing offer:", err);
  } finally {
    isProcessingOffer = false;
  }
});

socket.on("answer", async ({ answer }) => {
  log("Received answer from server");
  if (!peer || role !== "host") return;
  
  try {
    log("Setting remote description (answer)");
    await peer.setRemoteDescription(new RTCSessionDescription(answer));
    log("Remote description set successfully");
  } catch (err) {
    log("Error setting remote description:", err);
  }
});

socket.on("candidate", async ({ candidate }) => {
  log("Received ICE candidate from server");
  try {
    if (!peer) {
      log("Buffering candidate - peer not ready");
      candidateBuffer.push(candidate);
      return;
    }
    
    if (isProcessingOffer) {
      log("Buffering candidate - offer processing");
      candidateBuffer.push(candidate);
      return;
    }
    
    log("Adding ICE candidate");
    await peer.addIceCandidate(new RTCIceCandidate(candidate));
    log("ICE candidate added successfully");
  } catch (err) {
    log("ICE candidate error:", err);
  }
});

// Chat functionality
const messages = document.getElementById("messages");
document.getElementById("chatInput").addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg) return;
  log("Sending chat message:", msg);
  socket.emit("chat", { roomId, msg });
  appendMsg(`🧑 You: ${msg}`);
  input.value = "";
}

socket.on("chat", ({ msg }) => {
  log("Received chat message:", msg);
  appendMsg(`👤 ${role === 'host' ? 'Viewer' : 'Host'}: ${msg}`);
});

function appendMsg(m) {
  messages.innerHTML += `<div>${m}</div>`;
  messages.scrollTop = messages.scrollHeight;
}

// UI Controls
document.getElementById("toggleModeBtn").onclick = () => {
  document.body.classList.toggle("dark");
};

document.getElementById("copyLinkBtn").onclick = () => {
  const link = `${window.location.origin}/room.html?room=${roomId}&role=viewer`;
  navigator.clipboard.writeText(link);
  alert("✅ Link copied:\n" + link);
};

// YouTube integration
function embedYouTube() {
  const ytUrl = document.getElementById("ytLink").value.trim();
  if (!ytUrl) return;
  
  log("Processing YouTube URL:", ytUrl);
  let videoId;
  
  if (ytUrl.includes("youtu.be")) {
    videoId = ytUrl.split("/").pop().split("?")[0];
  } else if (ytUrl.includes("youtube.com")) {
    const match = ytUrl.match(/[?&]v=([^&]+)/);
    videoId = match ? match[1] : null;
  }
  
  if (!videoId) {
    alert("Invalid YouTube link");
    return;
  }
  
  log("Embedding YouTube video:", videoId);
  document.getElementById("ytPlayer").innerHTML = `
    <iframe width="560" height="315" 
            src="https://www.youtube.com/embed/${videoId}?autoplay=1"
            frameborder="0" 
            allow="autoplay; encrypted-media" 
            allowfullscreen></iframe>`;
}