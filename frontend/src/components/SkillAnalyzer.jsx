import React, { useState } from 'react';
import { Upload, FileAudio, AlertCircle, Sparkles, BarChart2, Compass, Play, X } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://harmony-bridge.onrender.com';

const SkillAnalyzer = ({ user, onUpdateClips }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 4000);
  };

  const allowedExtensions = ['.wav', '.mp3', '.ogg', '.m4a', '.webm', '.aac'];

  const validateAudioFile = (audioFile) => {
    if (!audioFile) return false;
    const name = audioFile.name.toLowerCase();
    const hasValidExt = allowedExtensions.some(ext => name.endsWith(ext));
    const hasValidMime = audioFile.type && audioFile.type.startsWith('audio/');
    return hasValidExt || hasValidMime;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (validateAudioFile(droppedFile)) {
      setFile(droppedFile);
      setError('');
    } else {
      triggerToast('Invalid file extension. Please select an audio file (.mp3, .wav, .ogg, .m4a, .webm, .aac)');
      setError('Only valid audio formats are allowed.');
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (validateAudioFile(selectedFile)) {
      setFile(selectedFile);
      setError('');
    } else {
      triggerToast('Invalid file format. Rejecting non-audio inputs.');
      setError('Only audio files can be analyzed.');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(10);
    setError('');

    const formData = new FormData();
    formData.append('audio', file);

    try {
      const token = localStorage.getItem('token');
      
      // Simulate progress update
      const progressTimer = setInterval(() => {
        setUploadProgress((prev) => (prev < 85 ? prev + 15 : prev));
      }, 300);

      const res = await fetch(`${API_BASE}/api/analysis/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      clearInterval(progressTimer);
      setUploadProgress(100);

      if (res.ok) {
        const data = await res.json();
        setAnalysisResult(data.analysis);
        if (onUpdateClips) {
          onUpdateClips(data.uploadedClips);
        }
      } else {
        const errData = await res.json();
        setError(errData.msg || 'Upload and analysis failed.');
      }
    } catch (err) {
      console.error(err);
      setError('Could not establish link with backend processing node.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 bg-red-500 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-glow-pink border border-red-400 animate-pulse">
          <AlertCircle className="w-4 h-4" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="ml-2 hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-electricBlue">
          Skill & Audio Analyzer
        </h2>
        <p className="text-white/60 text-sm mt-1">
          Upload an audio snippet of your instrument performance. Our signal processor extracts BPM, scale key, and rhythm stability.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel rounded-2xl p-6 border border-white/5">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-electricBlue" />
              Upload Clip
            </h3>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                file 
                  ? 'border-electricBlue bg-electricBlue/5' 
                  : 'border-white/10 hover:border-neonPurple/40 bg-white/5'
              }`}
            >
              <input
                type="file"
                id="audio-file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="audio-file" className="cursor-pointer block">
                <FileAudio className={`w-12 h-12 mx-auto mb-4 ${file ? 'text-electricBlue animate-pulse' : 'text-white/20'}`} />
                {file ? (
                  <div>
                    <p className="text-sm font-semibold text-white truncate max-w-xs mx-auto">{file.name}</p>
                    <p className="text-xs text-white/40 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-white">Drag & drop your recording</p>
                    <p className="text-xs text-white/40 mt-1">or click to browse local files</p>
                    <p className="text-[10px] text-white/30 mt-3 font-medium">Supports WAV, MP3, OGG (Max 10MB)</p>
                  </div>
                )}
              </label>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {file && !uploading && !analysisResult && (
              <button
                onClick={handleUpload}
                className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-neonPurple to-electricBlue font-bold text-sm hover:shadow-glow-blue transition-all"
              >
                Analyze Performance
              </button>
            )}

            {uploading && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/50">Processing signals...</span>
                  <span className="text-electricBlue font-semibold">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-neonPurple to-electricBlue h-full rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Quick tips */}
          <div className="glass-panel rounded-2xl p-6 border border-white/5">
            <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Guidelines for Best Results
            </h4>
            <ul className="text-xs text-white/50 space-y-2 list-disc list-inside">
              <li>Record in a quiet environment to isolate your instrument.</li>
              <li>Keep clips between 10 to 30 seconds.</li>
              <li>Maintain a steady beat/tempo during recording.</li>
              <li>Avoid clipping or excessive microphone distortion.</li>
            </ul>
          </div>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-2 space-y-6">
          {analysisResult ? (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="glass-panel rounded-2xl p-5 border border-white/5 flex flex-col justify-center">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold block mb-1">Detected BPM</span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-electricBlue text-glow-blue">{analysisResult.bpm}</span>
                  <span className="text-[10px] text-white/40 mt-1">Tempo Rhythm</span>
                </div>

                <div className="glass-panel rounded-2xl p-5 border border-white/5 flex flex-col justify-center">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold block mb-1">Scale/Key</span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-neonPurple text-glow-purple">{analysisResult.key}</span>
                  <span className="text-[10px] text-white/40 mt-1">Pitch Signature</span>
                </div>

                <div className="glass-panel rounded-2xl p-5 border border-white/5 flex flex-col justify-center">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold block mb-1">Duration</span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-white">{analysisResult.duration}s</span>
                  <span className="text-[10px] text-white/40 mt-1">Clip Duration</span>
                </div>
              </div>

              {/* Librosa Extraction Metrics */}
              <div className="glass-panel rounded-2xl p-6 border border-white/5 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-electricBlue" />
                  Librosa Signal Extraction Metrics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Pitch Detection */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-white/50">Exact Pitch Confidence</span>
                      <span className="text-white font-mono">{analysisResult.pitch_detection ?? 0}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className="h-full bg-gradient-to-r from-neonPurple to-electricBlue rounded-full transition-all duration-500" 
                        style={{ width: `${analysisResult.pitch_detection ?? 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Rhythm Stability */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-white/50">Rhythm Stability</span>
                      <span className="text-white font-mono">{analysisResult.rhythm_stability ?? 0}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className="h-full bg-gradient-to-r from-electricBlue to-neonPink rounded-full transition-all duration-500" 
                        style={{ width: `${analysisResult.rhythm_stability ?? 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Transient Detection */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-white/50">Transient Accuracy</span>
                      <span className="text-white font-mono">{analysisResult.transient_detection ?? 0}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                      <div 
                        className="h-full bg-gradient-to-r from-neonPink to-neonPurple rounded-full transition-all duration-500" 
                        style={{ width: `${analysisResult.transient_detection ?? 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tempo chart */}
              <div className="glass-panel rounded-2xl p-6 border border-white/5">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-neonPurple" />
                  Rhythm Stability & Spectral Profile
                </h3>

                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={analysisResult.timeline}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#00D4FF" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorBpm" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" fontSize={11} unit="s" />
                      <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#12121A', 
                          borderColor: 'rgba(255,255,255,0.1)',
                          borderRadius: '12px',
                          color: '#fff'
                        }} 
                      />
                      <Area type="monotone" dataKey="energy" name="Amplitude Energy %" stroke="#00D4FF" fillOpacity={1} fill="url(#colorEnergy)" strokeWidth={2} />
                      <Area type="monotone" dataKey="bpm" name="BPM Variance" stroke="#8B5CF6" fillOpacity={1} fill="url(#colorBpm)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Skill Insights */}
              <div className="glass-panel rounded-2xl p-6 border border-white/5">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Compass className="w-5 h-5 text-neonPink" />
                  AI Skill Insights
                </h3>
                <div className="space-y-3">
                  {analysisResult.insights.map((insight, idx) => (
                    <div key={idx} className="flex gap-3 bg-white/5 p-3 rounded-xl border border-white/5 text-xs text-white/70 leading-relaxed">
                      <span className="w-5 h-5 rounded-full bg-electricBlue/10 text-electricBlue flex items-center justify-center shrink-0 font-bold">
                        {idx + 1}
                      </span>
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[350px] rounded-2xl border border-dashed border-white/10 bg-white/5 flex flex-col items-center justify-center text-center p-8">
              <FileAudio className="w-16 h-16 text-white/15 mb-4 animate-float" />
              <h3 className="text-lg font-bold text-white/70">Analysis results will appear here</h3>
              <p className="text-white/40 text-xs mt-1 max-w-sm">
                Record and upload your latest practice session to generate tempo models, scale definitions, and compatibility ratings.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SkillAnalyzer;
