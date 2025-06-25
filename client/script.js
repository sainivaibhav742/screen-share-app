
const socket = io();
const video = document.getElementById("screenVideo");
const shareBtn = document.getElementById("shareBtn");

let peerConnection;
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

shareBtn.onclick = async () => {
  const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  video.srcObject = stream;

  peerConnection = new RTCPeerConnection(config);
  stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

  peerConnection.onicecandidate = event => {
    if (event.candidate) socket.emit("candidate", event.candidate);
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit("offer", offer);
};

socket.on("offer", async (offer) => {
  peerConnection = new RTCPeerConnection(config);

  peerConnection.ontrack = event => {
    video.srcObject = event.streams[0];
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) socket.emit("candidate", event.candidate);
  };

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit("answer", answer);
});

socket.on("answer", answer => {
  peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("candidate", candidate => {
  peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});
