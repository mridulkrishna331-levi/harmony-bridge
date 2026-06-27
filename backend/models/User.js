const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  bio: {
    type: String,
    default: 'A passionate musician ready to collaborate!',
  },
  skillLevel: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    default: 'Intermediate',
  },
  instruments: {
    type: [String],
    default: [],
  },
  genres: {
    type: [String],
    default: [],
  },
  availability: {
    type: String,
    enum: ['Available', 'Jamming', 'Offline'],
    default: 'Available',
  },
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  uploadedClips: [{
    filename: String,
    originalName: String,
    bpm: Number,
    key: String,
    duration: Number,
    insights: [String],
    pitch_detection: Number,
    rhythm_stability: Number,
    transient_detection: Number,
    timestamp: {
      type: Date,
      default: Date.now,
    }
  }],
  avatarUrl: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('User', UserSchema);
