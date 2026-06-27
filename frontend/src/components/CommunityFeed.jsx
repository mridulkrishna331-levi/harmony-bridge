import React, { useState, useEffect } from 'react';
import { Share2, ThumbsUp, MessageCircle, Send, Globe, Radio, Plus, Users, X } from 'lucide-react';

const CommunityFeed = ({ user, socket, setActiveView, setTargetRoomId }) => {
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [loading, setLoading] = useState(true);

  // Private room setup state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customRoomName, setCustomRoomName] = useState('');
  const [maxCapacity, setMaxCapacity] = useState(4);
  const [roomGenre, setRoomGenre] = useState('Rock');

  const handleCreatePrivateRoom = (e) => {
    e.preventDefault();
    if (!customRoomName.trim()) return;
    const formattedId = customRoomName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    joinRoom(`jam_${formattedId}_${Math.floor(100 + Math.random() * 900)}`);
    // Reset Form
    setCustomRoomName('');
    setMaxCapacity(4);
    setRoomGenre('Rock');
    setShowCreateModal(false);
  };

  // Active public rooms list
  const publicRooms = [
    { id: 'rock_jam_88', name: 'Rock & Blues Studio', bpm: 120, key: 'G Major', activeCount: 2 },
    { id: 'jazz_lounge', name: 'Jazz & Swing Improvisation', bpm: 95, key: 'A Minor', activeCount: 3 },
    { id: 'synth_space', name: 'Ambient Electronic Sync', bpm: 110, key: 'C Major', activeCount: 1 }
  ];

  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/community/feed', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (err) {
      console.error('Error fetching feed posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/community/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: newPostContent })
      });

      if (res.ok) {
        const data = await res.json();
        // Add author local details since backend returns references
        data.user = {
          username: user.username,
          avatarUrl: user.avatarUrl,
          skillLevel: user.skillLevel
        };
        setPosts(prev => [data, ...prev]);
        setNewPostContent('');
      }
    } catch (err) {
      console.error('Error creating feed post:', err);
    }
  };

  const handleLike = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/community/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const updatedPost = await res.json();
        setPosts(prev => prev.map(p => p._id === postId ? { ...p, likes: updatedPost.likes } : p));
      }
    } catch (err) {
      console.error('Error liking post:', err);
    }
  };

  const joinRoom = (roomId) => {
    setTargetRoomId(roomId);
    setActiveView('jamroom');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
      {/* Feed Wall */}
      <div className="flex-1 space-y-6">
        {/* Post Publisher */}
        <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Share2 className="w-5 h-5 text-electricBlue" />
            Share a Practice Update
          </h3>

          <textarea
            placeholder="Write a message, share your latest scale speed, or coordinate a jam session..."
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            rows={3}
            className="w-full bg-white/5 border border-white/5 rounded-xl p-4 text-xs text-white focus:outline-none focus:border-electricBlue resize-none font-sans"
          />

          <div className="flex justify-between items-center">
            <span className="text-[10px] text-white/30 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" />
              Public to HarmonyBridge community
            </span>
            <button
              onClick={handleCreatePost}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-neonPurple to-electricBlue font-bold text-xs hover:shadow-glow-blue transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              Publish Post
            </button>
          </div>
        </div>

        {/* Timeline Posts */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-t-2 border-r-2 border-electricBlue rounded-full animate-spin mb-3" />
            <p className="text-white/40 text-xs">Loading community activities...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 glass-panel rounded-2xl border border-white/5">
            <p className="text-white/50 text-sm">No updates posted yet.</p>
            <p className="text-white/30 text-xs mt-1">Be the first to share your music progress!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => {
              const author = post.user || {};
              const isLiked = post.likes.includes(user.id);
              return (
                <div key={post._id} className="glass-panel rounded-2xl p-6 border border-white/5 space-y-4">
                  {/* Identity */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-neonPurple to-electricBlue flex items-center justify-center font-bold text-white uppercase text-sm border border-white/10 p-0">
                        {author.avatarUrl ? (
                          <img src={author.avatarUrl} alt={author.username} className="w-full h-full object-cover" />
                        ) : (
                          author.username ? author.username.slice(0, 2) : 'MU'
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{author.username || post.username}</h4>
                        <span className="text-[10px] text-white/40 block -mt-0.5">{author.skillLevel || 'Musician'}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-white/30">
                      {new Date(post.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  {/* Content */}
                  <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap">
                    {post.content}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-4 pt-4 border-t border-white/5 shrink-0">
                    <button
                      onClick={() => handleLike(post._id)}
                      className={`flex items-center gap-1.5 text-[11px] font-bold transition-all ${
                        isLiked ? 'text-electricBlue' : 'text-white/40 hover:text-white'
                      }`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{post.likes.length} Likes</span>
                    </button>

                    <span className="text-white/10">|</span>

                    <div className="flex items-center gap-1.5 text-[11px] text-white/40 font-semibold">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{post.comments.length} Comments</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sidebar: Public Jam Rooms */}
      <div className="w-full lg:w-80 shrink-0 space-y-6">
        <div className="glass-panel rounded-2xl p-6 border border-white/5">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Radio className="w-4 h-4 text-electricBlue animate-pulse" />
              Public Jam Rooms
            </h3>
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          </div>

          <div className="space-y-4">
            {publicRooms.map((room) => (
              <div
                key={room.id}
                className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col justify-between gap-3 hover:border-electricBlue/20 transition-all group"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <h4 className="text-xs font-bold text-white leading-tight group-hover:text-electricBlue transition-all">
                      {room.name}
                    </h4>
                    <span className="text-[9px] bg-electricBlue/10 text-electricBlue border border-electricBlue/20 rounded-full px-1.5 py-0.5 font-bold flex items-center gap-1">
                      <Users className="w-2.5 h-2.5" />
                      {room.activeCount}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <span className="text-[9px] bg-white/5 text-white/40 px-1.5 py-0.5 rounded-md font-medium">
                      {room.bpm} BPM
                    </span>
                    <span className="text-[9px] bg-white/5 text-white/40 px-1.5 py-0.5 rounded-md font-medium">
                      {room.key}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => joinRoom(room.id)}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-neonPurple/20 to-electricBlue/20 text-white/80 hover:text-white hover:from-neonPurple hover:to-electricBlue font-bold text-[10px] transition-all text-center border border-white/5 hover:border-transparent"
                >
                  Join Room
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full mt-6 py-3 rounded-xl bg-white/5 border border-dashed border-white/10 hover:border-electricBlue/30 text-white/60 hover:text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create Private Room
          </button>
        </div>
      </div>

      {/* Create Private Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-md p-4">
          <div className="w-full max-w-md glass-panel-glow-blue rounded-3xl p-8 border border-white/10 relative shadow-2xl">
            {/* Close */}
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all border border-white/5"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-6">Create Private Studio Room</h3>

            <form onSubmit={handleCreatePrivateRoom} className="space-y-4 text-xs">
              <div>
                <label className="text-white/50 block mb-1">Room Name / ID</label>
                <input
                  type="text"
                  required
                  value={customRoomName}
                  onChange={(e) => setCustomRoomName(e.target.value)}
                  placeholder="e.g. Neo Classical Studio"
                  className="w-full px-3 py-2.5 rounded-xl glass-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-white/50 block mb-1">Max Participants</label>
                  <select
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(parseInt(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl glass-input cursor-pointer"
                  >
                    <option value={2} className="bg-darkSurface text-white">2 Members</option>
                    <option value={4} className="bg-darkSurface text-white">4 Members</option>
                    <option value={6} className="bg-darkSurface text-white">6 Members</option>
                  </select>
                </div>

                <div>
                  <label className="text-white/50 block mb-1">Session Genre</label>
                  <select
                    value={roomGenre}
                    onChange={(e) => setRoomGenre(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl glass-input cursor-pointer"
                  >
                    {['Rock', 'Blues', 'Jazz', 'Metal', 'Electronic', 'Acoustic', 'Improv'].map(g => (
                      <option key={g} value={g} className="bg-darkSurface text-white">{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-white font-bold transition-all text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-neonPurple to-electricBlue font-bold hover:shadow-glow-blue transition-all text-white"
                >
                  Create & Launch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityFeed;
