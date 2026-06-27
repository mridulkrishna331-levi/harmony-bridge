const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const auth = require('../middleware/auth');
const User = require('../models/User');

// Configure multer storage
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${req.user.id}_${Date.now()}${path.extname(file.originalname)}`);
  }
});

// File filter for audio files
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.wav', '.mp3', '.ogg', '.m4a', '.webm', '.aac'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// @route   POST api/analysis/upload
// @desc    Upload and analyze audio clip
// @access  Private
router.post('/upload', auth, upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: 'Please upload an audio file' });
  }

  const filePath = req.file.path;
  const scriptPath = path.join(__dirname, '../services/analyze.py');

  try {
    // Spawn Python process
    // Use 'python' or 'python3' depending on environment
    const pythonProcess = spawn('python', [scriptPath, filePath]);

    let dataString = '';
    let errorString = '';

    pythonProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorString += data.toString();
    });

    pythonProcess.on('close', async (code) => {
      // Clean up uploaded file from local disk to save space
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error('Failed to delete temp file:', err);
      }

      if (code !== 0) {
        console.error(`Python script error. Exit code: ${code}. Error: ${errorString}`);
        return res.status(500).json({ msg: 'Audio processing failed', error: errorString });
      }

      try {
        const analysisResult = JSON.parse(dataString);
        if (!analysisResult.success) {
          return res.status(422).json({ msg: 'Could not process audio content', error: analysisResult.error });
        }

        // Add to User's clip history
        const user = await User.findById(req.user.id);
        if (!user) {
          return res.status(404).json({ msg: 'User not found' });
        }

        const newClip = {
          filename: req.file.filename,
          originalName: req.file.originalname,
          bpm: analysisResult.bpm,
          key: analysisResult.key,
          duration: analysisResult.duration,
          insights: analysisResult.insights || [],
          pitch_detection: analysisResult.pitch_detection || 0,
          rhythm_stability: analysisResult.rhythm_stability || 0,
          transient_detection: analysisResult.transient_detection || 0,
          timestamp: new Date()
        };

        user.uploadedClips.push(newClip);
        
        // Suggest general matching profile additions
        await user.save();

        res.json({
          analysis: analysisResult,
          clip: newClip,
          uploadedClips: user.uploadedClips
        });

      } catch (parseError) {
        console.error('Error parsing python stdout:', parseError, 'Raw data:', dataString);
        res.status(500).json({ msg: 'Error parsing analysis output' });
      }
    });

  } catch (err) {
    console.error(err);
    // Cleanup on immediate throw
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.status(500).json({ msg: 'Server error during audio analysis' });
  }
});

module.exports = router;
