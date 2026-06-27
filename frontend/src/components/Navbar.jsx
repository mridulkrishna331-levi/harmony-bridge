import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music, LayoutDashboard, Users, Radio, Cpu,
  BarChart2, Share2, LogOut, LogIn, Menu, X
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard',  name: 'Dashboard',    icon: LayoutDashboard },
  { id: 'matching',   name: 'Match Finder', icon: Users           },
  { id: 'jamroom',    name: 'Jam Studio',   icon: Radio           },
  { id: 'analyzer',   name: 'Analyzer',     icon: BarChart2       },
  { id: 'community',  name: 'Community',    icon: Share2          },
  { id: 'aicoach',    name: 'AI Coach',     icon: Cpu             },
];

const AVAILABILITY_COLORS = {
  Available: 'bg-green-500',
  Jamming:   'bg-neonPurple shadow-glow-purple animate-pulse',
  Offline:   'bg-white/25',
};

const Navbar = ({ activeView, setActiveView, user, onLogout, openAuthModal }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navigate = (id) => {
    setActiveView(id);
    setMobileOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 w-full glass-panel border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

        {/* ── Logo ──────────────────────────────────────────────────────── */}
        <button
          onClick={() => navigate('landing')}
          className="flex items-center gap-2.5 shrink-0 group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-neonPurple via-electricBlue to-neonPink flex items-center justify-center shadow-glow-blue group-hover:scale-105 transition-transform">
            <Music className="w-4 h-4 text-white" />
          </div>
          <div className="leading-none">
            <span className="text-lg font-extrabold tracking-tight text-white">
              Harmony<span className="text-electricBlue">Bridge</span>
            </span>
            <span className="text-[9px] text-white/30 uppercase tracking-[0.2em] font-semibold block">
              Virtual Studio
            </span>
          </div>
        </button>

        {/* ── Desktop Nav Pills ──────────────────────────────────────────── */}
        {user && (
          <div className="hidden lg:flex items-center gap-1 bg-white/[0.04] border border-white/5 rounded-2xl p-1">
            {NAV_ITEMS.map(({ id, name, icon: Icon }) => {
              const active = activeView === id;
              return (
                <button
                  key={id}
                  onClick={() => navigate(id)}
                  className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-colors duration-200 ${
                    active ? 'text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-neonPurple/25 to-electricBlue/25 border border-electricBlue/20"
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    />
                  )}
                  <Icon className={`w-3.5 h-3.5 relative z-10 ${active ? 'text-electricBlue' : ''}`} />
                  <span className="relative z-10">{name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Right controls ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Availability + Username (desktop only) */}
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-[12px] font-bold text-white leading-tight">{user.username ?? '...'}</span>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${AVAILABILITY_COLORS[user.availability] ?? 'bg-white/20'}`} />
                  <span className="text-[10px] text-white/40">{user.availability}</span>
                </div>
              </div>

              {/* Avatar */}
              <button
                onClick={() => navigate('dashboard')}
                className="w-9 h-9 rounded-xl overflow-hidden bg-gradient-to-br from-neonPurple to-electricBlue flex items-center justify-center font-bold text-white uppercase text-sm border border-white/10 hover:opacity-90 transition-opacity p-0"
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  (user.username ?? 'HB').slice(0, 2)
                )}
              </button>

              {/* Logout (desktop) */}
              <button
                onClick={onLogout}
                className="hidden sm:flex p-2 rounded-xl bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-400 border border-white/5 hover:border-red-500/20 transition-all"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={openAuthModal}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-neonPurple to-electricBlue font-bold text-sm hover:shadow-glow-blue transition-all"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
          )}

          {/* Mobile hamburger (only shown when logged in) */}
          {user && (
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="lg:hidden p-2 rounded-xl bg-white/5 border border-white/5 text-white/60 hover:text-white transition-all"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* ── Mobile Dropdown ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && user && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="lg:hidden overflow-hidden border-t border-white/5 bg-darkBg/95 backdrop-blur-xl"
          >
            <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-2 gap-2">
              {NAV_ITEMS.map(({ id, name, icon: Icon }) => {
                const active = activeView === id;
                return (
                  <button
                    key={id}
                    onClick={() => navigate(id)}
                    className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                      active
                        ? 'bg-gradient-to-r from-neonPurple/20 to-electricBlue/20 border border-electricBlue/20 text-white'
                        : 'bg-white/5 border border-white/5 text-white/60 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-electricBlue' : 'text-white/40'}`} />
                    {name}
                  </button>
                );
              })}

              {/* Logout inside mobile menu */}
              <button
                onClick={() => { onLogout(); setMobileOpen(false); }}
                className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold mt-1"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
