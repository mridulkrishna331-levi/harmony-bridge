import React, { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff, ScreenShare, PhoneOff, Send, Smile, Paperclip, Music, Play, Square, Volume2, Save, Download, FileText, Check, X, Maximize2, Pin, PinOff, MessageSquare } from 'lucide-react';

// Dynamic remote video element wrapper to bind srcObject reliably
const RemoteVideo = ({ peer, className }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;
    if (peer.stream) {
      console.log("Binding stream to remote video element for peer:", peer.username, peer.stream.id);
      videoRef.current.srcObject = peer.stream;
      // Force-play: some browsers defer autoplay until srcObject is set
      videoRef.current.play().catch(() => {});
    } else {
      // Clear stale srcObject when peer stream is removed
      videoRef.current.srcObject = null;
    }
  }, [peer.stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={false}
      className={className}
    />
  );
};

const JamRoom = ({ user, socket, roomId, setTargetRoomId, setActiveView }) => {
  const [joinedRoomId, setJoinedRoomId] = useState(roomId || '');
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState([]); // Array of { socketId, userId, username, stream, isMuted, isCamOff, avatarUrl }
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [bpmInput, setBpmInput] = useState(120);
  const [keySignature, setKeySignature] = useState('C Major');
  const [metronomePlaying, setMetronomePlaying] = useState(false);
  const [pinnedParticipantId, setPinnedParticipantId] = useState(null); // 'local' or peer.socketId
  const [chatPanelOpen, setChatPanelOpen] = useState(false);

  const handleTogglePin = (id) => {
    setPinnedParticipantId(prev => prev === id ? null : id);
  };

  useEffect(() => {
    if (roomId) {
      setJoinedRoomId(roomId);
    }
  }, [roomId]);
  
  // Timer State
  const [sessionTime, setSessionTime] = useState(0);

  // Chat State
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [notes, setNotes] = useState('Session Notes:\n- Practice chord progressions in G Major\n- Synced metronome configured to 120 BPM');
  const [notesSaved, setNotesSaved] = useState(true);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBlobUrl, setRecordingBlobUrl] = useState(null);

  // Synced Owner, Dismissable alerts, Manual room join states
  const [roomOwner, setRoomOwner] = useState(null);
  const [hideChatPlaceholder, setHideChatPlaceholder] = useState(false);
  const [manualRoomId, setManualRoomId] = useState('');

  const localVideoRef = useRef(null);
  const peerConnections = useRef({}); // socketId -> RTCPeerConnection
  const iceCandidatesQueue = useRef({}); // socketId -> Array of RTCIceCandidate
  const localStreamRef = useRef(null);
  const metronomeInterval = useRef(null);
  const metronomeAudioCtx = useRef(null);
  const metronomeTimeoutId = useRef(null);
  const isPlayingRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const recordedChunks = useRef([]);
  const canvasStreamTimer = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    isPlayingRef.current = metronomePlaying;
  }, [metronomePlaying]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Setup client media stream dynamically on room join
  useEffect(() => {
    if (joinedRoomId) {
      setupLocalStream();
    }
  }, [joinedRoomId]);

  // Start timer on mount
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionTime((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
      if (canvasStreamTimer.current) clearInterval(canvasStreamTimer.current);
      
      // Clean up metronome (thread-safe termination)
      isPlayingRef.current = false;
      if (metronomeInterval.current) clearInterval(metronomeInterval.current);
      if (metronomeTimeoutId.current) clearTimeout(metronomeTimeoutId.current);
      if (metronomeAudioCtx.current) {
        try {
          metronomeAudioCtx.current.close();
        } catch (err) {}
      }

      // Stop local tracks on unmount
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      localStreamRef.current = null;
    };
  }, []);

  // WebRTC socket handlers and room connection lifecycle
  useEffect(() => {
    if (!socket || !joinedRoomId) return;

    // Reset room specific states
    setPeers([]);
    setMessages([]);
    setRecordingBlobUrl(null);

    // Receive list of all current peers in room
    socket.on('all-peers', async (peerList) => {
      console.log('Received peers list:', peerList);
      const newPeers = [];

      for (const peer of peerList) {
        const pc = createPeerConnection(peer.socketId, peer.userId, peer.username);
        peerConnections.current[peer.socketId] = pc;
        
        // Add local tracks to this connection
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => {
            pc.addTrack(track, localStreamRef.current);
          });
        }

        // NOTE: Do not createOffer here! The existing peer receiving 'user-connected' will initiate the offer to prevent dual-offer glare collision.

        newPeers.push({
          socketId: peer.socketId,
          userId: peer.userId,
          username: peer.username,
          avatarUrl: peer.avatarUrl,
          stream: null,
          isMuted: false,
          isCamOff: false
        });
      }
      setPeers(newPeers);
    });

    // User connected — existing peer creates PC and sends an offer to the new joiner
    socket.on('user-connected', async ({ socketId, userId, username, avatarUrl }) => {
      console.log('User connected:', username, socketId);
      
      // Avoid duplicate PC — check both socketId ref map AND peers state userId
      if (peerConnections.current[socketId]) {
        console.log('[WebRTC] PC already exists for socket', socketId, '— skipping.');
        return;
      }
      const alreadyInPeers = peers.some(p => p.userId === userId);
      if (alreadyInPeers) {
        console.log('[WebRTC] Peer userId already tracked:', userId, '— skipping duplicate offer.');
        return;
      }

      // Setup peer connection and add local tracks
      const pc = createPeerConnection(socketId, userId, username);
      peerConnections.current[socketId] = pc;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      // Create and emit offer to the new joiner so they can answer back
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('signal', {
          roomId: joinedRoomId,
          targetSocketId: socketId,
          signalData: offer
        });
        console.log('Sent offer to newly joined peer:', username, socketId);
      } catch (err) {
        console.error('Error creating offer for new peer:', err);
      }

      setPeers(prev => {
        if (prev.some(p => p.socketId === socketId)) {
          return prev.map(p => p.socketId === socketId ? { ...p, userId, username, avatarUrl } : p);
        }
        return [...prev, { socketId, userId, username, avatarUrl, stream: null, isMuted: false, isCamOff: false }];
      });
    });

    // Relay signaling offers/answers/candidates
    socket.on('signal-relay', async ({ senderSocketId, targetSocketId, signalData }) => {
      if (targetSocketId !== socket.id) return;

      const pc = peerConnections.current[senderSocketId];
      if (!pc) return;

      try {
        if (signalData.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData));
          
          // Process early buffered candidates
          const queue = iceCandidatesQueue.current[senderSocketId] || [];
          for (const candidate of queue) {
            try {
              await pc.addIceCandidate(candidate);
            } catch (err) {
              console.warn('Error adding buffered ICE candidate:', err.message);
            }
          }
          iceCandidatesQueue.current[senderSocketId] = [];

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', {
            roomId: joinedRoomId,
            targetSocketId: senderSocketId,
            signalData: answer
          });
        } else if (signalData.type === 'answer') {
          if (pc.signalingState !== 'have-local-offer') {
            console.warn(`RTCPeerConnection signalingState is not 'have-local-offer' (current: ${pc.signalingState}). Aborting setRemoteDescription.`);
            return;
          }
          await pc.setRemoteDescription(new RTCSessionDescription(signalData));

          // Process early buffered candidates
          const queue = iceCandidatesQueue.current[senderSocketId] || [];
          for (const candidate of queue) {
            try {
              await pc.addIceCandidate(candidate);
            } catch (err) {
              console.warn('Error adding buffered ICE candidate:', err.message);
            }
          }
          iceCandidatesQueue.current[senderSocketId] = [];
        } else if (signalData.candidate) {
          const candidate = new RTCIceCandidate(signalData);
          if (pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(candidate);
            } catch (iceErr) {
              console.warn('Error adding ICE candidate:', iceErr.message);
            }
          } else {
            if (!iceCandidatesQueue.current[senderSocketId]) {
              iceCandidatesQueue.current[senderSocketId] = [];
            }
            iceCandidatesQueue.current[senderSocketId].push(candidate);
            console.log('Buffered early ICE candidate for socket:', senderSocketId);
          }
        }
      } catch (err) {
        console.error('Error handling signaling:', err);
      }
    });

    // Session metadata sync
    socket.on('session-metadata', ({ bpm, key, notes, owner }) => {
      setBpm(bpm);
      setBpmInput(bpm);
      setKeySignature(key);
      if (notes) setNotes(notes);
      if (owner) setRoomOwner(owner);
    });

    // Metronome sync
    socket.on('metronome-sync', ({ bpm, isPlaying, startTime }) => {
      setBpm(bpm);
      setBpmInput(bpm);
      setMetronomePlaying(isPlaying);
      syncMetronomeAudio(bpm, isPlaying, startTime);
    });

    // Key sync broadcast
    socket.on('key-sync-broadcast', ({ key }) => {
      setKeySignature(key);
    });

    // Notes sync broadcast
    socket.on('notes-sync-broadcast', ({ notes }) => {
      setNotes(notes);
    });

    // Chat broadcast
    socket.on('chat-message-broadcast', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    // Toggle listener
    socket.on('peer-media-toggled', ({ userId, type, state }) => {
      setPeers(prev => prev.map(p => {
        if (p.userId === userId) {
          return type === 'audio' ? { ...p, isMuted: state } : { ...p, isCamOff: state };
        }
        return p;
      }));
    });

    // Disconnect peer relay
    socket.on('user-disconnected-relay', ({ socketId, userId }) => {
      console.log('Peer disconnected:', socketId);
      if (peerConnections.current[socketId]) {
        peerConnections.current[socketId].close();
        delete peerConnections.current[socketId];
      }
      delete iceCandidatesQueue.current[socketId];
      setPeers(prev => prev.filter(p => p.socketId !== socketId));
    });

    // Join the websocket room with avatarUrl
    socket.emit('join-room', {
      roomId: joinedRoomId,
      userId: user.id || user._id,
      username: user.username,
      avatarUrl: user.avatarUrl
    });

    return () => {
      // Clean up socket listeners to prevent duplication leak
      socket.off('all-peers');
      socket.off('user-connected');
      socket.off('signal-relay');
      socket.off('session-metadata');
      socket.off('metronome-sync');
      socket.off('key-sync-broadcast');
      socket.off('notes-sync-broadcast');
      socket.off('chat-message-broadcast');
      socket.off('peer-media-toggled');
      socket.off('user-disconnected-relay');

      // Close all peer connections for this room
      for (const key in peerConnections.current) {
        peerConnections.current[key].close();
      }
      peerConnections.current = {};
    };
  }, [joinedRoomId, socket, localStream]);

  // Setup client media stream (fallback canvas if webcam denied)
  const setupLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true
      });
      setLocalStream(stream);
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable. Generating futuristic dummy video canvas...', err);
      // Fallback dummy canvas stream
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      
      let waveOffset = 0;
      canvasStreamTimer.current = setInterval(() => {
        if (!ctx) return;
        waveOffset += 0.15;
        ctx.fillStyle = '#0B0B0F';
        ctx.fillRect(0, 0, 640, 480);
        
        // Draw musical shapes
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.4)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let x = 0; x < 640; x++) {
          const y = 240 + Math.sin(x * 0.02 + waveOffset) * 40 * Math.sin(waveOffset * 0.3);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
        ctx.beginPath();
        for (let x = 0; x < 640; x++) {
          const y = 240 + Math.cos(x * 0.015 - waveOffset * 0.8) * 30;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Overlay Username label
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(user.username.toUpperCase(), 320, 230);
        
        ctx.fillStyle = '#00D4FF';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillText("MICROPHONE READY • STREAM SIMULATOR", 320, 260);
      }, 50);

      // Create audio destination fallback (silent audio track)
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioContext.createOscillator();
      const dest = audioContext.createMediaStreamDestination();
      osc.connect(dest);
      // Keep oscillator muted/silent but generating buffers
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.0;
      osc.connect(gainNode);
      gainNode.connect(audioContext.destination);

      const canvasStream = canvas.captureStream(30);
      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) {
        canvasStream.addTrack(audioTrack);
      }

      setLocalStream(canvasStream);
      localStreamRef.current = canvasStream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = canvasStream;
      }
    }
  };

  const handleLeaveCall = () => {
    console.log("Initiating exhaustive teardown pipeline for room:", joinedRoomId);

    // 1. Inform remote peer clients to wipe their view tiles immediately
    if (socket && joinedRoomId) {
      socket.emit('leave-jam-room', {
        roomId: joinedRoomId,
        userId: user.id || user._id
      });
    }

    // 2. Stop local camera/microphone media tracks explicitly
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        console.log("Stopping local track:", track.kind);
        track.stop();
      });
      localStreamRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    // 3. Close RTCPeerConnections safely
    if (peerConnections.current) {
      for (const key in peerConnections.current) {
        console.log("Closing RTCPeerConnection for peer:", key);
        peerConnections.current[key].close();
      }
      peerConnections.current = {};
    }
    iceCandidatesQueue.current = {};

    // 4. Clean up metronome timeouts, intervals, audio context, and canvas timer fallbacks
    isPlayingRef.current = false;
    if (metronomeTimeoutId.current) clearTimeout(metronomeTimeoutId.current);
    if (metronomeInterval.current) clearInterval(metronomeInterval.current);
    if (metronomeAudioCtx.current) {
      try {
        metronomeAudioCtx.current.close();
      } catch (err) {}
      metronomeAudioCtx.current = null;
    }
    if (canvasStreamTimer.current) {
      clearInterval(canvasStreamTimer.current);
      canvasStreamTimer.current = null;
    }
    setMetronomePlaying(false);

    // 5. Reset states back to empty initialized values
    setPeers([]);
    setMessages([]);
    setRecordingBlobUrl(null);
    setRoomOwner(null);
    setJoinedRoomId('');
    setTargetRoomId('');
  };

  // Create RTCPeerConnection for signaling
  const createPeerConnection = (targetSocketId, targetUserId, targetUsername) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('signal', {
          roomId: joinedRoomId,
          targetSocketId,
          signalData: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('Received track from peer:', targetUsername, event.streams[0]);
      const remoteStream = event.streams[0];
      setPeers(prev => {
        // Force a new MediaStream instance containing all tracks so React + RemoteVideo detect the reference change and play/render immediately
        const streamInstance = remoteStream ? new MediaStream(remoteStream.getTracks()) : null;
        const exists = prev.some(p => p.socketId === targetSocketId);
        if (exists) {
          return prev.map(p => p.socketId === targetSocketId ? { ...p, stream: streamInstance } : p);
        }
        return [...prev, {
          socketId: targetSocketId,
          userId: targetUserId,
          username: targetUsername,
          avatarUrl: '',
          stream: streamInstance,
          isMuted: false,
          isCamOff: false
        }];
      });
    };

    return pc;
  };

  // Metronome Synchronization logic with thread-safe timeout cleanup
  const syncMetronomeAudio = (tempoBpm, isPlaying, startTime) => {
    if (metronomeTimeoutId.current) {
      clearTimeout(metronomeTimeoutId.current);
      metronomeTimeoutId.current = null;
    }
    if (metronomeInterval.current) {
      clearInterval(metronomeInterval.current);
      metronomeInterval.current = null;
    }

    if (!isPlaying) {
      if (metronomeAudioCtx.current) {
        try {
          metronomeAudioCtx.current.close();
        } catch (err) {}
        metronomeAudioCtx.current = null;
      }
      return;
    }

    if (!metronomeAudioCtx.current) {
      metronomeAudioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    const interval = 60 / tempoBpm; // duration per beat in seconds
    
    // Exact beat scheduler
    const scheduleNextBeats = () => {
      if (!isPlayingRef.current) return; // Terminate loop if switched off

      const elapsed = (Date.now() - startTime) / 1000;
      const nextBeatIndex = Math.ceil(elapsed / interval);
      const delay = (nextBeatIndex * interval) - elapsed;

      // Play local click precisely at delay
      metronomeTimeoutId.current = setTimeout(() => {
        if (!isPlayingRef.current) return;
        playTickSynth(nextBeatIndex % 4 === 0);
        // Recurse to align next beats
        scheduleNextBeats();
      }, delay * 1000);
    };

    scheduleNextBeats();
  };

  const toggleFullScreen = (elementId) => {
    const elem = document.getElementById(elementId);
    if (!elem) return;
    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const playTickSynth = (isDownbeat) => {
    try {
      const ctx = metronomeAudioCtx.current;
      if (!ctx || ctx.state === 'suspended') {
        ctx?.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      // Metronome tone: Downbeat is higher pitch
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isDownbeat ? 1000 : 600, ctx.currentTime);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (err) {
      // Audio block bypass
    }
  };

  const handleMetronomeToggle = () => {
    const newState = !metronomePlaying;
    setMetronomePlaying(newState);
    if (socket) {
      socket.emit('metronome-control', {
        roomId: joinedRoomId,
        bpm,
        isPlaying: newState
      });
    }
  };

  const handleBpmChange = (newBpm) => {
    setBpm(newBpm);
    setBpmInput(newBpm);
    if (socket) {
      socket.emit('metronome-control', {
        roomId: joinedRoomId,
        bpm: newBpm,
        isPlaying: metronomePlaying
      });
    }
  };

  const handleKeyChange = (newKey) => {
    setKeySignature(newKey);
    if (socket) {
      socket.emit('key-sync', { roomId: joinedRoomId, key: newKey });
    }
  };

  // Toggle Mute / Camera
  const toggleMute = () => {
    const state = !isMuted;
    setIsMuted(state);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => track.enabled = !state);
    }
    if (socket) {
      socket.emit('media-toggle', { roomId: joinedRoomId, userId: user.id, type: 'audio', state });
    }
  };

  const toggleCam = () => {
    const state = !isCamOff;
    setIsCamOff(state);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => track.enabled = !state);
    }
    if (socket) {
      socket.emit('media-toggle', { roomId: joinedRoomId, userId: user.id, type: 'video', state });
    }
  };

  // Screen Share capability
  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setIsScreenSharing(true);
        
        // Replace video tracks on existing peer connections
        const videoTrack = stream.getVideoTracks()[0];
        for (const socketId in peerConnections.current) {
          const senders = peerConnections.current[socketId].getSenders();
          const sender = senders.find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        }

        // On screen share end
        videoTrack.onended = () => {
          stopScreenSharing();
        };
      } else {
        stopScreenSharing();
      }
    } catch (err) {
      console.error('Screen sharing failed:', err);
    }
  };

  const stopScreenSharing = () => {
    setIsScreenSharing(false);
    setupLocalStream().then(() => {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      for (const socketId in peerConnections.current) {
        const senders = peerConnections.current[socketId].getSenders();
        const sender = senders.find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      }
    });
  };

  // Session Note Management
  const handleSaveNotes = () => {
    setNotesSaved(true);
    if (socket) {
      socket.emit('notes-sync', { roomId: joinedRoomId, notes });
    }
  };

  // Session Recording
  const startRecording = () => {
    if (!localStreamRef.current) return;
    recordedChunks.current = [];
    
    // Combine audio tracks using Web Audio
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();

      // Add local microphone
      const localSource = audioCtx.createMediaStreamSource(localStreamRef.current);
      localSource.connect(dest);

      // Add other peers
      peers.forEach(p => {
        if (p.stream && p.stream.getAudioTracks().length > 0) {
          const peerSource = audioCtx.createMediaStreamSource(p.stream);
          peerSource.connect(dest);
        }
      });

      const mixedStream = dest.stream;
      
      const mediaRecorder = new MediaRecorder(mixedStream, { mimeType: 'audio/webm' });
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordingBlobUrl(url);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start session recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Send Chat message
  const handleSendMessage = () => {
    if (!messageInput.trim()) return;

    if (socket) {
      socket.emit('chat-message', {
        roomId: joinedRoomId,
        userId: user.id,
        username: user.username,
        content: messageInput
      });
      setMessageInput('');
    }
  };

  // Format Elapsed Time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Emoji append helper
  const addEmoji = (emoji) => {
    setMessageInput(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const getEmojiStyle = (emo) => {
    switch (emo) {
      case '🎸': return 'bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/60 shadow-sm';
      case '🎷': return 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 shadow-sm';
      case '🥁': return 'bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200/60 shadow-sm';
      case '🎹': return 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 shadow-sm';
      case '🎤': return 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60 shadow-sm';
      case '🔥': return 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/60 shadow-sm';
      case '🤘': return 'bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200/60 shadow-sm';
      case '👏': return 'bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200/60 shadow-sm';
      case '🎵': return 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200/60 shadow-sm';
      case '🎶': return 'bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200/60 shadow-sm';
      case '❤️': return 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60 shadow-sm';
      case '💯': return 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/60 shadow-sm';
      default: return 'bg-white/10 hover:bg-white/20 text-white border border-white/10 shadow-sm';
    }
  };

  const emojis = ['🎸', '🥁', '🎹', '🎤', '🎷', '🔥', '🤘', '👏', '🎵', '🎶', '❤️', '💯'];

  if (!joinedRoomId) {
    return (
      <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center p-6 bg-[#FDFBF7]">
        <div className="glass-panel w-full max-w-md p-8 border-2 border-black/10 rounded-3xl shadow-md text-center bg-white flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-electricBlue/10 flex items-center justify-center border border-electricBlue/20 mb-2">
            <Music className="w-8 h-8 text-electricBlue animate-pulse" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-black tracking-tight font-sans">Jam Studio</h3>
            <p className="text-xs text-charcoal/60 mt-1 font-sans">Connect to an active room session to start jamming in real time.</p>
          </div>
          
          <div className="w-full flex flex-col gap-2.5">
            <label className="text-[10px] text-charcoal/50 uppercase tracking-widest font-bold text-left block w-full pl-1 font-sans">
              Enter Active Room ID to Join
            </label>
            <input
              type="text"
              placeholder="e.g. room_123"
              value={manualRoomId}
              onChange={(e) => setManualRoomId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualRoomId.trim()) {
                  setJoinedRoomId(manualRoomId.trim());
                  setTargetRoomId(manualRoomId.trim());
                  setManualRoomId('');
                }
              }}
              className="w-full px-4 py-3 bg-black/[0.02] border-2 border-black/10 rounded-2xl text-sm font-mono text-black focus:outline-none focus:border-electricBlue"
            />
          </div>

          <button
            onClick={() => {
              if (manualRoomId.trim()) {
                setJoinedRoomId(manualRoomId.trim());
                setTargetRoomId(manualRoomId.trim());
                setManualRoomId('');
              }
            }}
            disabled={!manualRoomId.trim()}
            className="w-full py-3.5 rounded-2xl bg-black hover:bg-black/90 font-bold text-xs text-white uppercase tracking-wider transition-all disabled:opacity-50 active:scale-95 shadow-md flex items-center justify-center gap-2 font-sans"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            Connect to Jam Session
          </button>

          <button
            onClick={() => setActiveView('dashboard')}
            className="w-full py-3 rounded-2xl bg-black/5 hover:bg-black/10 font-bold text-xs text-black border border-black/10 transition-all active:scale-95 font-sans"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen bg-[#09090D] overflow-hidden flex flex-col relative">
      {/* ── Top-Left Info Overlay ─────────────────────────────────────── */}
      <div className="absolute top-6 left-6 z-20 flex flex-col gap-1.5 pointer-events-auto">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-electricBlue font-bold tracking-widest uppercase bg-electricBlue/10 border border-electricBlue/20 px-2 py-0.5 rounded-full backdrop-blur-md">
            Live Jam Studio
          </span>
          <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-white/60 font-semibold backdrop-blur-md">
            Jam Time: {formatTime(sessionTime)}
          </span>
        </div>
        <h2 className="text-xl font-extrabold text-white flex items-center gap-2 drop-shadow-md">
          Room: {roomId}
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping inline-block" />
        </h2>
      </div>

      {/* ── Top-Right Room switcher Join bar Overlay ──────────────────── */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-2 pointer-events-auto">
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-lg">
          <input
            type="text"
            placeholder="Room ID to Join..."
            value={manualRoomId}
            onChange={(e) => setManualRoomId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && manualRoomId.trim()) {
                setTargetRoomId(manualRoomId.trim());
                setManualRoomId('');
              }
            }}
            className="bg-transparent border-0 px-3 py-1 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-0 font-mono w-28"
          />
          <button
            onClick={() => {
              if (manualRoomId.trim()) {
                setTargetRoomId(manualRoomId.trim());
                setManualRoomId('');
              }
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-neonPurple to-electricBlue font-bold text-[10px] text-white shrink-0 hover:opacity-90 transition-all"
          >
            Join
          </button>
        </div>
      </div>

      {/* ── Bottom-Left Metronome & Key Signatures Overlay ────────────── */}
      <div className="absolute bottom-6 left-6 z-20 flex items-center gap-4 bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-lg">
        {/* Metronome bpm sync */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleMetronomeToggle}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              metronomePlaying 
                ? 'bg-neonPurple text-white shadow-glow-purple animate-pulse' 
                : 'bg-white/5 hover:bg-white/10 text-white/80 border border-white/5'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${metronomePlaying ? 'fill-white' : ''}`} />
          </button>
          <div>
            <span className="text-[8px] text-white/40 uppercase font-bold block">BPM</span>
            <input
              type="number"
              value={bpmInput}
              onChange={(e) => setBpmInput(Number(e.target.value))}
              onBlur={() => handleBpmChange(bpmInput)}
              onKeyDown={(e) => e.key === 'Enter' && handleBpmChange(bpmInput)}
              className="w-10 bg-transparent border-0 border-b border-white/20 text-xs font-bold text-white text-center p-0 focus:outline-none focus:border-electricBlue font-mono"
            />
          </div>
        </div>
        
        {/* Key Signature select */}
        <div className="h-6 w-px bg-white/10" />
        <div>
          <span className="text-[8px] text-white/40 uppercase font-bold block">Key</span>
          <select
            value={keySignature}
            onChange={(e) => handleKeyChange(e.target.value)}
            className="bg-transparent text-xs font-bold text-white border-0 border-b border-white/20 p-0 focus:outline-none focus:border-electricBlue cursor-pointer"
          >
            {['C Major', 'G Major', 'D Major', 'A Major', 'E Major', 'F Major', 'A Minor', 'E Minor', 'D Minor', 'B Minor'].map((k) => (
              <option key={k} value={k} className="bg-[#0B0B0F] text-white text-xs">{k}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Main Viewport calling theater ────────────────────────────── */}
      <div className="flex-1 w-full h-full relative z-0 flex items-center justify-center p-6 pb-28">
        {pinnedParticipantId !== null ? (
          // PINNED LAYOUT
          <div className="w-full h-full max-w-6xl mx-auto flex gap-6">
            {/* Pinned Stream View */}
            <div className="flex-[3] min-h-0 relative">
              {pinnedParticipantId === 'local' ? (
                // Render Pinned Local User
                <div id="local-video-container" className="w-full h-full bg-[#181824] rounded-3xl relative overflow-hidden border border-electricBlue/20 flex items-center justify-center shadow-glow-blue">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform scale-x-[-1] aspect-video"
                  />
                  <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
                    <button
                      onClick={() => handleTogglePin('local')}
                      className="p-2 rounded-xl bg-electricBlue text-white border border-electricBlue/30 hover:scale-105 transition-all animate-pulse"
                      title="Unpin View"
                    >
                      <PinOff className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleFullScreen('local-video-container')}
                      className="p-2 rounded-xl bg-black/50 hover:bg-black/70 text-white border border-white/10"
                      title="Toggle Full Screen"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="absolute bottom-4 left-4 bg-darkBg/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold flex items-center gap-2">
                    <span>{user.username} (You)</span>
                    {roomOwner && (roomOwner === user._id || roomOwner === user.id) && (
                      <span className="bg-electricBlue/20 text-electricBlue border border-electricBlue/30 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Host</span>
                    )}
                    {isMuted && <MicOff className="w-3.5 h-3.5 text-red-400" />}
                    {isCamOff && <VideoOff className="w-3.5 h-3.5 text-red-400" />}
                  </div>
                </div>
              ) : (
                // Render Pinned Peer User
                (() => {
                  const peer = peers.find(p => p.socketId === pinnedParticipantId);
                  if (!peer) return null;
                  return (
                    <div id={`peer-video-container-${peer.socketId}`} className="w-full h-full bg-[#181824] rounded-3xl relative overflow-hidden border border-electricBlue/20 flex items-center justify-center shadow-glow-blue">
                      {peer.stream ? (
                        <RemoteVideo peer={peer} className="w-full h-full object-cover aspect-video" />
                      ) : (
                        <div className="text-center p-6 flex flex-col items-center">
                          <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-neonPurple to-electricBlue flex items-center justify-center font-bold text-white uppercase text-xl border border-white/10 mb-3 p-0">
                            {peer.avatarUrl ? (
                              <img src={peer.avatarUrl} alt={peer.username} className="w-full h-full object-cover" />
                            ) : (
                              (peer.username || 'MU').slice(0, 2)
                            )}
                          </div>
                          <span className="text-sm font-semibold text-white">{peer.username}</span>
                          <span className="text-xs text-white/40 mt-1">Connecting media pipes...</span>
                        </div>
                      )}
                      <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
                        <button
                          onClick={() => handleTogglePin(peer.socketId)}
                          className="p-2 rounded-xl bg-electricBlue text-white border border-electricBlue/30 hover:scale-105 transition-all animate-pulse"
                          title="Unpin View"
                        >
                          <PinOff className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleFullScreen(`peer-video-container-${peer.socketId}`)}
                          className="p-2 rounded-xl bg-black/50 hover:bg-black/70 text-white border border-white/10"
                          title="Toggle Full Screen"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-4 left-4 bg-darkBg/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold flex items-center gap-2">
                        <span>{peer.username}</span>
                        {roomOwner === peer.userId && (
                          <span className="bg-electricBlue/20 text-electricBlue border border-electricBlue/30 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Host</span>
                        )}
                        {peer.isMuted && <MicOff className="w-3.5 h-3.5 text-red-400" />}
                        {peer.isCamOff && <VideoOff className="w-3.5 h-3.5 text-red-400" />}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Sidebar filmstrip for other non-pinned users */}
            <div className="flex-1 max-w-[220px] flex flex-col gap-4 overflow-y-auto pr-1">
              {/* Local User in sidebar if peer is pinned */}
              {pinnedParticipantId !== 'local' && (
                <div id="local-video-container-sidebar" className="aspect-video w-full bg-[#181824] rounded-2xl relative overflow-hidden border border-white/5 flex items-center justify-center shrink-0 group/video shadow-md">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/video:opacity-100 transition-all z-20">
                    <button
                      onClick={() => handleTogglePin('local')}
                      className="p-1 rounded bg-black/50 hover:bg-black/70 text-white border border-white/10"
                      title="Pin View"
                    >
                      <Pin className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="absolute bottom-2 left-2 bg-darkBg/85 backdrop-blur-md px-2 py-0.5 rounded border border-white/10 text-[10px] font-semibold text-white">
                    <span>You</span>
                  </div>
                </div>
              )}

              {/* Remote Users in sidebar if not pinned */}
              {peers.filter(p => p.socketId !== pinnedParticipantId).map((peer) => (
                <div id={`peer-video-container-${peer.socketId}-sidebar`} key={peer.socketId} className="aspect-video w-full bg-[#181824] rounded-2xl relative overflow-hidden border border-white/5 flex items-center justify-center shrink-0 group/video shadow-md">
                  {peer.stream ? (
                    <RemoteVideo peer={peer} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-2 flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-neonPurple to-electricBlue flex items-center justify-center font-bold text-white uppercase text-xs border border-white/10 p-0 mb-1">
                        {peer.avatarUrl ? (
                          <img src={peer.avatarUrl} alt={peer.username} className="w-full h-full object-cover" />
                        ) : (
                          (peer.username || 'MU').slice(0, 2)
                        )}
                      </div>
                      <span className="text-[10px] font-semibold text-white truncate max-w-[80px]">{peer.username}</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/video:opacity-100 transition-all z-20">
                    <button
                      onClick={() => handleTogglePin(peer.socketId)}
                      className="p-1 rounded bg-black/50 hover:bg-black/70 text-white border border-white/10"
                      title="Pin View"
                    >
                      <Pin className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="absolute bottom-2 left-2 bg-darkBg/85 backdrop-blur-md px-2 py-0.5 rounded border border-white/10 text-[10px] font-semibold text-white">
                    <span>{peer.username}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // UNPINNED GRID LAYOUT
          <div className={`grid gap-4 w-full h-full max-w-5xl mx-auto items-center justify-center ${
            peers.length === 0 
              ? 'grid-cols-1 max-w-2xl' 
              : peers.length === 1 
                ? 'grid-cols-1 md:grid-cols-2 max-w-4xl' 
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 max-w-4xl'
          }`}>
            {/* Local user tile */}
            <div id="local-video-container" className="aspect-video w-full bg-[#181824] rounded-2xl relative overflow-hidden border-2 border-black/10 flex items-center justify-center group/video shadow-md">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
              <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover/video:opacity-100 z-20 transition-all">
                <button
                  onClick={() => handleTogglePin('local')}
                  className="p-2 rounded-xl bg-black/50 hover:bg-black/70 text-white border border-white/10"
                  title="Pin View"
                >
                  <Pin className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleFullScreen('local-video-container')}
                  className="p-2 rounded-xl bg-black/50 hover:bg-black/70 text-white border border-white/10"
                  title="Toggle Full Screen"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
              <div className="absolute bottom-4 left-4 bg-darkBg/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold flex items-center gap-2">
                <span>{user.username} (You)</span>
                {roomOwner && (roomOwner === user._id || roomOwner === user.id) && (
                  <span className="bg-electricBlue/20 text-electricBlue border border-electricBlue/30 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Host</span>
                )}
                {isMuted && <MicOff className="w-3.5 h-3.5 text-red-400" />}
                {isCamOff && <VideoOff className="w-3.5 h-3.5 text-red-400" />}
              </div>
            </div>

            {/* Remote user tiles */}
            {peers.map((peer) => (
              <div id={`peer-video-container-${peer.socketId}`} key={peer.socketId} className="aspect-video w-full bg-[#181824] rounded-2xl relative overflow-hidden border-2 border-black/10 flex items-center justify-center group/video shadow-md">
                {peer.stream ? (
                  <RemoteVideo peer={peer} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-6 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-neonPurple to-electricBlue flex items-center justify-center font-bold text-white uppercase text-xl border border-white/10 mb-3 p-0">
                      {peer.avatarUrl ? (
                        <img src={peer.avatarUrl} alt={peer.username} className="w-full h-full object-cover" />
                      ) : (
                        (peer.username || 'MU').slice(0, 2)
                      )}
                    </div>
                    <span className="text-sm font-semibold text-white">{peer.username}</span>
                    <span className="text-xs text-white/40 mt-1">Connecting media pipes...</span>
                  </div>
                )}
                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover/video:opacity-100 z-20 transition-all">
                  <button
                    onClick={() => handleTogglePin(peer.socketId)}
                    className="p-2 rounded-xl bg-black/50 hover:bg-black/70 text-white border border-white/10"
                    title="Pin View"
                  >
                    <Pin className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleFullScreen(`peer-video-container-${peer.socketId}`)}
                    className="p-2 rounded-xl bg-black/50 hover:bg-black/70 text-white border border-white/10"
                    title="Toggle Full Screen"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute bottom-4 left-4 bg-darkBg/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold flex items-center gap-2">
                  <span>{peer.username}</span>
                  {roomOwner === peer.userId && (
                    <span className="bg-electricBlue/20 text-electricBlue border border-electricBlue/30 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Host</span>
                  )}
                  {peer.isMuted && <MicOff className="w-3.5 h-3.5 text-red-400" />}
                  {peer.isCamOff && <VideoOff className="w-3.5 h-3.5 text-red-400" />}
                </div>
              </div>
            ))}

            {/* Optional Placeholder */}
            {peers.length < 1 && (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center text-center p-8 aspect-video w-full h-full max-h-[75vh]">
                <Music className="w-12 h-12 text-white/15 mb-3 animate-float" />
                <span className="text-sm font-semibold text-white/50">Waiting for jamming partners...</span>
                <span className="text-xs text-white/30 mt-1">Share the room ID to invite other musicians.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── High-Contrast Charcoal Control Bar (Nothing-Phone style) ───── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#18181B] px-5 py-3 rounded-2xl z-20 shadow-2xl border border-[#FFFFFF]/15 flex items-center gap-3">

        {/* Divider helper */}
        <div className="h-7 w-px bg-[#FFFFFF]/15 mx-1" />

        {/* Toggle Mic */}
        <button
          onClick={toggleMute}
          className={`p-3 rounded-xl transition-all duration-150 active:scale-90 ${
            isMuted
              ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/50 shadow-lg shadow-red-500/20'
              : 'bg-[#FFFFFF]/15 hover:bg-[#FFFFFF]/25 text-[#FFFFFF] shadow-sm'
          }`}
          title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
        >
          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Toggle Cam */}
        <button
          onClick={toggleCam}
          className={`p-3 rounded-xl transition-all duration-150 active:scale-90 ${
            isCamOff
              ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/50 shadow-lg shadow-red-500/20'
              : 'bg-[#FFFFFF]/15 hover:bg-[#FFFFFF]/25 text-[#FFFFFF] shadow-sm'
          }`}
          title={isCamOff ? 'Turn Cam On' : 'Turn Cam Off'}
        >
          {isCamOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
        </button>

        {/* Screen Share */}
        <button
          onClick={toggleScreenShare}
          className={`p-3 rounded-xl transition-all duration-150 active:scale-90 ${
            isScreenSharing
              ? 'bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/50'
              : 'bg-[#FFFFFF]/15 hover:bg-[#FFFFFF]/25 text-[#FFFFFF] shadow-sm'
          }`}
          title="Share Screen"
        >
          <ScreenShare className="w-4 h-4" />
        </button>

        {/* Record Session Toggle */}
        {isRecording ? (
          <button
            onClick={stopRecording}
            className="p-3 rounded-xl bg-red-500/20 text-red-400 ring-1 ring-red-500/50 animate-pulse transition-all active:scale-90"
            title="Stop Recording"
          >
            <Square className="w-4 h-4 fill-red-400" />
          </button>
        ) : (
          <button
            onClick={startRecording}
            className="p-3 rounded-xl bg-[#FFFFFF]/15 hover:bg-[#FFFFFF]/25 text-[#FFFFFF] shadow-sm transition-all active:scale-90"
            title="Record Session"
          >
            <Save className="w-4 h-4" />
          </button>
        )}

        {/* Download Recording */}
        {recordingBlobUrl && (
          <a
            href={recordingBlobUrl}
            download={`harmony_bridge_jam_${roomId}.webm`}
            className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50 hover:bg-emerald-500/30 transition-all flex items-center justify-center"
            title="Download Recording"
          >
            <Download className="w-4 h-4" />
          </a>
        )}

        {/* Chat Toggle Button */}
        <button
          onClick={() => setChatPanelOpen(prev => !prev)}
          className={`p-3 rounded-xl transition-all duration-150 active:scale-90 relative ${
            chatPanelOpen
              ? 'bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/50'
              : 'bg-[#FFFFFF]/15 hover:bg-[#FFFFFF]/25 text-[#FFFFFF] shadow-sm'
          }`}
          title="Toggle Chat"
        >
          <MessageSquare className="w-4 h-4" />
          {messages.length > 0 && !chatPanelOpen && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse border border-[#18181B]" />
          )}
        </button>

        <div className="h-7 w-px bg-[#FFFFFF]/15 mx-1" />

        {/* Leave Studio Room — distinct red pill */}
        <button
          onClick={handleLeaveCall}
          className="px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-[#FFFFFF] font-bold text-xs tracking-wide transition-all duration-150 active:scale-90 shadow-lg shadow-red-500/30 flex items-center gap-2"
          title="Leave Jam Room"
        >
          <PhoneOff className="w-4 h-4 text-[#FFFFFF]" />
          <span className="hidden sm:inline text-[#FFFFFF]">Leave</span>
        </button>
      </div>

      {/* ── Crisp White Chat Sidebar Panel (cream-theme contrast) ───────── */}
      <div
        className={`fixed right-0 top-0 h-full w-[340px] bg-white border-l border-black/[0.07] z-30 shadow-[−4px_0_24px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-in-out flex flex-col ${
          chatPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Chat Header */}
        <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between shrink-0 bg-white">
          <span className="text-sm font-bold text-neutral-800 flex items-center gap-2 tracking-tight">
            <div className="w-7 h-7 rounded-lg bg-[#18181B] flex items-center justify-center shrink-0">
              <MessageSquare className="w-3.5 h-3.5 text-white" />
            </div>
            Studio Chat
          </span>
          <button
            onClick={() => setChatPanelOpen(false)}
            className="p-1.5 rounded-lg bg-black/[0.05] hover:bg-black/[0.1] text-neutral-500 hover:text-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages List viewport */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0 bg-[#FDFBF7]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <div className="w-10 h-10 rounded-full bg-black/[0.05] flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-neutral-400" />
              </div>
              <p className="text-xs font-semibold text-neutral-400">No messages yet</p>
              <p className="text-[11px] text-neutral-400/70">Introduce yourself to the jam room!</p>
            </div>
          )}
          {messages.map((msg, i) => {
            const isOwn = msg.sender === user._id || msg.sender === user.id;
            return (
              <div key={i} className={`flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-bold ${isOwn ? 'text-[#18181B]' : 'text-violet-700'}`}>
                    {isOwn ? 'You' : msg.senderName}
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                  isOwn
                    ? 'bg-[#18181B] text-white rounded-tr-sm'
                    : 'bg-white text-neutral-800 border border-black/[0.08] shadow-sm rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Emoji picker tray */}
        {showEmojiPicker && (
          <div className="border-t border-black/[0.06] bg-white px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              {emojis.map((emo) => (
                <button
                  key={emo}
                  onClick={() => addEmoji(emo)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-base hover:-translate-y-0.5 hover:shadow-sm transition-all duration-150 active:scale-95 ${getEmojiStyle(emo)}`}
                >
                  {emo}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message input bar */}
        <div className="px-4 py-4 border-t border-black/[0.06] shrink-0 bg-white">
          <div className="flex items-center gap-2 bg-black/[0.04] border border-black/[0.08] rounded-2xl px-3 py-2 focus-within:border-[#18181B] focus-within:bg-white transition-all">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-1.5 rounded-lg transition-all ${
                showEmojiPicker ? 'bg-[#18181B] text-white' : 'text-neutral-400 hover:text-neutral-700 hover:bg-black/[0.06]'
              }`}
            >
              <Smile className="w-4 h-4" />
            </button>

            <input
              type="text"
              placeholder="Message the room..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 bg-transparent text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none min-w-0 py-1"
            />

            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
              className="w-8 h-8 rounded-xl bg-[#18181B] flex items-center justify-center text-white disabled:opacity-30 hover:bg-black transition-all active:scale-90 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JamRoom;
