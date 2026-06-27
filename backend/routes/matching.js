const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Helper to calculate instrument compatibility score (out of 100)
function getInstrumentScore(instList1, instList2) {
  if (!instList1 || instList1.length === 0 || !instList2 || instList2.length === 0) {
    return 50; // Baseline if incomplete
  }

  // Common complementary setups
  const rhythm = ['Drums', 'Bass', 'Percussion'];
  const harmony = ['Guitar', 'Piano', 'Keyboard', 'Synthesizer'];
  const lead = ['Vocals', 'Saxophone', 'Flute', 'Violin', 'Trumpet'];

  let bestMatch = 50;

  for (let inst1 of instList1) {
    for (let inst2 of instList2) {
      inst1 = inst1.toLowerCase();
      inst2 = inst2.toLowerCase();

      if (inst1 === inst2) {
        bestMatch = Math.max(bestMatch, 70); // Same instrument jam
        continue;
      }

      // Guitar & Drums / Bass & Drums / Piano & Drums / etc.
      const isRhythm1 = rhythm.some(r => inst1.includes(r.toLowerCase()));
      const isRhythm2 = rhythm.some(r => inst2.includes(r.toLowerCase()));
      const isHarmony1 = harmony.some(h => inst1.includes(h.toLowerCase()));
      const isHarmony2 = harmony.some(h => inst2.includes(h.toLowerCase()));
      const isLead1 = lead.some(l => inst1.includes(l.toLowerCase()));
      const isLead2 = lead.some(l => inst2.includes(l.toLowerCase()));

      if ((isRhythm1 && isHarmony2) || (isHarmony1 && isRhythm2)) {
        bestMatch = Math.max(bestMatch, 100); // Perfect pairing (rhythm + harmony)
      } else if ((isRhythm1 && isRhythm2) && (inst1.includes('drum') && inst2.includes('bass') || inst1.includes('bass') && inst2.includes('drum'))) {
        bestMatch = Math.max(bestMatch, 100); // Perfect rhythm section (bass + drums)
      } else if ((isLead1 && isHarmony2) || (isHarmony1 && isLead2)) {
        bestMatch = Math.max(bestMatch, 95); // Lead melody + backing harmony
      } else if ((isLead1 && isRhythm2) || (isRhythm1 && isLead2)) {
        bestMatch = Math.max(bestMatch, 85); // Vocalist + drummer jam
      } else {
        bestMatch = Math.max(bestMatch, 75); // General match
      }
    }
  }

  return bestMatch;
}

// Helper to calculate genre overlap score (out of 100)
function getGenreScore(genres1, genres2) {
  if (!genres1 || genres1.length === 0 || !genres2 || genres2.length === 0) {
    return 50;
  }

  const g1 = genres1.map(g => g.toLowerCase());
  const g2 = genres2.map(g => g.toLowerCase());

  const shared = g1.filter(g => g2.includes(g));
  if (shared.length === 0) return 30; // low genre overlap but not zero if they both like music!

  const uniqueAll = [...new Set([...g1, ...g2])];
  return Math.round((shared.length / uniqueAll.length) * 100);
}

// Helper to calculate skill level compatibility
function getSkillScore(skill1, skill2) {
  if (skill1 === skill2) return 100;
  
  const levels = { 'Beginner': 0, 'Intermediate': 1, 'Advanced': 2 };
  const diff = Math.abs(levels[skill1] - levels[skill2]);

  if (diff === 1) return 70; // One step apart
  return 30; // Beginner vs Advanced (harder to jam directly, but possible!)
}

// Helper to calculate BPM compatibility
function getBpmScore(clips1, clips2) {
  if (!clips1 || clips1.length === 0 || !clips2 || clips2.length === 0) {
    return 70; // Baseline compatibility if clips are missing
  }

  // Get the latest clips
  const clip1 = clips1[clips1.length - 1];
  const clip2 = clips2[clips2.length - 1];

  if (!clip1.bpm || !clip2.bpm) return 70;

  const diff = Math.abs(clip1.bpm - clip2.bpm);
  if (diff <= 5) return 100;
  if (diff <= 15) return 85;
  if (diff <= 30) return 60;
  return 30;
}

// @route   GET api/matching/recommendations
// @desc    Get compatible musicians
// @access  Private
router.get('/recommendations', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Get all other users
    const users = await User.find({ _id: { $ne: currentUser._id } }).select('-password');

    const recommended = users.map(otherUser => {
      const instScore = getInstrumentScore(currentUser.instruments, otherUser.instruments);
      const genreScore = getGenreScore(currentUser.genres, otherUser.genres);
      const skillScore = getSkillScore(currentUser.skillLevel, otherUser.skillLevel);
      const bpmScore = getBpmScore(currentUser.uploadedClips, otherUser.uploadedClips);

      // Weighted score calculation
      // Instruments: 35%, Genres: 35%, Skill: 15%, BPM: 15%
      const matchScore = Math.round(
        (instScore * 0.35) +
        (genreScore * 0.35) +
        (skillScore * 0.15) +
        (bpmScore * 0.15)
      );

      // Detail breakdown
      const breakdown = {
        instrumentScore: instScore,
        genreScore: genreScore,
        skillScore: skillScore,
        bpmScore: bpmScore
      };

      return {
        user: otherUser,
        matchScore,
        breakdown
      };
    });

    // Sort by match score descending
    recommended.sort((a, b) => b.matchScore - a.matchScore);

    res.json(recommended);

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error generating recommendations' });
  }
});

module.exports = router;
