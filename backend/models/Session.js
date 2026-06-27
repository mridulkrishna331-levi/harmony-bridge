const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  senderName: String,
  content: {
    type: String,
    required: true,
  },
  fileUrl: String,
  fileName: String,
  timestamp: {
    type: Date,
    default: Date.now,
  }
});

const SessionSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  bpm: {
    type: Number,
    default: 120,
  },
  key: {
    type: String,
    default: 'C Major',
  },
  metronomePlaying: {
    type: Boolean,
    default: false,
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  messages: [MessageSchema],
  notes: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400, // Automagically clean up old sessions after 24h
  }
});

module.exports = mongoose.model('Session', SessionSchema);
