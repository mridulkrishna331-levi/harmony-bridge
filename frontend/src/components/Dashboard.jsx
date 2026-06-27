import React, { useState, useEffect } from 'react';
import { Calendar, History, Trophy, Sparkles, Sliders, Volume2, Save, FileAudio, Settings, X } from 'lucide-react';

const Dashboard = ({ user, onUpdateUser, setActiveView, setTargetRoomId }) => {
  const [bio, setBio] = useState(user?.bio || '');
  const [skillLevel, setSkillLevel] = useState(user?.skillLevel || 'Intermediate');
  const [availability, setAvailability] = useState(user?.availability || 'Available');
  const [instruments, setInstruments] = useState(user?.instruments?.join(', ') || '');
  const [genres, setGenres] = useState(user?.genres?.join(', ') || '');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');

  useEffect(() => {
    if (user) {
      setBio(user.bio || '');
      setSkillLevel(user.skillLevel || 'Intermediate');
      setAvailability(user.availability || 'Available');
      setInstruments(user.instruments?.join(', ') || '');
      setGenres(user.genres?.join(', ') || '');
      setAvatarUrl(user.avatarUrl || '');
    }
  }, [user]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (PNG, JPG, etc.).');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result); // Base64 encoding URL
      };
      reader.readAsDataURL(file);
    }
  };

  // Achievements
  const achievements = [
    { id: 'first_jam', name: 'First Sync', desc: 'Participated in a live WebRTC jam session.', unlocked: true, icon: Volume2 },
    { id: 'bpm_pro', name: 'BPM Analyst', desc: 'Analyzed an audio performance clip.', unlocked: user?.uploadedClips?.length > 0, icon: FileAudio },
    { id: 'social_star', name: 'Social Harmony', desc: 'Followed another musician on the platform.', unlocked: user?.following?.length > 0, icon: Trophy }
  ];

  // Upcoming Jams dynamic state list
  const [sessions, setSessions] = useState([
    { id: 'up_1', title: 'Weekend Blues Improvisation', date: new Date(Date.now() + 86400000).toISOString(), key: 'G Major', bpm: 120 }, // Tomorrow
    { id: 'up_2', title: 'Jazz Progression Masterclass', date: new Date(Date.now() - 1800000).toISOString(), key: 'A Minor', bpm: 90 } // Live 30 mins ago
  ]);

  // Modal form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newBpm, setNewBpm] = useState(120);
  const [newKey, setNewKey] = useState('C Major');

  // Dynamic state evaluator tick (re-evaluates time statuses every 10 seconds)
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const handleAddSession = (e) => {
    e.preventDefault();
    if (!newTitle || !newDate) return;
    const newSession = {
      id: `up_${Date.now()}`,
      title: newTitle,
      date: new Date(newDate).toISOString(),
      bpm: newBpm,
      key: newKey
    };
    setSessions(prev => [newSession, ...prev]);
    // Reset Form
    setNewTitle('');
    setNewDate('');
    setNewBpm(120);
    setNewKey('C Major');
    setShowAddModal(false);
  };

  const removeSession = (id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
  };

  const getEventStatus = (dateStr) => {
    const eventTime = new Date(dateStr).getTime();
    const now = Date.now();
    const duration = 2 * 60 * 60 * 1000; // 2 hour duration window
    if (now >= eventTime && now <= eventTime + duration) {
      return 'live';
    } else if (now > eventTime + duration) {
      return 'ended';
    }
    return 'upcoming';
  };

  // Recent Jams history
  const recentJams = [
    { id: 'rec_1', title: 'Pop Jam Studio 4', date: '2 days ago', duration: '42 mins', bpm: 110 },
    { id: 'rec_2', title: 'Metal Riffing Session', date: '5 days ago', duration: '1 hr 15 mins', bpm: 140 }
  ];

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');

    const formattedInstruments = instruments.split(',').map(i => i.trim()).filter(Boolean);
    const formattedGenres = genres.split(',').map(g => g.trim()).filter(Boolean);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bio,
          skillLevel,
          availability,
          instruments: formattedInstruments,
          genres: formattedGenres,
          avatarUrl
        })
      });

      if (res.ok) {
        const updatedUser = await res.json();
        onUpdateUser(updatedUser);
        setSuccessMsg('Profile updated successfully!');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const joinSession = (roomCode) => {
    setTargetRoomId(roomCode);
    setActiveView('jamroom');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <div className="glass-panel-glow-blue rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden border border-electricBlue/15">
        <div className="absolute inset-0 bg-gradient-to-r from-neonPurple/5 to-electricBlue/5 pointer-events-none" />
        <div className="space-y-2 relative">
          <h2 className="text-3xl font-extrabold text-white leading-tight">
            Welcome back, <span className="text-electricBlue">{user?.username}</span>!
          </h2>
          <p className="text-white/60 text-xs sm:text-sm max-w-xl">
            You play <span className="text-white font-semibold">{user?.instruments?.join(', ') || 'no instrument set'}</span>. 
            Check your skill metrics or jump into an active studio room to jam.
          </p>
        </div>

        <button
          onClick={() => joinSession(`room_${Math.floor(1000 + Math.random() * 9000)}`)}
          className="relative px-6 py-3 rounded-xl bg-gradient-to-r from-neonPurple to-electricBlue font-bold text-sm hover:shadow-glow-blue hover:opacity-95 transition-all text-white shrink-0"
        >
          Quick Studio Join
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Jam History & Upcoming & Achievements */}
        <div className="lg:col-span-2 space-y-8">
          {/* Upcoming Sessions */}
          <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-electricBlue" />
                Upcoming Jam Sessions
              </h3>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-3.5 py-2 rounded-xl border border-white/10 hover:border-electricBlue/40 bg-white/5 text-xs font-bold transition-all text-white flex items-center gap-1.5"
              >
                + Add Session
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sessions.map((session) => {
                const status = getEventStatus(session.date);
                return (
                  <div
                    key={session.id}
                    className="bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-electricBlue/20 transition-all relative group"
                  >
                    {/* Delete button */}
                    <button
                      onClick={() => removeSession(session.id)}
                      className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-400 border border-white/5 hover:border-red-500/20 transition-all opacity-0 group-hover:opacity-100 z-10"
                      title="Delete Session"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {status === 'live' && (
                          <span className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 text-green-500 text-[10px] font-bold px-2 py-0.5 rounded-md animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            LIVE NOW
                          </span>
                        )}
                        {status === 'ended' && (
                          <span className="bg-white/5 border border-white/10 text-white/40 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            ENDED
                          </span>
                        )}
                        {status === 'upcoming' && (
                          <span className="bg-electricBlue/10 border border-electricBlue/20 text-electricBlue text-[10px] font-bold px-2 py-0.5 rounded-md">
                            UPCOMING
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-white pr-6">{session.title}</h4>
                      <span className="text-xs text-white/40 block mt-1">
                        {new Date(session.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
                      <span className="text-[10px] bg-white/5 text-white/50 px-2 py-0.5 rounded-md">
                        {session.bpm} BPM • {session.key}
                      </span>
                      {status !== 'ended' && (
                        <button
                          onClick={() => joinSession(`scheduled_${session.id}`)}
                          className="text-xs font-bold text-electricBlue hover:underline"
                        >
                          Join Room
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Jams */}
          <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-neonPurple" />
              Recent Jam History
            </h3>

            <div className="space-y-4">
              {recentJams.map((jam) => (
                <div
                  key={jam.id}
                  className="bg-white/5 border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-neonPurple/10 border border-neonPurple/20 flex items-center justify-center shrink-0">
                      <Volume2 className="w-5 h-5 text-neonPurple" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{jam.title}</h4>
                      <span className="text-xs text-white/40 block mt-0.5">{jam.date}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <span className="text-xs text-white/40 block">Duration</span>
                      <span className="text-sm font-bold text-white">{jam.duration}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-white/40 block">Tempo</span>
                      <span className="text-xs bg-electricBlue/10 text-electricBlue border border-electricBlue/15 px-2 py-0.5 rounded-md font-bold mt-0.5 inline-block">
                        {jam.bpm} BPM
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Achievements */}
          <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-neonPink" />
              Achievements & Badges
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {achievements.map((ach) => {
                const Icon = ach.icon;
                return (
                  <div
                    key={ach.id}
                    className={`border rounded-2xl p-4 text-center flex flex-col items-center gap-2 ${
                      ach.unlocked
                        ? 'border-neonPurple/20 bg-neonPurple/5 text-white'
                        : 'border-white/5 bg-white/5 text-white/30'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      ach.unlocked ? 'bg-neonPurple text-white' : 'bg-white/5 text-white/20'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold">{ach.name}</h4>
                      <p className="text-[10px] text-white/40 mt-1 leading-snug">{ach.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Profile details Settings */}
        <div className="lg:col-span-1 space-y-8">
          <div className="glass-panel rounded-2xl p-6 border border-white/5">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-electricBlue" />
              Musician Profile Settings
            </h3>

            <form onSubmit={handleProfileSave} className="space-y-4 text-xs">
              {/* Profile Avatar Picture Upload Preview */}
              <div className="flex flex-col items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl mb-2">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-neonPurple to-electricBlue flex items-center justify-center font-bold text-white uppercase text-xl border border-white/10 p-0 shadow-inner relative">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile Avatar" className="w-full h-full object-cover" />
                  ) : (
                    (user?.username ?? 'HB').slice(0, 2)
                  )}
                </div>
                <label className="cursor-pointer px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white hover:text-white border border-white/5 text-[11px] font-bold transition-all flex items-center gap-1.5 active:scale-95">
                  <Sparkles className="w-3.5 h-3.5 text-electricBlue" />
                  Upload Avatar
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
                <span className="text-[10px] text-white/30">PNG, JPG, or GIF (max 2MB)</span>
              </div>
              <div>
                <label className="text-white/50 block mb-1">Availability Status</label>
                <select
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl glass-input cursor-pointer"
                >
                  <option value="Available" className="bg-darkSurface text-white">Available to Jam</option>
                  <option value="Jamming" className="bg-darkSurface text-white">Currently Jamming</option>
                  <option value="Offline" className="bg-darkSurface text-white">Offline</option>
                </select>
              </div>

              <div>
                <label className="text-white/50 block mb-1">Skill Level</label>
                <select
                  value={skillLevel}
                  onChange={(e) => setSkillLevel(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl glass-input cursor-pointer"
                >
                  <option value="Beginner" className="bg-darkSurface text-white">Beginner</option>
                  <option value="Intermediate" className="bg-darkSurface text-white">Intermediate</option>
                  <option value="Advanced" className="bg-darkSurface text-white">Advanced</option>
                </select>
              </div>

              <div>
                <label className="text-white/50 block mb-1">Instruments (comma-separated)</label>
                <input
                  type="text"
                  value={instruments}
                  onChange={(e) => setInstruments(e.target.value)}
                  placeholder="e.g. Guitar, Piano, Bass"
                  className="w-full px-3 py-2.5 rounded-xl glass-input"
                />
              </div>

              <div>
                <label className="text-white/50 block mb-1">Preferred Genres (comma-separated)</label>
                <input
                  type="text"
                  value={genres}
                  onChange={(e) => setGenres(e.target.value)}
                  placeholder="e.g. Rock, Blues, Jazz"
                  className="w-full px-3 py-2.5 rounded-xl glass-input"
                />
              </div>

              <div>
                <label className="text-white/50 block mb-1">Biography</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  placeholder="Tell other musicians about yourself, your setups, or what you are looking to learn..."
                  className="w-full px-3 py-2.5 rounded-xl glass-input resize-none"
                />
              </div>

              {successMsg && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-xl">
                  {successMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-neonPurple to-electricBlue font-bold hover:shadow-glow-blue transition-all disabled:opacity-50 text-white flex items-center justify-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Add Session Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-md p-4">
          <div className="w-full max-w-md glass-panel-glow-purple rounded-3xl p-8 border border-white/10 relative shadow-2xl">
            {/* Close button */}
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all border border-white/5"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-6">Schedule Jam Session</h3>

            <form onSubmit={handleAddSession} className="space-y-4 text-xs">
              <div>
                <label className="text-white/50 block mb-1">Session Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Blues Jam #5"
                  className="w-full px-3 py-2.5 rounded-xl glass-input"
                />
              </div>

              <div>
                <label className="text-white/50 block mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl glass-input cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-white/50 block mb-1">BPM (Tempo)</label>
                  <input
                    type="number"
                    min="40"
                    max="280"
                    required
                    value={newBpm}
                    onChange={(e) => setNewBpm(parseInt(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl glass-input"
                  />
                </div>
                <div>
                  <label className="text-white/50 block mb-1">Scale Key</label>
                  <input
                    type="text"
                    required
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="e.g. C Major"
                    className="w-full px-3 py-2.5 rounded-xl glass-input"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-white font-bold transition-all text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-neonPurple to-electricBlue font-bold hover:shadow-glow-blue transition-all text-white"
                >
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
