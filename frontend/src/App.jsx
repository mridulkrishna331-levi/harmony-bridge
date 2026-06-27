import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';

// ── Environment-aware API & Socket base URLs ──────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://harmony-bridge.onrender.com';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://harmony-bridge.onrender.com';
import Navbar from './components/Navbar';
import WaveformVisualizer from './components/WaveformVisualizer';
import ParticleBackground from './components/ParticleBackground';
import Dashboard from './components/Dashboard';
import MusicianMatching from './components/MusicianMatching';
import JamRoom from './components/JamRoom';
import SkillAnalyzer from './components/SkillAnalyzer';
import CommunityFeed from './components/CommunityFeed';
import AICoach from './components/AICoach';
import {
  Sparkles, Play, Users, Mail, Lock, User, X,
  Radio, Zap, Shield, Cpu, BarChart2, Globe,
  Music, Headphones, Star, ArrowRight, ChevronRight
} from 'lucide-react';

// ─── Page transition variants ───────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -12, transition: { duration: 0.2, ease: 'easeIn' } },
};

// ─── Feature card data ───────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Radio,
    color: 'from-electricBlue to-neonPurple',
    glow: 'shadow-glow-blue',
    title: 'Real-Time Jam Studio',
    desc: 'WebRTC-powered mesh rooms for up to 4 musicians — ultra-low latency audio & video with screen sharing built in.',
  },
  {
    icon: BarChart2,
    color: 'from-neonPurple to-neonPink',
    glow: 'shadow-glow-purple',
    title: 'AI Skill Analyzer',
    desc: 'Drop any audio clip. Our signal processor extracts BPM, scale key, tempo stability, and charts your rhythm profile.',
  },
  {
    icon: Zap,
    color: 'from-amber-400 to-orange-500',
    glow: '',
    title: 'Instant Musician Match',
    desc: 'Weighted compatibility engine scores every musician on instrument synergy, genre overlap, skill level, and BPM match.',
  },
  {
    icon: Cpu,
    color: 'from-emerald-400 to-teal-500',
    glow: '',
    title: 'AI Practice Coach',
    desc: 'Get personalized chord progressions, pentatonic layouts, and practice routines generated for your key and tempo.',
  },
  {
    icon: Music,
    color: 'from-neonPink to-red-500',
    glow: 'shadow-glow-pink',
    title: 'Synchronized Metronome',
    desc: 'Shared metronome locked to a server epoch timestamp — every musician clicks at the exact same beat, every time.',
  },
  {
    icon: Globe,
    color: 'from-electricBlue to-teal-400',
    glow: 'shadow-glow-blue',
    title: 'Community Hub',
    desc: 'Browse public jam rooms, follow musicians, share practice updates, and build your network of collaborators.',
  },
];

// ─── Stats data ──────────────────────────────────────────────────────────────
const STATS = [
  { value: '< 40ms', label: 'Audio Latency' },
  { value: '4-Way', label: 'Mesh WebRTC' },
  { value: '100%', label: 'Browser Native' },
  { value: '∞', label: 'Jam Sessions' },
];

// ─── Testimonials ────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    name: 'Priya R.',
    role: 'Advanced Guitarist',
    text: 'The metronome sync is insane — I jammed with a drummer in Berlin and we were perfectly locked in. This is the future.',
    rating: 5,
  },
  {
    name: 'Marcus T.',
    role: 'Intermediate Pianist',
    text: 'Uploaded a recording and instantly got my BPM, key signature, and matching recommendations. Incredible tool.',
    rating: 5,
  },
  {
    name: 'Aiko S.',
    role: 'Beginner Vocalist',
    text: 'Found an Advanced Guitarist who matched 94% with me. We\'ve been jamming twice a week ever since.',
    rating: 5,
  },
];

// ─── Main App Component ──────────────────────────────────────────────────────
const App = () => {
  const [activeView, setActiveView] = useState('landing');
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [targetRoomId, setTargetRoomId] = useState('main_studio');

  const [usernameInput, setUsernameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Restore session
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) fetchProfile(savedToken);
  }, []);

  // Socket lifecycle
  useEffect(() => {
    if (user) {
      const s = io(SOCKET_URL);
      setSocket(s);
      return () => s.disconnect();
    }
    setSocket(null);
  }, [user]);

  const fetchProfile = async (token) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUser(await res.json());
        setActiveView('dashboard');
      } else {
        localStorage.removeItem('token');
      }
    } catch {}
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);
    const endpoint = authMode === 'login' ? 'login' : 'register';
    const body =
      authMode === 'login'
        ? { emailOrUsername: emailInput, password: passwordInput }
        : { username: usernameInput, email: emailInput, password: passwordInput };
    try {
      const res = await fetch(`${API_BASE}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setAuthModalOpen(false);
        setActiveView('dashboard');
        setEmailInput(''); setUsernameInput(''); setPasswordInput('');
      } else {
        setAuthError(data.msg || 'Authentication failed');
      }
    } catch {
      setAuthError('Cannot reach server. Ensure backend is running on port 5000.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setAuthError(''); setAuthSuccess('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput }),
      });
      const data = await res.json();
      res.ok ? setAuthSuccess(data.msg) : setAuthError(data.msg);
    } catch { setAuthError('Connection error.'); }
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');

    /* 
      ========================================================================
      STRUCTURAL PLACEHOLDER FOR GOOGLE FIREBASE OR SUPABASE AUTH INTEGRATION
      ========================================================================
      To wire up actual Firebase or Supabase Google Auth:
      
      1. Firebase:
         import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
         const provider = new GoogleAuthProvider();
         const auth = getAuth();
         const result = await signInWithPopup(auth, provider);
         const token = await result.user.getIdToken();
         // Send token to backend /api/auth/google for verification:
         const res = await fetch(`${API_BASE}/api/auth/google`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ idToken: token })
         });
         
      2. Supabase:
         import { createClient } from '@supabase/supabase-js';
         const supabase = createClient('YOUR_SUPABASE_URL', 'YOUR_SUPABASE_ANON_KEY');
         const { data, error } = await supabase.auth.signInWithOAuth({
           provider: 'google',
         });
      ========================================================================
    */

    try {
      const rnd = Math.floor(Math.random() * 9000) + 1000;
      const mockEmail = `google.jammer.${rnd}@harmonybridge.app`;
      const mockUsername = `GoogleJammer_${rnd}`;

      // Simulate a network response latency for standard OAuth handshake
      await new Promise(resolve => setTimeout(resolve, 800));

      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: mockUsername, email: mockEmail, password: 'hb_sso_google_pass_2026' }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setAuthModalOpen(false);
        setActiveView('dashboard');
        setEmailInput(''); setUsernameInput(''); setPasswordInput('');
      } else {
        setAuthError(data.msg || 'Google Authentication registration failed.');
      }
    } catch (err) {
      setAuthError('Connection issue reaching auth verification servers.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setActiveView('landing');
  };

  const handleCTAClick = (target) => {
    if (user) setActiveView(target);
    else { setAuthMode('login'); setAuthModalOpen(true); }
  };

  const openAuth = (mode = 'login') => {
    setAuthMode(mode); setAuthError(''); setAuthSuccess(''); setAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-darkBg text-white flex flex-col overflow-x-hidden relative">
      {/* Ambient fluid micro-orbs background animation (2-3% opacity) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-neonPurple/[0.035] blur-[120px] animate-float-slow" style={{ animationDuration: '25s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-electricBlue/[0.035] blur-[120px] animate-float-slow" style={{ animationDuration: '20s', animationDelay: '-5s' }} />
        <div className="absolute top-[40%] left-[45%] w-[35vw] h-[35vw] rounded-full bg-neonPink/[0.025] blur-[100px] animate-float-slow" style={{ animationDuration: '30s', animationDelay: '-10s' }} />
      </div>

      {/* Floating music particle layer */}
      <ParticleBackground />

      {/* Nav */}
      <Navbar
        activeView={activeView}
        setActiveView={setActiveView}
        user={user}
        onLogout={handleLogout}
        openAuthModal={() => openAuth('login')}
      />

      {/* Page router with AnimatePresence transitions */}
      <main className="flex-1 relative z-10">
        <AnimatePresence mode="wait">
          {activeView === 'landing' && (
            <motion.div key="landing" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <LandingPage onCTA={handleCTAClick} onOpenAuth={openAuth} />
            </motion.div>
          )}
          {activeView === 'dashboard' && (
            <motion.div key="dashboard" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <Dashboard
                user={user}
                onUpdateUser={setUser}
                setActiveView={setActiveView}
                setTargetRoomId={setTargetRoomId}
              />
            </motion.div>
          )}
          {activeView === 'matching' && (
            <motion.div key="matching" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <MusicianMatching
                user={user}
                socket={socket}
                setActiveView={setActiveView}
                setTargetRoomId={setTargetRoomId}
              />
            </motion.div>
          )}
          {activeView === 'jamroom' && (
            <motion.div key="jamroom" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <JamRoom user={user} socket={socket} roomId={targetRoomId} setTargetRoomId={setTargetRoomId} setActiveView={setActiveView} />
            </motion.div>
          )}
          {activeView === 'analyzer' && (
            <motion.div key="analyzer" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <SkillAnalyzer
                user={user}
                onUpdateClips={(clips) => setUser(prev => prev ? { ...prev, uploadedClips: clips } : null)}
              />
            </motion.div>
          )}
          {activeView === 'community' && (
            <motion.div key="community" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <CommunityFeed
                user={user}
                socket={socket}
                setActiveView={setActiveView}
                setTargetRoomId={setTargetRoomId}
              />
            </motion.div>
          )}
          {activeView === 'aicoach' && (
            <motion.div key="aicoach" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <AICoach />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Auth Modal */}
      <AnimatePresence>
        {authModalOpen && (
          <motion.div
            key="auth-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-md p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="w-full max-w-md glass-panel-glow-blue rounded-3xl p-8 border border-white/10 relative shadow-2xl"
            >
              {/* Logo mark */}
              <div className="flex justify-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-neonPurple via-electricBlue to-neonPink flex items-center justify-center shadow-glow-blue">
                  <Music className="w-6 h-6 text-white" />
                </div>
              </div>

              {/* Close */}
              <button
                onClick={() => setAuthModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Title */}
              <div className="text-center mb-6">
                <h2 className="text-2xl font-extrabold text-white">
                  {authMode === 'login' && 'Welcome Back'}
                  {authMode === 'signup' && 'Join HarmonyBridge'}
                  {authMode === 'forgot' && 'Reset Password'}
                </h2>
                <p className="text-white/40 text-xs mt-1">
                  {authMode === 'login' && <>No account? <button onClick={() => openAuth('signup')} className="text-electricBlue hover:underline font-semibold">Sign Up free</button></>}
                  {authMode === 'signup' && <>Already registered? <button onClick={() => openAuth('login')} className="text-electricBlue hover:underline font-semibold">Sign In</button></>}
                  {authMode === 'forgot' && <button onClick={() => openAuth('login')} className="text-electricBlue hover:underline font-semibold">Back to Login</button>}
                </p>
              </div>

              {/* Alerts */}
              {authError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs mb-4">
                  {authError}
                </div>
              )}
              {authSuccess && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-xl text-xs mb-4">
                  {authSuccess}
                </div>
              )}

              {/* Form */}
              {authMode !== 'forgot' ? (
                <form onSubmit={handleAuthSubmit} className="space-y-3">
                  {authMode === 'signup' && (
                    <div className="relative">
                      <User className="w-4 h-4 text-white/30 absolute left-3.5 top-3.5" />
                      <input
                        type="text" placeholder="Username" required
                        value={usernameInput} onChange={e => setUsernameInput(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm"
                      />
                    </div>
                  )}
                  <div className="relative">
                    <Mail className="w-4 h-4 text-white/30 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      placeholder={authMode === 'login' ? 'Email or Username' : 'Email Address'}
                      required value={emailInput} onChange={e => setEmailInput(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-white/30 absolute left-3.5 top-3.5" />
                    <input
                      type="password" placeholder="Password" required
                      value={passwordInput} onChange={e => setPasswordInput(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm"
                    />
                  </div>
                  {authMode === 'login' && (
                    <div className="text-right">
                      <button type="button" onClick={() => openAuth('forgot')}
                        className="text-[11px] text-white/40 hover:text-white/70 transition-colors">
                        Forgot password?
                      </button>
                    </div>
                  )}
                  <button
                    type="submit" disabled={authLoading}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-neonPurple to-electricBlue font-bold text-sm hover:shadow-glow-blue transition-all disabled:opacity-60 mt-1 flex items-center justify-center gap-2"
                  >
                    {authLoading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      authMode === 'login' ? 'Sign In' : 'Create Account'
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <div className="relative">
                    <Mail className="w-4 h-4 text-white/30 absolute left-3.5 top-3.5" />
                    <input type="email" placeholder="Your email address" required
                      value={emailInput} onChange={e => setEmailInput(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm" />
                  </div>
                  <button type="submit"
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-neonPurple to-electricBlue font-bold text-sm hover:shadow-glow-blue transition-all">
                    Send Reset Link
                  </button>
                </form>
              )}

              {/* SSO */}
              {authMode !== 'forgot' && (
                <div className="mt-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-px bg-white/10 flex-1" />
                    <span className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">or</span>
                    <div className="h-px bg-white/10 flex-1" />
                  </div>
                  <button
                    onClick={handleGoogleLogin} disabled={authLoading}
                    className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-white text-xs font-semibold transition-all flex items-center justify-center gap-2.5 disabled:opacity-60"
                  >
                    {authLoading ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Continue with Google (Demo)
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Landing Page Component ──────────────────────────────────────────────────
const LandingPage = ({ onCTA, onOpenAuth }) => {
  return (
    <div className="relative">
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 pt-12 pb-16 md:pt-20 md:pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Text Column */}
        <motion.div
          className="lg:col-span-6 space-y-8"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-neonPurple/20 to-electricBlue/20 border border-electricBlue/25 px-4 py-2 rounded-2xl"
          >
            <Sparkles className="w-3.5 h-3.5 text-electricBlue animate-pulse" />
            <span className="text-[11px] font-bold text-electricBlue uppercase tracking-widest">
              The Future of Live Music Practice
            </span>
          </motion.div>

          {/* Headline */}
          <div className="space-y-3">
            <h1 className="text-5xl md:text-6xl xl:text-7xl font-extrabold tracking-tight leading-[1.05] text-white">
              Jam Together.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-electricBlue via-neonPurple to-neonPink">
                Learn Together.
              </span>
            </h1>
            <p className="text-white/55 text-base md:text-lg leading-relaxed max-w-xl">
              Find compatible musicians, practice live, and perform together in real time with ultra-low latency audio, video, and a synchronized metronome.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onCTA('jamroom')}
              className="flex items-center gap-2 px-7 py-4 rounded-2xl bg-gradient-to-r from-neonPurple to-electricBlue font-extrabold text-sm shadow-glow-blue hover:shadow-[0_0_30px_rgba(0,212,255,0.4)] transition-all"
            >
              <Play className="w-4 h-4 fill-white" />
              Start Jamming
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onCTA('matching')}
              className="flex items-center gap-2 px-7 py-4 rounded-2xl bg-white/6 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white font-extrabold text-sm transition-all"
            >
              <Users className="w-4 h-4" />
              Explore Musicians
              <ChevronRight className="w-3.5 h-3.5 text-white/40" />
            </motion.button>
          </div>

          {/* Live activity ticker */}
          <div className="flex items-center gap-3 pt-4 border-t border-white/5">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </span>
            <p className="text-xs text-white/50">
              <span className="text-white font-semibold">Live now:</span> An Advanced Guitarist and Drummer are jamming in a public studio.
            </p>
          </div>
        </motion.div>

        {/* Visualizer Column */}
        <motion.div
          className="lg:col-span-6 h-[300px] md:h-[420px] relative"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
        >
          {/* Glow halo */}
          <div className="absolute inset-[-20%] bg-gradient-to-br from-neonPurple/10 via-transparent to-electricBlue/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 w-full h-full">
            <WaveformVisualizer isPlaying={true} mode="bars" color="mixed" />
          </div>

          {/* Floating info bubbles */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            className="absolute top-6 -left-4 md:-left-8 glass-panel border border-electricBlue/20 shadow-glow-blue px-4 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-bold z-20"
          >
            <span className="text-base">🎸</span>
            <div>
              <div className="text-white">Lead Guitar</div>
              <div className="text-white/40 text-[10px] font-normal">A Minor • 120 BPM</div>
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut', delay: 1.5 }}
            className="absolute bottom-10 -right-4 md:-right-8 glass-panel border border-neonPurple/20 shadow-glow-purple px-4 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-bold z-20"
          >
            <span className="text-base">🥁</span>
            <div>
              <div className="text-white">Synced Metronome</div>
              <div className="text-white/40 text-[10px] font-normal">All musicians locked in</div>
            </div>
          </motion.div>

          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut', delay: 0.8 }}
            className="absolute top-1/2 -right-2 md:-right-6 glass-panel border border-white/10 px-3 py-2 rounded-xl flex items-center gap-1.5 text-[11px] font-bold z-20"
          >
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white/80">94% Match Found</span>
          </motion.div>
        </motion.div>
      </section>

      {/* ── STATS STRIP ──────────────────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className="text-center"
            >
              <div className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-electricBlue to-neonPurple">{s.value}</div>
              <div className="text-xs text-white/40 mt-1 font-medium uppercase tracking-wider">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FEATURES GRID ────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-20 md:py-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <span className="text-xs font-bold text-neonPurple uppercase tracking-widest bg-neonPurple/10 border border-neonPurple/20 px-4 py-1.5 rounded-full">
            Everything You Need
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white mt-5 leading-tight">
            Built for Serious<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-electricBlue to-neonPurple">Musicians</span>
          </h2>
          <p className="text-white/50 text-sm md:text-base mt-4 max-w-xl mx-auto leading-relaxed">
            Every feature has been crafted to remove friction and help you connect, learn, and perform — all in your browser.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="glass-panel rounded-2xl p-6 border border-white/5 hover:border-white/10 group cursor-default"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5 ${f.glow} group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-base font-bold text-white mb-2 group-hover:text-electricBlue transition-colors">{f.title}</h3>
                <p className="text-xs text-white/55 leading-relaxed">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-white/[0.015]">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <h2 className="text-3xl md:text-4xl font-extrabold text-white">
              Up and Jamming in{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-neonPink to-neonPurple">3 Steps</span>
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: '🎵', title: 'Create Your Profile', desc: 'Set your instruments, genre preferences, and skill level. Upload a practice clip so the matching engine can score your BPM and key.' },
              { step: '02', icon: '🤝', title: 'Discover & Match', desc: 'Browse musicians ranked by compatibility score. Follow, message, or instantly invite your top match to a live jam room.' },
              { step: '03', icon: '🚀', title: 'Jam in Real-Time', desc: 'Enter a WebRTC studio room. Enable the synchronized metronome, chat, take notes, and record your session — all in the browser.' },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.45 }}
                className="relative"
              >
                {i < 2 && (
                  <div className="hidden md:block absolute top-8 left-[calc(100%+0px)] w-full h-px border-t border-dashed border-white/10 z-10" style={{ width: '40px', left: 'calc(100% - 20px)' }} />
                )}
                <div className="glass-panel rounded-2xl p-6 border border-white/5 h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{s.icon}</span>
                    <span className="text-[11px] font-black text-white/20 tracking-widest uppercase">{s.step}</span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{s.title}</h3>
                  <p className="text-xs text-white/50 leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-20 md:py-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-4xl font-extrabold text-white">
            Loved by Musicians
          </h2>
          <p className="text-white/40 text-sm mt-3">Real stories from the HarmonyBridge community</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
              className="glass-panel rounded-2xl p-6 border border-white/5 flex flex-col justify-between gap-5"
            >
              <div>
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, si) => (
                    <Star key={si} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-white/75 leading-relaxed italic">"{t.text}"</p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-neonPurple to-electricBlue flex items-center justify-center font-bold text-white text-sm uppercase">
                  {t.name[0]}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{t.name}</div>
                  <div className="text-[10px] text-white/40">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative rounded-3xl overflow-hidden border border-white/10 p-10 md:p-16 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(11,11,15,0.8) 50%, rgba(0,212,255,0.12) 100%)' }}
        >
          {/* decorative glows inside banner */}
          <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-neonPurple/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 w-48 h-48 rounded-full bg-electricBlue/20 blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <Headphones className="w-14 h-14 text-white/20 mx-auto mb-6" />
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4 leading-tight">
              Ready to Find Your<br />Perfect Jam Partner?
            </h2>
            <p className="text-white/50 text-sm md:text-base max-w-lg mx-auto mb-8">
              Join thousands of musicians already practicing and performing together on HarmonyBridge — completely free.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onOpenAuth('signup')}
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-neonPurple to-electricBlue font-extrabold text-base shadow-glow-blue hover:shadow-[0_0_40px_rgba(0,212,255,0.5)] transition-all"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/30">
          <div className="flex items-center gap-2 font-bold text-white/60">
            <Music className="w-4 h-4 text-electricBlue" />
            HarmonyBridge
          </div>
          <p>Built with WebRTC · Socket.io · React · Node.js · MongoDB</p>
          <p>© 2026 HarmonyBridge. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
