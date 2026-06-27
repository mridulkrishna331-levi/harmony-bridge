import React, { useState, useEffect } from 'react';
import { Search, Flame, MapPin, Sparkles, MessageSquare, Volume2, Plus, Check, X, Users } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://harmony-bridge.onrender.com';

const MusicianMatching = ({ user, socket, setActiveView, setTargetRoomId }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterInstrument, setFilterInstrument] = useState('');
  const [filterSkill, setFilterSkill] = useState('');
  const [followedIds, setFollowedIds] = useState(new Set(user?.following || []));
  const [dismissedIds, setDismissedIds] = useState(new Set());

  const handleDismissMatch = (id) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const calculateCompatibility = (currentUser, other) => {
    if (!currentUser || !other) return { score: 60, breakdown: { instrumentScore: 50, genreScore: 50, skillScore: 50, bpmScore: 50 } };

    // 1. Instrument Score
    const inst1 = currentUser.instruments || [];
    const inst2 = other.instruments || [];
    let instrumentScore = 50;
    if (inst1.length > 0 && inst2.length > 0) {
      const exactMatches = inst1.filter(i => inst2.some(otherI => otherI.toLowerCase() === i.toLowerCase()));
      if (exactMatches.length > 0) {
        instrumentScore = 75 + exactMatches.length * 5;
      } else {
        const rhythm = ['drums', 'bass', 'percussion'];
        const harmony = ['guitar', 'piano', 'keyboard', 'synthesizer'];
        const lead = ['vocals', 'saxophone', 'flute', 'violin', 'trumpet'];

        const hasRhythm1 = inst1.some(i => rhythm.some(r => i.toLowerCase().includes(r)));
        const hasRhythm2 = inst2.some(i => rhythm.some(r => i.toLowerCase().includes(r)));
        const hasHarmony1 = inst1.some(i => harmony.some(h => i.toLowerCase().includes(h)));
        const hasHarmony2 = inst2.some(i => harmony.some(h => i.toLowerCase().includes(h)));
        const hasLead1 = inst1.some(i => lead.some(l => i.toLowerCase().includes(l)));
        const hasLead2 = inst2.some(i => lead.some(l => i.toLowerCase().includes(l)));

        if ((hasRhythm1 && hasHarmony2) || (hasHarmony1 && hasRhythm2)) {
          instrumentScore = 95;
        } else if ((hasRhythm1 && hasRhythm2) && (inst1.some(i => i.toLowerCase().includes('drum')) && inst2.some(i => i.toLowerCase().includes('bass')) || inst1.some(i => i.toLowerCase().includes('bass')) && inst2.some(i => i.toLowerCase().includes('drum')))) {
          instrumentScore = 100;
        } else if ((hasLead1 && hasHarmony2) || (hasHarmony1 && hasLead2)) {
          instrumentScore = 90;
        } else if ((hasLead1 && hasRhythm2) || (hasRhythm1 && hasLead2)) {
          instrumentScore = 85;
        }
      }
    }
    instrumentScore = Math.min(100, instrumentScore);

    // 2. Genre Score
    const genres1 = currentUser.genres || [];
    const genres2 = other.genres || [];
    let genreScore = 50;
    if (genres1.length > 0 && genres2.length > 0) {
      const shared = genres1.filter(g => genres2.some(otherG => otherG.toLowerCase() === g.toLowerCase()));
      const allUnique = [...new Set([...genres1, ...genres2])];
      genreScore = allUnique.length > 0 ? Math.round((shared.length / allUnique.length) * 100) : 50;
      if (shared.length > 0) {
        genreScore = Math.max(genreScore, 40 + shared.length * 15);
      } else {
        genreScore = 30;
      }
    }
    genreScore = Math.min(100, genreScore);

    // 3. Skill Score
    const levels = { 'Beginner': 0, 'Intermediate': 1, 'Advanced': 2 };
    const skill1 = currentUser.skillLevel || 'Intermediate';
    const skill2 = other.skillLevel || 'Intermediate';
    let skillScore = 50;
    if (skill1 === skill2) {
      skillScore = 100;
    } else {
      const diff = Math.abs((levels[skill1] ?? 1) - (levels[skill2] ?? 1));
      if (diff === 1) skillScore = 70;
      else skillScore = 30;
    }

    // 4. BPM Score
    const bpm1 = currentUser.uploadedClips?.[currentUser.uploadedClips.length - 1]?.bpm || null;
    const bpm2 = other.uploadedClips?.[other.uploadedClips.length - 1]?.bpm || null;
    let bpmScore = 70;
    if (bpm1 && bpm2) {
      const diff = Math.abs(bpm1 - bpm2);
      if (diff <= 5) bpmScore = 100;
      else if (diff <= 15) bpmScore = 85;
      else if (diff <= 30) bpmScore = 60;
      else bpmScore = 30;
    }

    const score = Math.round(
      (instrumentScore * 0.35) +
      (genreScore * 0.35) +
      (skillScore * 0.15) +
      (bpmScore * 0.15)
    );

    return {
      score,
      breakdown: {
        instrumentScore,
        genreScore,
        skillScore,
        bpmScore
      }
    };
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/matching/recommendations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data);
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/community/follow/${id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const updatedFollowed = new Set(followedIds);
        if (data.isFollowing) {
          updatedFollowed.add(id);
        } else {
          updatedFollowed.delete(id);
        }
        setFollowedIds(updatedFollowed);
      }
    } catch (err) {
      console.error('Error following user:', err);
    }
  };

  const startQuickJam = (targetUser) => {
    // Generate a random room ID or match ID using safe _id attributes
    const currentId = user?._id || user?.id || '';
    const otherId = targetUser?._id || targetUser?.id || '';
    const generatedRoomId = `jam_${currentId.slice(-4)}_${otherId.slice(-4)}`;
    setTargetRoomId(generatedRoomId);
    setActiveView('jamroom');
  };

  // Map recommendations to calculate dynamic compatibility score client-side on-the-fly
  const processedMatches = recommendations
    .filter(rec => rec && rec.user) // Defensive check to filter out empty recommendation records
    .map(rec => {
      const calc = calculateCompatibility(user, rec.user);
      return {
        ...rec,
        matchScore: calc.score,
        breakdown: calc.breakdown
      };
    }).sort((a, b) => b.matchScore - a.matchScore);

  // Filter Logic
  const filteredMatches = processedMatches.filter(match => {
    // Exclude dismissed cards
    if (dismissedIds.has(match.user?._id)) return false;

    const name = (match.user?.username ?? '').toLowerCase();
    const bio  = (match.user?.bio ?? '').toLowerCase();
    const usernameMatch = name.includes(searchQuery.toLowerCase()) ||
      bio.includes(searchQuery.toLowerCase());

    const instrumentMatch = !filterInstrument ||
      (match.user?.instruments ?? []).some(inst => inst.toLowerCase().includes(filterInstrument.toLowerCase()));

    const skillMatch = !filterSkill ||
      (match.user?.skillLevel ?? '').toLowerCase() === filterSkill.toLowerCase();

    return usernameMatch && instrumentMatch && skillMatch;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-electricBlue">
            Musician Matchmaker
          </h2>
          <p className="text-white/60 text-sm mt-1">
            Discover and connect with compatible partners based on instrument, skill level, and BPM overlap.
          </p>
        </div>

        {/* Quick match statistic */}
        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neonPurple to-neonPink flex items-center justify-center">
            <Flame className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <span className="text-xs text-white/40 block uppercase tracking-wider font-bold">Matching Engine</span>
            <span className="text-sm font-bold text-white">Active compatibility scans: Live</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="md:col-span-2 relative">
          <Search className="w-5 h-5 text-white/30 absolute left-4 top-3.5" />
          <input
            type="text"
            placeholder="Search by name, bio, keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl glass-input text-sm"
          />
        </div>

        <div>
          <select
            value={filterInstrument}
            onChange={(e) => setFilterInstrument(e.target.value)}
            className="w-full px-4 py-3 rounded-xl glass-input text-sm appearance-none cursor-pointer"
          >
            <option value="">All Instruments</option>
            <option value="guitar">Guitar</option>
            <option value="drums">Drums</option>
            <option value="bass">Bass</option>
            <option value="piano">Piano / Keyboard</option>
            <option value="vocals">Vocals</option>
            <option value="sax">Saxophone</option>
          </select>
        </div>

        <div>
          <select
            value={filterSkill}
            onChange={(e) => setFilterSkill(e.target.value)}
            className="w-full px-4 py-3 rounded-xl glass-input text-sm appearance-none cursor-pointer"
          >
            <option value="">All Skill Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-t-2 border-r-2 border-electricBlue rounded-full animate-spin mb-4" />
          <p className="text-white/50 text-sm">Running compatibility matrix scans...</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="text-center py-20 glass-panel rounded-3xl border border-white/5">
          <Users className="w-12 h-12 text-white/20 mx-auto mb-4 animate-bounce" />
          <p className="text-white/70 font-semibold text-lg">No musicians found</p>
          <p className="text-white/40 text-sm mt-1">Try broadening your filters or uploading an audio clip to find more matches.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMatches.map(({ user: otherUser, matchScore, breakdown }) => {
            const isFollowed = followedIds.has(otherUser._id);
            return (
              <div 
                key={otherUser._id} 
                className="glass-panel hover-glow rounded-2xl p-6 relative flex flex-col justify-between overflow-hidden border border-white/5"
              >
                {/* Dismiss button top-right */}
                <button
                  onClick={() => handleDismissMatch(otherUser._id)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center bg-white/5 hover:bg-red-50 hover:text-red-500 text-white/40 border border-white/5 transition-all z-30 shadow-sm hover:scale-105 active:scale-95"
                  title="Dismiss Match"
                >
                  <X className="w-3 h-3" />
                </button>
                {/* Score badge top-right - shifted left to avoid close button overlap */}
                <div className="absolute top-4 right-10 flex items-center justify-center z-20">
                  <div className="relative w-14 h-14 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-95" viewBox="0 0 36 36">
                      <path
                        className="text-white/5"
                        strokeWidth="3"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-electricBlue drop-shadow-[0_0_8px_rgba(0,212,255,0.5)]"
                        strokeWidth="3"
                        strokeDasharray={`${matchScore}, 100`}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <span className="text-sm font-bold text-white">{matchScore}%</span>
                    </div>
                  </div>
                </div>

                <div>
                  {/* Identity Row */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-neonPurple to-electricBlue flex items-center justify-center font-bold text-white uppercase text-lg border border-white/10 p-0">
                      {otherUser.avatarUrl ? (
                        <img src={otherUser.avatarUrl} alt={otherUser.username} className="w-full h-full object-cover" />
                      ) : (
                        (otherUser.username || 'MU').slice(0, 2)
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white leading-tight flex items-center gap-1.5">
                        {otherUser.username}
                        {matchScore >= 85 && (
                          <Sparkles className="w-4 h-4 text-amber-400" title="High Compatibility Partner" />
                        )}
                      </h3>
                      <span className="text-xs text-white/50">{otherUser.skillLevel} Musician</span>
                    </div>
                  </div>

                  {/* Instruments & Genres */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {otherUser.instruments.map((inst, i) => (
                      <span key={i} className="text-[11px] bg-electricBlue/10 text-electricBlue px-2 py-0.5 rounded-full border border-electricBlue/15 font-medium">
                        {inst}
                      </span>
                    ))}
                    {otherUser.genres.map((gen, i) => (
                      <span key={i} className="text-[11px] bg-neonPurple/10 text-neonPurple px-2 py-0.5 rounded-full border border-neonPurple/15 font-medium">
                        {gen}
                      </span>
                    ))}
                  </div>

                  {/* Bio */}
                  <p className="text-xs text-white/60 mb-6 line-clamp-2 leading-relaxed">
                    {otherUser.bio}
                  </p>

                  {/* Compatibility Breakdown meters */}
                  <div className="space-y-2 mb-6 bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold block">Match Metrics</span>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-white/50">Instrument Synergy</span>
                      <span className="font-semibold text-white">{breakdown.instrumentScore}%</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-white/50">Genre Similarity</span>
                      <span className="font-semibold text-white">{breakdown.genreScore}%</span>
                    </div>
                    {otherUser.uploadedClips?.length > 0 && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/50">BPM/Tempo Sync</span>
                        <span className="font-semibold text-electricBlue">{breakdown.bpmScore}%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 mt-auto pt-4 border-t border-white/5">
                  <button
                    onClick={() => startQuickJam(otherUser)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-neonPurple to-electricBlue font-bold text-xs hover:opacity-90 hover:shadow-glow-blue transition-all"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Jam Live
                  </button>

                  <button
                    onClick={() => handleFollow(otherUser._id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                      isFollowed
                        ? 'bg-white/5 border-white/10 text-white/50 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20'
                        : 'bg-white/5 border-white/5 hover:bg-white/10 text-white'
                    }`}
                  >
                    {isFollowed ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Following
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        Follow
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MusicianMatching;
