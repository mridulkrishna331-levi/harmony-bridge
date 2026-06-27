const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_harmony_bridge_key_2026';

// @route   POST api/auth/register
// @desc    Register a user
// @access  Public
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ msg: 'Please enter all fields' });
  }

  try {
    // Check for existing user
    let userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ msg: 'User with this email or username already exists' });
    }

    const newUser = new User({
      username,
      email,
      password,
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    newUser.password = await bcrypt.hash(password, salt);

    // Save user
    const savedUser = await newUser.save();

    // Create Token
    const token = jwt.sign(
      { id: savedUser._id, username: savedUser.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: savedUser._id,
        username: savedUser.username,
        email: savedUser.email,
        bio: savedUser.bio,
        skillLevel: savedUser.skillLevel,
        instruments: savedUser.instruments,
        genres: savedUser.genres,
        availability: savedUser.availability,
        followers: savedUser.followers,
        following: savedUser.following,
        uploadedClips: savedUser.uploadedClips,
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error during registration' });
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  const { emailOrUsername, password } = req.body;

  if (!emailOrUsername || !password) {
    return res.status(400).json({ msg: 'Please enter all fields' });
  }

  try {
    // Check if user exists (by email or username)
    const user = await User.findOne({
      $or: [
        { email: emailOrUsername.toLowerCase() },
        { username: emailOrUsername }
      ]
    });

    if (!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Create Token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        skillLevel: user.skillLevel,
        instruments: user.instruments,
        genres: user.genres,
        availability: user.availability,
        followers: user.followers,
        following: user.following,
        uploadedClips: user.uploadedClips,
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error during login' });
  }
});

// @route   POST api/auth/forgot-password
// @desc    Mock forgot password
// @access  Public
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ msg: 'Please provide email' });
  }
  // In a real application, you would send a reset link via email.
  res.json({ msg: 'Password reset link sent to your registered email address.' });
});

// @route   GET api/auth/profile
// @desc    Get user data
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('followers', 'username bio avatarUrl')
      .populate('following', 'username bio avatarUrl');
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error fetching profile' });
  }
});

// @route   PUT api/auth/profile
// @desc    Update user profile data
// @access  Private
router.put('/profile', auth, async (req, res) => {
  const { bio, skillLevel, instruments, genres, availability, avatarUrl } = req.body;

  try {
    const fieldsToUpdate = {};
    if (bio !== undefined) fieldsToUpdate.bio = bio;
    if (skillLevel !== undefined) fieldsToUpdate.skillLevel = skillLevel;
    if (instruments !== undefined) fieldsToUpdate.instruments = instruments;
    if (genres !== undefined) fieldsToUpdate.genres = genres;
    if (availability !== undefined) fieldsToUpdate.availability = availability;
    if (avatarUrl !== undefined) fieldsToUpdate.avatarUrl = avatarUrl;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: fieldsToUpdate },
      { new: true }
    ).select('-password');

    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error updating profile' });
  }
});

module.exports = router;
