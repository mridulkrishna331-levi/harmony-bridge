import React, { useEffect, useRef } from 'react';

const ParticleBackground = () => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Musical note symbols
    const noteSymbols = ['♩', '♪', '♫', '♬', '𝄞', '𝄢'];

    // Particles array
    const particles = Array.from({ length: 45 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.4 - 0.15,
      size: Math.random() * 12 + 6,
      opacity: Math.random() * 0.08 + 0.02, // Soft, non-intrusive notes for light cream theme
      symbol: noteSymbols[Math.floor(Math.random() * noteSymbols.length)],
      color: Math.random() > 0.5 ? '#00A3E0' : '#7C3AED',
      wiggle: Math.random() * Math.PI * 2,
      wiggleSpeed: (Math.random() - 0.5) * 0.02,
    }));

    // Connections (floating orbs)
    const orbs = Array.from({ length: 4 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 150 + 60,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      color: Math.random() > 0.5 ? 'rgba(0,163,224,' : 'rgba(124,58,237,',
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw soft glow orbs
      orbs.forEach(orb => {
        orb.x += orb.vx;
        orb.y += orb.vy;
        if (orb.x < -orb.r) orb.x = canvas.width + orb.r;
        if (orb.x > canvas.width + orb.r) orb.x = -orb.r;
        if (orb.y < -orb.r) orb.y = canvas.height + orb.r;
        if (orb.y > canvas.height + orb.r) orb.y = -orb.r;

        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
        grad.addColorStop(0, orb.color + '0.015)'); // Ultra-low opacity canvas orbs
        grad.addColorStop(1, orb.color + '0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw musical note particles
      particles.forEach(p => {
        p.wiggle += p.wiggleSpeed;
        p.x += p.vx + Math.sin(p.wiggle) * 0.3;
        p.y += p.vy;

        // Wrap around edges
        if (p.y < -30) { p.y = canvas.height + 30; p.x = Math.random() * canvas.width; }
        if (p.x < -30) p.x = canvas.width + 30;
        if (p.x > canvas.width + 30) p.x = -30;

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.font = `${p.size}px serif`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.fillText(p.symbol, p.x, p.y);
        ctx.restore();
      });

      animRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      style={{ opacity: 1 }}
    />
  );
};

export default ParticleBackground;
