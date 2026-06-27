import React, { useState } from 'react';
import { Cpu, Send, Sparkles, BookOpen, Music, CheckCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://harmony-bridge.onrender.com';

const AICoach = () => {
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: "Hey! I'm your AI Practice Coach & Jam Assistant. Need practice routines, chord suggestions, or scale layouts? Just let me know what key and tempo you are working with!"
    }
  ]);
  const [input, setInput] = useState('');
  const [bpm, setBpm] = useState(120);
  const [key, setKey] = useState('G Major');
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/coach/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: currentInput, bpm, key })
      });

      if (!response.ok) {
        throw new Error('Coach inference endpoint returned status ' + response.status);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;

      // Append empty AI message placeholder to load streamed tokens into
      setMessages(prev => [...prev, { sender: 'ai', text: '' }]);

      let accumulatedText = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') {
                done = true;
                break;
              }
              try {
                const parsed = JSON.parse(dataStr);
                const textContent = parsed.choices?.[0]?.delta?.content || '';
                accumulatedText += textContent;

                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { sender: 'ai', text: accumulatedText };
                  return updated;
                });
              } catch (err) {
                // Keep reading
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('AI Coach conversation stream failed:', err);
      setMessages(prev => [...prev, { sender: 'ai', text: 'Connection issue. Could not establish communication link with AI Coach API endpoint.' }]);
    } finally {
      setLoading(false);
    }
  };

  const getPentanoticNotes = (k) => {
    const scaleMap = {
      'C Major': 'C, D, E, G, A',
      'G Major': 'G, A, B, D, E',
      'D Major': 'D, E, F#, A, B',
      'A Major': 'A, B, C#, E, F#',
      'E Major': 'E, F#, G#, B, C#',
      'F Major': 'F, G, A, C, D',
      'A Minor': 'A, C, D, E, G',
      'E Minor': 'E, G, A, B, D',
      'D Minor': 'D, F, G, A, C'
    };
    return scaleMap[k] || '1, 2, 3, 5, 6';
  };

  const getChords = (k) => {
    const chordMap = {
      'C Major': 'C - G - Am - F',
      'G Major': 'G - D - Em - C',
      'D Major': 'D - A - Bm - G',
      'A Major': 'A - E - F#m - D',
      'E Major': 'E - B - C#m - A',
      'F Major': 'F - C - Dm - Bb',
      'A Minor': 'Am - F - C - G',
      'E Minor': 'Em - C - G - D',
      'D Minor': 'Dm - Bb - F - C'
    };
    return chordMap[k] || 'I - V - vi - IV';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
      {/* Configuration Sidebar */}
      <div className="w-full lg:w-80 shrink-0 space-y-6">
        <div className="glass-panel rounded-2xl p-6 border border-white/5">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-electricBlue" />
            AI Config Panel
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/40 uppercase tracking-widest font-bold block mb-1.5">Target Tempo</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="60"
                  max="180"
                  value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="flex-1 accent-electricBlue"
                />
                <span className="text-sm font-bold text-white w-12 text-right">{bpm} <span className="text-[10px] text-white/40">BPM</span></span>
              </div>
            </div>

            <div>
              <label className="text-xs text-white/40 uppercase tracking-widest font-bold block mb-1.5">Scale Key</label>
              <select
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl glass-input text-xs cursor-pointer"
              >
                {['C Major', 'G Major', 'D Major', 'A Major', 'E Major', 'F Major', 'A Minor', 'E Minor', 'D Minor'].map((k) => (
                  <option key={k} value={k} className="bg-darkSurface text-white text-xs">{k}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quick tools */}
        <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-3">
          <h4 className="text-xs font-bold text-white uppercase tracking-widest block mb-2">Preset Inquiries</h4>
          <button
            onClick={() => {
              setInput("Suggest chord progression for my scale");
            }}
            className="w-full text-left text-xs bg-white/5 border border-white/5 hover:border-electricBlue/20 rounded-xl px-4 py-3 text-white/70 hover:text-white transition-all flex items-center gap-2"
          >
            <Music className="w-3.5 h-3.5 text-electricBlue" />
            Suggested chord layouts
          </button>
          <button
            onClick={() => {
              setInput("What scale keys should I play over this BPM?");
            }}
            className="w-full text-left text-xs bg-white/5 border border-white/5 hover:border-electricBlue/20 rounded-xl px-4 py-3 text-white/70 hover:text-white transition-all flex items-center gap-2"
          >
            <BookOpen className="w-3.5 h-3.5 text-neonPurple" />
            Compatible Scales & Intervals
          </button>
        </div>
      </div>

      {/* Chat Workspace */}
      <div className="flex-1 glass-panel rounded-2xl border border-white/5 flex flex-col h-[550px] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-electricBlue/10 border border-electricBlue/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-electricBlue animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Coach Bot</h3>
              <span className="text-[10px] text-green-400 font-semibold block">Online • Synthesizer Engine</span>
            </div>
          </div>
        </div>

        {/* Messaging Box */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 max-w-[80%] ${
                msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs uppercase ${
                  msg.sender === 'user' 
                    ? 'bg-gradient-to-br from-neonPurple to-electricBlue text-white' 
                    : 'bg-white/10 text-electricBlue'
                }`}
              >
                {msg.sender === 'user' ? 'ME' : 'AI'}
              </div>
              <div
                className={`rounded-2xl p-4 text-xs leading-relaxed whitespace-pre-line border ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-tr from-neonPurple/15 to-electricBlue/15 border-electricBlue/20 text-white'
                    : 'bg-white/5 border-white/5 text-white/80'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 mr-auto items-center">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <div className="w-4 h-4 border-t-2 border-r-2 border-electricBlue rounded-full animate-spin" />
              </div>
              <span className="text-[10px] text-white/30">Coach is thinking...</span>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Ask practice coaching advice or progression scale tips..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-electricBlue"
            />
            <button
              onClick={handleSendMessage}
              className="p-3.5 rounded-xl bg-gradient-to-r from-neonPurple to-electricBlue text-white hover:opacity-90 shadow-glow-blue transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AICoach;
