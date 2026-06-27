import React, { useEffect, useRef } from 'react';

const WaveformVisualizer = ({ stream, isPlaying = true, mode = 'bars', color = 'mixed' }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle resize
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Setup Web Audio API if stream is provided
    if (stream) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        const analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(stream);
        
        source.connect(analyser);
        analyser.fftSize = 256;
        
        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;
        sourceRef.current = source;
      } catch (err) {
        console.error('Web Audio API setup failed:', err);
      }
    }

    const bufferLength = analyserRef.current ? analyserRef.current.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);
    let simOffset = 0;

    const render = () => {
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;
      
      // Clear canvas with a very subtle fade for tail effects (cream background tint instead of dark charcoal)
      ctx.fillStyle = 'rgba(253, 251, 247, 0.15)';
      ctx.fillRect(0, 0, width, height);

      if (analyserRef.current && stream) {
        // Real stream visualization
        analyserRef.current.getByteFrequencyData(dataArray);
      } else {
        // Simulated visualization for preview mode
        simOffset += 0.05;
        for (let i = 0; i < bufferLength; i++) {
          if (isPlaying) {
            // Composite sinewaves with some noise
            const wave1 = Math.sin(i * 0.15 + simOffset) * 0.4;
            const wave2 = Math.cos(i * 0.08 - simOffset * 1.5) * 0.3;
            const noise = (Math.random() - 0.5) * 0.05;
            dataArray[i] = Math.floor((wave1 + wave2 + noise + 0.7) * 128);
          } else {
            dataArray[i] = 10; // Flat line when paused
          }
        }
      }

      if (mode === 'bars') {
        const barWidth = (width / bufferLength) * 1.6;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const percent = dataArray[i] / 255;
          const barHeight = percent * height * 0.85;

          // Gradient selection
          let grad = ctx.createLinearGradient(0, height, 0, height - barHeight);
          if (color === 'blue') {
            grad.addColorStop(0, 'rgba(0, 163, 224, 0.1)');
            grad.addColorStop(1, 'rgba(0, 163, 224, 0.85)');
          } else if (color === 'purple') {
            grad.addColorStop(0, 'rgba(124, 58, 237, 0.1)');
            grad.addColorStop(1, 'rgba(124, 58, 237, 0.85)');
          } else {
            // Mixed Electric Blue to Neon Purple
            grad.addColorStop(0, 'rgba(124, 58, 237, 0.2)');
            grad.addColorStop(0.5, 'rgba(0, 163, 224, 0.6)');
            grad.addColorStop(1, 'rgba(219, 39, 119, 0.9)');
          }

          ctx.fillStyle = grad;
          
          // Draw rounded bars
          ctx.beginPath();
          ctx.roundRect(x, height - barHeight, barWidth - 2, barHeight, [4, 4, 0, 0]);
          ctx.fill();

          x += barWidth;
        }
      } else if (mode === 'wave') {
        // Draw connected waveform
        ctx.beginPath();
        ctx.lineWidth = 3;
        
        let grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, '#7C3AED'); // Premium Purple
        grad.addColorStop(0.5, '#00A3E0'); // Premium Blue
        grad.addColorStop(1, '#DB2777'); // Premium Pink
        ctx.strokeStyle = grad;

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const percent = dataArray[i] / 255;
          // Center the wave
          const y = (height / 2) + (percent - 0.5) * height * 0.6;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();

        // Draw glowing particles along the line
        for (let i = 0; i < bufferLength; i += 8) {
          const percent = dataArray[i] / 255;
          const y = (height / 2) + (percent - 0.5) * height * 0.6;
          const px = i * sliceWidth;

          ctx.beginPath();
          ctx.arc(px, y, 3, 0, 2 * Math.PI);
          ctx.fillStyle = '#1E1B18'; // Dark charcoal dot accents
          ctx.shadowBlur = 8;
          ctx.shadowColor = '#00A3E0';
          ctx.fill();
          ctx.shadowBlur = 0; // reset
        }
      } else if (mode === 'circular') {
        // Draw circular radar wave
        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = Math.min(centerX, centerY) * 0.45;

        // Draw inner circle pulse
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(0, 163, 224, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        
        let grad = ctx.createRadialGradient(centerX, centerY, baseRadius, centerX, centerY, baseRadius * 1.5);
        grad.addColorStop(0, 'rgba(124, 58, 237, 0.8)');
        grad.addColorStop(1, 'rgba(0, 163, 224, 0.1)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.5;

        for (let i = 0; i < bufferLength; i++) {
          const angle = (i / bufferLength) * Math.PI * 2;
          const percent = dataArray[i] / 255;
          const r = baseRadius + percent * baseRadius * 0.6;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resizeCanvas);
      
      // Clean up Audio Context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stream, isPlaying, mode, color]);

  return (
    <div className="w-full h-full relative overflow-hidden rounded-xl bg-darkBg border border-white/5">
      <canvas ref={canvasRef} className="w-full h-full block" />
      {/* Visual Overlay Glows */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-darkBg/60 via-transparent to-transparent"></div>
    </div>
  );
};

export default WaveformVisualizer;
