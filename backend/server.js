const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const matchingRoutes = require('./routes/matching');
const analysisRoutes = require('./routes/analysis');
const communityRoutes = require('./routes/community');
const coachRoutes = require('./routes/coach');
const Session = require('./models/Session');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  }
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serving static uploaded directory if user wants to check file details
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/matching', matchingRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/coach', coachRoutes);

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/harmonybridge';
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

// Socket.io Real-Time Jamming Coordination
// In-memory track of rooms and users for WebRTC
const roomParticipants = {}; // roomId -> Array of { socketId, userId, username }
const metronomeStates = {};   // roomId -> { bpm, isPlaying, startTime }

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // 1. Join Jam Session Room
  socket.on('join-room', async ({ roomId, userId, username, avatarUrl }) => {
    socket.join(roomId);
    
    if (!roomParticipants[roomId]) {
      roomParticipants[roomId] = [];
    }

    // Check if participant already exists in room tracking
    const exists = roomParticipants[roomId].some(p => p.userId === userId);
    if (!exists) {
      roomParticipants[roomId].push({ socketId: socket.id, userId, username, avatarUrl });
    } else {
      // Update socket ID if re-connecting
      roomParticipants[roomId] = roomParticipants[roomId].map(p => 
        p.userId === userId ? { ...p, socketId: socket.id, avatarUrl } : p
      );
    }

    console.log(`User ${username} (${userId}) joined room ${roomId}`);

    // Retrieve other peers in the room to start WebRTC offers
    const otherPeers = roomParticipants[roomId]
      .filter(p => p.socketId !== socket.id)
      .map(p => ({ socketId: p.socketId, userId: p.userId, username: p.username, avatarUrl: p.avatarUrl }));

    // Notify the user about existing peers in the room
    socket.emit('all-peers', otherPeers);

    // Notify existing peers that a new user connected
    socket.to(roomId).emit('user-connected', {
      socketId: socket.id,
      userId,
      username,
      avatarUrl
    });

    // Send current metronome state if it exists
    if (metronomeStates[roomId]) {
      socket.emit('metronome-sync', metronomeStates[roomId]);
    }

    // Fetch and send database room state (notes, bpm, key)
    try {
      let dbSession = await Session.findOne({ roomId });
      if (!dbSession && userId) {
        // Create session in db if owner
        dbSession = new Session({
          roomId,
          name: `${username}'s Studio`,
          owner: userId,
          participants: [userId]
        });
        await dbSession.save();
        socket.emit('session-metadata', {
          bpm: dbSession.bpm,
          key: dbSession.key,
          notes: dbSession.notes,
          owner: dbSession.owner
        });
      } else if (dbSession && userId) {
        if (!dbSession.participants.includes(userId)) {
          dbSession.participants.push(userId);
          await dbSession.save();
        }
        socket.emit('session-metadata', {
          bpm: dbSession.bpm,
          key: dbSession.key,
          notes: dbSession.notes,
          owner: dbSession.owner
        });
      }
    } catch (err) {
      console.error('Error syncing DB room details:', err);
    }
  });

  // 2. Relay WebRTC Signal (Offer/Answer/ICE candidate) - point-to-point to prevent broadcast leaks
  socket.on('signal', ({ roomId, targetSocketId, signalData }) => {
    if (roomId && targetSocketId) {
      // Send only to the intended recipient socket - not the whole room
      io.to(targetSocketId).emit('signal-relay', {
        senderSocketId: socket.id,
        targetSocketId,
        signalData
      });
    }
  });

  // 3. Sync Shared Metronome (Absolute Timestamp method)
  socket.on('metronome-control', async ({ roomId, bpm, isPlaying }) => {
    // Record current time as start standard to line up phase delays
    const startTime = Date.now();
    metronomeStates[roomId] = { bpm, isPlaying, startTime };

    // Broadcast to everyone else in the room
    io.to(roomId).emit('metronome-sync', metronomeStates[roomId]);

    // Save BPM to database room
    try {
      await Session.findOneAndUpdate({ roomId }, { $set: { bpm } });
    } catch (err) {
      console.error(err);
    }
  });

  // 4. Sync Key changes
  socket.on('key-sync', async ({ roomId, key }) => {
    io.to(roomId).emit('key-sync-broadcast', { key });
    try {
      await Session.findOneAndUpdate({ roomId }, { $set: { key } });
    } catch (err) {
      console.error(err);
    }
  });

  // 5. Live Session Notes Sync
  socket.on('notes-sync', async ({ roomId, notes }) => {
    socket.to(roomId).emit('notes-sync-broadcast', { notes });
    try {
      await Session.findOneAndUpdate({ roomId }, { $set: { notes } });
    } catch (err) {
      console.error(err);
    }
  });

  // 6. Live Chat Messaging
  socket.on('chat-message', async ({ roomId, userId, username, content, fileUrl, fileName }) => {
    const newMessage = {
      sender: userId,
      senderName: username,
      content,
      fileUrl,
      fileName,
      timestamp: new Date()
    };

    io.to(roomId).emit('chat-message-broadcast', newMessage);

    // Save to Database
    try {
      await Session.findOneAndUpdate(
        { roomId },
        { $push: { messages: newMessage } }
      );
    } catch (err) {
      console.error('Error saving chat message to DB:', err);
    }
  });

  // 7. Toggle Audio/Video States (Notify other peers)
  socket.on('media-toggle', ({ roomId, userId, type, state }) => {
    socket.to(roomId).emit('peer-media-toggled', { userId, type, state });
  });

  // 8. Explicitly Leave Jam Room
  socket.on('leave-jam-room', ({ roomId, userId }) => {
    if (roomId && roomParticipants[roomId]) {
      const idx = roomParticipants[roomId].findIndex(p => p.socketId === socket.id);
      if (idx !== -1) {
        const leavingUser = roomParticipants[roomId][idx];
        roomParticipants[roomId].splice(idx, 1);
        console.log(`User ${leavingUser.username} explicitly left room ${roomId} via leave-jam-room`);

        // Notify others
        socket.to(roomId).emit('user-disconnected-relay', {
          socketId: socket.id,
          userId: leavingUser.userId
        });

        // Clean up empty room state
        if (roomParticipants[roomId].length === 0) {
          delete roomParticipants[roomId];
          delete metronomeStates[roomId];
        }
      }
      socket.leave(roomId);
    }
  });

  // 9. Disconnect
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    
    // Find room where user resided
    for (const roomId in roomParticipants) {
      const idx = roomParticipants[roomId].findIndex(p => p.socketId === socket.id);
      if (idx !== -1) {
        const leavingUser = roomParticipants[roomId][idx];
        roomParticipants[roomId].splice(idx, 1);
        console.log(`User ${leavingUser.username} left room ${roomId}`);
        
        // Notify others
        socket.to(roomId).emit('user-disconnected-relay', {
          socketId: socket.id,
          userId: leavingUser.userId
        });

        // Clean up empty room state
        if (roomParticipants[roomId].length === 0) {
          delete roomParticipants[roomId];
          delete metronomeStates[roomId];
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`HarmonyBridge Backend running on http://localhost:${PORT}`);
});
