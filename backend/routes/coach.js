const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// @route   POST api/coach/chat
// @desc    Interact with AI practice coach with real-time text streaming
// @access  Private
router.post('/chat', auth, async (req, res) => {
  const { message, bpm, key } = req.body;
  if (!message) {
    return res.status(400).json({ msg: 'Message is required' });
  }

  const apiKey = process.env.COACH_AI_API_KEY || process.env.GROK_API_KEY;

  if (apiKey) {
    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'grok-beta',
          messages: [
            { role: 'system', content: `You are an expert AI music coach assisting a musician practicing at ${bpm} BPM in the key of ${key}. Provide concise, actionable, and encouraging feedback.` },
            { role: 'user', content: message }
          ],
          stream: true
        })
      });

      if (response.ok) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        response.body.on('data', (chunk) => {
          res.write(chunk);
        });

        response.body.on('end', () => {
          res.end();
        });
        return;
      }
    } catch (err) {
      console.error('Error invoking external AI service:', err);
    }
  }

  // High-fidelity streaming simulator (data-driven fallback)
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const textLower = message.toLowerCase();
  let responses = [];

  if (textLower.includes('scale') || textLower.includes('play')) {
    responses = [
      `For ${key} at ${bpm} BPM:\n\n`,
      `- **Dominant Scale**: Try playing the ${key} Pentatonic scale (Notes: C, D, E, G, A or equivalents).\n`,
      `- **Picking Drill**: Play ascending in quarter notes and descending in eighth notes to align with the tempo.\n`,
      `- **Jamming Tip**: Target the root and minor third notes on downbeats. Keep your strumming syncopated matching the sixteenth note grid.`
    ];
  } else if (textLower.includes('chord') || textLower.includes('progression')) {
    responses = [
      `Suggested Chord Progression for ${key}:\n\n`,
      `- **Progression**: I - V - vi - IV (e.g., G - D - Em - C or equivalents).\n`,
      `- **Strumming Pattern**: Down, Down-Up, Up-Down-Up at ${bpm} BPM.\n`,
      `- **Voice Leading**: Try adding suspended 2nd chord extensions on transitions to add structural color.`
    ];
  } else {
    responses = [
      `Got it! If you want to master ${key} at ${bpm} BPM, here is an AI Coach Routine:\n\n`,
      `1. **Warmup (3 min)**: Run chromatic scale finger exercises on your fretboard/keys.\n`,
      `2. **Scale Mapping**: Practice visual layouts of the primary scale shape up and down matching the metronome.\n`,
      `3. **Chord Loop**: Set a loop over the I - IV - V progression to practice chord transition speeds.\n\n`,
      `Let me know if you would like me to generate specific tablatures or compatibility ratings!`
    ];
  }

  let index = 0;
  const interval = setInterval(() => {
    if (index < responses.length) {
      const textChunk = responses[index];
      const sseData = {
        choices: [{
          delta: {
            content: textChunk
          }
        }]
      };
      res.write(`data: ${JSON.stringify(sseData)}\n\n`);
      index++;
    } else {
      clearInterval(interval);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }, 200);
});

module.exports = router;
