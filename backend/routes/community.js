const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   POST api/community/posts
// @desc    Create a new community feed post
// @access  Private
router.post('/posts', auth, async (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ msg: 'Post content cannot be empty' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const newPost = new Post({
      user: req.user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      content,
    });

    const savedPost = await newPost.save();
    res.status(201).json(savedPost);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error creating post' });
  }
});

// @route   GET api/community/feed
// @desc    Get all community feed posts
// @access  Private
router.get('/feed', auth, async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ timestamp: -1 })
      .populate('user', 'username avatarUrl skillLevel');
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error retrieving feed' });
  }
});

// @route   POST api/community/posts/:id/like
// @desc    Like or unlike a post
// @access  Private
router.post('/posts/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.id || req.params.id);
    if (!post) return res.status(404).json({ msg: 'Post not found' });

    // Check if already liked
    const index = post.likes.indexOf(req.user.id);
    if (index === -1) {
      post.likes.push(req.user.id); // Like
    } else {
      post.likes.splice(index, 1); // Unlike
    }

    await post.save();
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error updating like state' });
  }
});

// @route   POST api/community/posts/:id/comment
// @desc    Add comment to a post
// @access  Private
router.post('/posts/:id/comment', auth, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ msg: 'Comment cannot be empty' });

  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ msg: 'Post not found' });

    const user = await User.findById(req.user.id);

    const newComment = {
      user: req.user.id,
      username: user.username,
      content,
    };

    post.comments.push(newComment);
    await post.save();
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error adding comment' });
  }
});

// @route   POST api/community/follow/:id
// @desc    Follow or unfollow a musician
// @access  Private
router.post('/follow/:id', auth, async (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.user.id) {
    return res.status(400).json({ msg: 'You cannot follow yourself' });
  }

  try {
    const targetUser = await User.findById(targetId);
    const currentUser = await User.findById(req.user.id);

    if (!targetUser || !currentUser) {
      return res.status(404).json({ msg: 'Musician not found' });
    }

    const followIndex = currentUser.following.indexOf(targetId);
    const followerIndex = targetUser.followers.indexOf(req.user.id);

    if (followIndex === -1) {
      // Follow
      currentUser.following.push(targetId);
      targetUser.followers.push(req.user.id);
    } else {
      // Unfollow
      currentUser.following.splice(followIndex, 1);
      targetUser.followers.splice(followerIndex, 1);
    }

    await currentUser.save();
    await targetUser.save();

    res.json({
      following: currentUser.following,
      targetFollowersCount: targetUser.followers.length,
      isFollowing: followIndex === -1
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error handling follow action' });
  }
});

module.exports = router;
