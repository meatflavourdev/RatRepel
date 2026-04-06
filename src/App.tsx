/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, Square, Radio, Zap, ShieldCheck, Info, Volume2, VolumeX, 
  FastForward, Target, Activity, Sparkles, Waves, 
  Bug, Skull, Wind, AlertTriangle, Fingerprint
} from 'lucide-react';

interface RodentPreset {
  id: string;
  name: string;
  min: number;
  max: number;
  speed: number;
  icon: ReactNode;
  description: string;
  profile: string;
  threatLevel: 'Low' | 'Medium' | 'High' | 'Extreme';
}

const PRESETS: RodentPreset[] = [
  { 
    id: 'rats',
    name: 'Norway Rats', 
    min: 18000, 
    max: 20000, 
    speed: 200, 
    icon: <Skull className="w-4 h-4" />,
    description: 'Optimized for large, aggressive rodents.',
    profile: 'Norway rats are highly sensitive to 18-20kHz. This range causes intense auditory stress, disrupting their nesting and feeding patterns.',
    threatLevel: 'High'
  },
  { 
    id: 'mice',
    name: 'House Mice', 
    min: 17000, 
    max: 19000, 
    speed: 150, 
    icon: <Bug className="w-4 h-4" />,
    description: 'Standard range for common indoor pests.',
    profile: 'Mice communicate using ultrasonic vocalizations. This sweep interferes with their social signals, making the area feel unsafe.',
    threatLevel: 'Medium'
  },
  { 
    id: 'squirrels',
    name: 'Squirrels', 
    min: 15000, 
    max: 18000, 
    speed: 100, 
    icon: <Wind className="w-4 h-4" />,
    description: 'Lower ultrasonic range for outdoor pests.',
    profile: 'Larger rodents like squirrels have lower frequency sensitivity. 15-18kHz is the "sweet spot" for deterring them from attics and eaves.',
    threatLevel: 'Medium'
  },
  { 
    id: 'chaos',
    name: 'Bio-Disruptor', 
    min: 15000, 
    max: 20000, 
    speed: 400, 
    icon: <Sparkles className="w-4 h-4" />,
    description: 'Maximum spectrum wide-band sweep.',
    profile: 'A brutal, high-speed sweep across the safe ultrasonic spectrum. Designed to prevent any adaptation or habituation.',
    threatLevel: 'Extreme'
  },
];

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [frequency, setFrequency] = useState(20000);
  const [isSweep, setIsSweep] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.15);
  const [oscType, setOscType] = useState<OscillatorType>('sine');
  
  // Sweep Configuration
  const [sweepMin, setSweepMin] = useState(18000);
  const [sweepMax, setSweepMax] = useState(22000);
  const [sweepSpeed, setSweepSpeed] = useState(150); 
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const lpfNodeRef = useRef<BiquadFilterNode | null>(null);
  const hpfNodeRef = useRef<BiquadFilterNode | null>(null);
  const compressorNodeRef = useRef<DynamicsCompressorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sweepIntervalRef = useRef<number | null>(null);
  const sweepFrameRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentSweepFreqRef = useRef<number>(20000);
  const lastUpdateRef = useRef<number>(0);
  const sweepDirectionRef = useRef<number>(1);

  const applyPreset = (preset: RodentPreset) => {
    setSweepMin(preset.min);
    setSweepMax(preset.max);
    setSweepSpeed(preset.speed);
    setSelectedPresetId(preset.id);
    if (!isSweep) setFrequency(preset.min);
  };

  const startSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const osc = audioContextRef.current.createOscillator();
    const gain = audioContextRef.current.createGain();
    const lpf = audioContextRef.current.createBiquadFilter();
    const hpf = audioContextRef.current.createBiquadFilter();
    const compressor = audioContextRef.current.createDynamicsCompressor();
    const analyser = audioContextRef.current.createAnalyser();

    // High-pass filter to remove any audible sub-harmonics or clicks (below 15kHz)
    hpf.type = 'highpass';
    hpf.frequency.setValueAtTime(15000, audioContextRef.current.currentTime);
    hpf.Q.setValueAtTime(0.7, audioContextRef.current.currentTime);

    // Low-pass filter to remove aliasing (above 19kHz)
    lpf.type = 'lowpass';
    lpf.frequency.setValueAtTime(19000, audioContextRef.current.currentTime);
    lpf.Q.setValueAtTime(0.5, audioContextRef.current.currentTime);

    // Compressor to prevent clipping
    compressor.threshold.setValueAtTime(-15, audioContextRef.current.currentTime);
    compressor.knee.setValueAtTime(30, audioContextRef.current.currentTime);
    compressor.ratio.setValueAtTime(12, audioContextRef.current.currentTime);
    compressor.attack.setValueAtTime(0.003, audioContextRef.current.currentTime);
    compressor.release.setValueAtTime(0.25, audioContextRef.current.currentTime);

    analyser.fftSize = 2048;
    osc.type = oscType;
    const startFreq = isSweep ? sweepMin : frequency;
    osc.frequency.setValueAtTime(startFreq, audioContextRef.current.currentTime);
    currentSweepFreqRef.current = startFreq;
    
    gain.gain.setValueAtTime(0, audioContextRef.current.currentTime);
    gain.gain.linearRampToValueAtTime(volume, audioContextRef.current.currentTime + 0.1);

    osc.connect(hpf);
    hpf.connect(lpf);
    lpf.connect(compressor);
    compressor.connect(gain);
    gain.connect(analyser);
    analyser.connect(audioContextRef.current.destination);

    osc.start();
    
    oscillatorRef.current = osc;
    gainNodeRef.current = gain;
    lpfNodeRef.current = lpf;
    hpfNodeRef.current = hpf;
    compressorNodeRef.current = compressor;
    analyserRef.current = analyser;
    setIsPlaying(true);
    drawWaveform();
  };

  const changeOscType = (type: OscillatorType) => {
    if (isPlaying && gainNodeRef.current && audioContextRef.current && oscillatorRef.current) {
      const now = audioContextRef.current.currentTime;
      const currentVol = volume;
      // Smoothly ramp down, change type, then ramp back up to avoid clicks
      gainNodeRef.current.gain.cancelScheduledValues(now);
      gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, now);
      gainNodeRef.current.gain.linearRampToValueAtTime(0, now + 0.05);
      
      setTimeout(() => {
        if (oscillatorRef.current && audioContextRef.current) {
          oscillatorRef.current.type = type;
          gainNodeRef.current?.gain.linearRampToValueAtTime(currentVol, audioContextRef.current.currentTime + 0.05);
        }
      }, 60);
    }
    setOscType(type);
  };

  const drawWaveform = () => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyserRef.current?.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = isSweep ? '#3b82f6' : '#10b981';
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    render();
  };

  const stopSound = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (sweepFrameRef.current) {
      cancelAnimationFrame(sweepFrameRef.current);
    }
    if (oscillatorRef.current && gainNodeRef.current && audioContextRef.current) {
      const now = audioContextRef.current.currentTime;
      gainNodeRef.current.gain.cancelScheduledValues(now);
      gainNodeRef.current.gain.setValueAtTime(gainNodeRef.current.gain.value, now);
      gainNodeRef.current.gain.linearRampToValueAtTime(0, now + 0.1);
      
      setTimeout(() => {
        oscillatorRef.current?.stop();
        oscillatorRef.current?.disconnect();
        gainNodeRef.current?.disconnect();
        oscillatorRef.current = null;
        gainNodeRef.current = null;
      }, 150);
    }
    setIsPlaying(false);
    if (sweepIntervalRef.current) {
      window.clearInterval(sweepIntervalRef.current);
      sweepIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (isPlaying && gainNodeRef.current && audioContextRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(volume, audioContextRef.current.currentTime, 0.05);
    }
  }, [volume, isPlaying]);

  useEffect(() => {
    if (isPlaying && oscillatorRef.current) {
      oscillatorRef.current.type = oscType;
    }
  }, [oscType, isPlaying]);

  useEffect(() => {
    if (isPlaying && oscillatorRef.current && audioContextRef.current && !isSweep) {
      oscillatorRef.current.frequency.setTargetAtTime(frequency, audioContextRef.current.currentTime, 0.05);
    }
  }, [frequency, isPlaying, isSweep]);

  useEffect(() => {
    if (isPlaying && isSweep) {
      // Use a slower interval for scheduling ramps (more efficient than RAF for audio)
      sweepIntervalRef.current = window.setInterval(() => {
        if (oscillatorRef.current && audioContextRef.current) {
          const now = audioContextRef.current.currentTime;
          const interval = 0.1; // 100ms ramp
          
          // Calculate frequency change for the next 100ms
          const hzPerSecond = sweepSpeed * 20;
          const deltaFreq = hzPerSecond * interval * sweepDirectionRef.current;
          
          currentSweepFreqRef.current += deltaFreq;
          
          if (currentSweepFreqRef.current >= sweepMax) {
            currentSweepFreqRef.current = sweepMax;
            sweepDirectionRef.current = -1;
          }
          if (currentSweepFreqRef.current <= sweepMin) {
            currentSweepFreqRef.current = sweepMin;
            sweepDirectionRef.current = 1;
          }
          
          // Schedule a smooth linear ramp for the next interval
          oscillatorRef.current.frequency.cancelScheduledValues(now);
          oscillatorRef.current.frequency.setValueAtTime(oscillatorRef.current.frequency.value, now);
          oscillatorRef.current.frequency.linearRampToValueAtTime(currentSweepFreqRef.current, now + interval);
          setFrequency(currentSweepFreqRef.current);
        }
      }, 100);
    } else {
      if (sweepIntervalRef.current) {
        window.clearInterval(sweepIntervalRef.current);
        sweepIntervalRef.current = null;
      }
    }

    return () => {
      if (sweepIntervalRef.current) window.clearInterval(sweepIntervalRef.current);
    };
  }, [isSweep, isPlaying, sweepMin, sweepMax, sweepSpeed]);

  const selectedPreset = PRESETS.find(p => p.id === selectedPresetId);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 flex flex-col items-center justify-center p-4 sm:p-6 overflow-x-hidden">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-emerald-500/10 blur-[140px] rounded-full" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] bg-blue-500/10 blur-[140px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl z-10"
      >
        <header className="text-center mb-6">
          <motion.div 
            animate={isPlaying ? { 
              scale: [1, 1.1, 1],
              rotate: isSweep ? [0, 5, -5, 0] : 0
            } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 mb-4 shadow-xl shadow-emerald-500/10"
          >
            <Radio className={`w-8 h-8 ${isPlaying ? 'text-emerald-400' : 'text-zinc-600'}`} />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">RatRepel Ultra</h1>
          <div className="flex items-center justify-center gap-2 text-zinc-500 text-[10px] font-mono uppercase tracking-[0.3em]">
            <ShieldCheck className="w-3 h-3 text-emerald-500/50" />
            <span>Bio-Acoustic Defense System</span>
          </div>
        </header>

        <main className="bg-zinc-900/40 backdrop-blur-3xl border border-zinc-800/50 rounded-[3rem] p-6 sm:p-8 shadow-2xl overflow-hidden relative">
          {/* Enhanced Visualizer Area */}
          <div className="h-32 mb-8 flex items-center justify-center relative overflow-hidden rounded-3xl bg-zinc-950/50 border border-zinc-800/30">
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/5 to-transparent pointer-events-none" />
            
            <canvas 
              ref={canvasRef}
              width={400}
              height={128}
              className="absolute inset-0 w-full h-full opacity-40 pointer-events-none"
            />

            <AnimatePresence mode="wait">
              {isPlaying ? (
                <motion.div 
                  key="playing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-end gap-1.5 h-20"
                >
                  {[...Array(24)].map((_, i) => {
                    const delay = i * 0.04;
                    const freqFactor = (frequency - 15000) / 10000;
                    return (
                      <motion.div
                        key={i}
                        animate={{ 
                          height: isSweep 
                            ? [10 + (i % 5) * 10, 60 + (i % 3) * 20, 10 + (i % 5) * 10] 
                            : [20 + Math.sin(i) * 10, 40 + Math.cos(i) * 10, 20 + Math.sin(i) * 10],
                          opacity: [0.4, 1, 0.4],
                          backgroundColor: isSweep 
                            ? ['#3b82f6', '#10b981', '#3b82f6'] 
                            : ['#10b981', '#059669', '#10b981']
                        }}
                        transition={{ 
                          repeat: Infinity, 
                          duration: (isSweep ? 0.3 : 0.6) - (freqFactor * 0.2),
                          delay,
                          ease: "easeInOut"
                        }}
                        className="w-1.5 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                      />
                    );
                  })}
                </motion.div>
              ) : (
                <motion.div 
                  key="stopped"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-zinc-800 flex flex-col items-center gap-3"
                >
                  <div className="relative">
                    <VolumeX className="w-8 h-8 opacity-20" />
                    <motion.div 
                      animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.3, 0.1] }}
                      transition={{ repeat: Infinity, duration: 3 }}
                      className="absolute inset-0 bg-zinc-500 rounded-full blur-xl"
                    />
                  </div>
                  <span className="text-[10px] font-mono tracking-[0.5em] uppercase opacity-30">Standby Mode</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Frequency Ring Overlay */}
            {isPlaying && (
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                className="absolute w-64 h-64 border border-emerald-500/10 rounded-full pointer-events-none"
              />
            )}
          </div>

          {/* Main Frequency Display */}
          <div className="text-center mb-8 relative">
            <div className="inline-flex flex-col items-center px-8 py-4 rounded-[2rem] bg-zinc-950/60 border border-zinc-800/50 shadow-2xl">
              <div className="flex items-baseline gap-2">
                <motion.span 
                  key={Math.round(frequency)}
                  initial={{ opacity: 0.8 }}
                  animate={{ opacity: 1 }}
                  className="text-5xl font-mono font-black text-emerald-400 tabular-nums tracking-tighter drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]"
                >
                  {Math.round(frequency).toLocaleString()}
                </motion.span>
                <span className="text-sm font-mono text-zinc-600 font-bold uppercase">Hz</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-700'}`} />
                <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">
                  {isSweep ? 'Sweep Active' : 'Static Signal'}
                </span>
              </div>
            </div>
          </div>

          {/* Controls Section */}
          <div className="space-y-6">
            {/* Mode Toggle */}
            <div className="grid grid-cols-2 gap-3 p-1.5 bg-zinc-950/50 border border-zinc-800/50 rounded-2xl">
              <button
                onClick={() => setIsSweep(false)}
                className={`py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                  !isSweep 
                    ? 'bg-zinc-800 text-white shadow-xl border border-zinc-700' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Static
              </button>
              <button
                onClick={() => setIsSweep(true)}
                className={`py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  isSweep 
                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 border border-blue-500' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Sweep
              </button>
            </div>

            {/* Waveform Selector */}
            <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-950/30 border border-zinc-800/30 rounded-xl">
              {(['sine', 'square', 'triangle'] as OscillatorType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => changeOscType(type)}
                  className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                    oscType === type 
                      ? 'bg-zinc-800 text-white border border-zinc-700' 
                      : 'text-zinc-500 hover:text-zinc-400'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Volume Control (Visible when playing) */}
            <AnimatePresence>
              {isPlaying && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3 bg-zinc-950/30 p-4 rounded-2xl border border-zinc-800/30"
                >
                  <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Output Gain</span>
                    </div>
                    <span className="text-zinc-300 font-bold">{Math.round(volume * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dynamic Configuration Panel */}
            <AnimatePresence mode="wait">
              {isSweep ? (
                <motion.div
                  key="sweep-config"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="space-y-6"
                >
                  {/* Presets Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {PRESETS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => applyPreset(p)}
                        className={`p-4 rounded-2xl border text-left transition-all relative group overflow-hidden ${
                          selectedPresetId === p.id
                            ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                            : 'bg-zinc-950/30 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {selectedPresetId === p.id && (
                          <motion.div 
                            layoutId="preset-active"
                            className="absolute inset-0 bg-emerald-500/5 pointer-events-none"
                          />
                        )}
                        <div className="flex items-center justify-between mb-2">
                          <div className={`p-2 rounded-lg ${selectedPresetId === p.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                            {p.icon}
                          </div>
                          <div className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${
                            p.threatLevel === 'Extreme' ? 'border-red-500/50 text-red-400 bg-red-500/10' :
                            p.threatLevel === 'High' ? 'border-orange-500/50 text-orange-400 bg-orange-500/10' :
                            'border-zinc-700 text-zinc-500'
                          }`}>
                            {p.threatLevel}
                          </div>
                        </div>
                        <span className={`text-xs font-bold block mb-1 ${selectedPresetId === p.id ? 'text-white' : 'text-zinc-300'}`}>
                          {p.name}
                        </span>
                        <p className="text-[10px] text-zinc-500 leading-tight">
                          {p.description}
                        </p>
                      </button>
                    ))}
                  </div>

                  {/* Profile Info */}
                  <AnimatePresence>
                    {selectedPreset && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/50"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Fingerprint className="w-3.5 h-3.5 text-blue-400" />
                          <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">Rodent Profile</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 leading-relaxed italic">
                          "{selectedPreset.profile}"
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Range Sliders */}
                  <div className="space-y-5 bg-zinc-950/30 p-5 rounded-[2rem] border border-zinc-800/30">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                        <span>Min Bound</span>
                        <span className="text-zinc-300 font-bold">{sweepMin.toLocaleString()} Hz</span>
                      </div>
                      <input 
                        type="range" min="15000" max="19000" step="100"
                        value={sweepMin}
                        onChange={(e) => {
                          setSweepMin(Math.min(Number(e.target.value), sweepMax - 500));
                          setSelectedPresetId(null);
                        }}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                        <span>Max Bound</span>
                        <span className="text-zinc-300 font-bold">{sweepMax.toLocaleString()} Hz</span>
                      </div>
                      <input 
                        type="range" min="16000" max="20000" step="100"
                        value={sweepMax}
                        onChange={(e) => {
                          setSweepMax(Math.max(Number(e.target.value), sweepMin + 500));
                          setSelectedPresetId(null);
                        }}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                        <div className="flex items-center gap-1">
                          <FastForward className="w-3 h-3 text-emerald-500" />
                          <span>Sweep Speed</span>
                        </div>
                        <span className="text-zinc-300 font-bold">{sweepSpeed} Hz/step</span>
                      </div>
                      <input 
                        type="range" min="50" max="1000" step="50"
                        value={sweepSpeed}
                        onChange={(e) => {
                          setSweepSpeed(Number(e.target.value));
                          setSelectedPresetId(null);
                        }}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="static-config"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="space-y-6 pt-4"
                >
                  <div className="space-y-4 bg-zinc-950/30 p-6 rounded-[2rem] border border-zinc-800/30">
                    <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                      <span>Manual Frequency</span>
                      <span className="text-emerald-400 font-bold">{frequency.toLocaleString()} Hz</span>
                    </div>
                    <input 
                      type="range" min="15000" max="20000" step="100"
                      value={frequency}
                      onChange={(e) => setFrequency(Number(e.target.value))}
                      className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between text-[9px] font-mono text-zinc-600 font-bold">
                      <span>15k Hz</span>
                      <span>17.5k Hz</span>
                      <span>20k Hz</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={isPlaying ? stopSound : startSound}
                className={`flex-1 py-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-2xl border ${
                  isPlaying 
                    ? 'bg-zinc-100 text-zinc-950 hover:bg-white border-white shadow-white/5' 
                    : 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400 border-emerald-400 shadow-emerald-500/20'
                }`}
              >
                {isPlaying ? (
                  <>
                    <Square className="w-5 h-5 fill-current" />
                    <span className="text-base font-black uppercase tracking-widest">Deactivate</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span className="text-base font-black uppercase tracking-widest">Engage System</span>
                  </>
                )}
              </button>
              
              <button
                onClick={() => setShowInfo(true)}
                className="w-16 h-16 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-all shadow-xl"
              >
                <Info className="w-6 h-6" />
              </button>
            </div>
          </div>
        </main>

        <footer className="mt-8 text-center">
          <div className="inline-flex items-center gap-6 px-6 py-2 rounded-full bg-zinc-900/50 border border-zinc-800/50 text-zinc-600">
            <div className="flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 opacity-50 text-blue-400" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Hardware Direct</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-zinc-800" />
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 opacity-50 text-emerald-400" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Safe Spectrum</span>
            </div>
          </div>
        </footer>
      </motion.div>

      {/* Info Modal */}
      <AnimatePresence>
        {showInfo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-950/95 backdrop-blur-xl"
            onClick={() => setShowInfo(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="bg-zinc-900 border border-zinc-800 rounded-[3rem] p-8 max-w-md w-full shadow-2xl overflow-hidden relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 via-blue-500 to-emerald-500" />
              
              <h2 className="text-2xl font-black mb-6 flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-2xl">
                  <Info className="w-6 h-6 text-blue-400" />
                </div>
                Intelligence Briefing
              </h2>
              
              <div className="space-y-6 text-sm text-zinc-400 leading-relaxed max-h-[70vh] overflow-y-auto pr-4 custom-scrollbar overscroll-contain">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-zinc-200 font-bold uppercase tracking-widest text-xs">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    <span>The Adaptation Problem</span>
                  </div>
                  <p>
                    Rodents are highly intelligent and can adapt to static ultrasonic tones within days. **Sweep Mode** is critical because it prevents habituation by constantly shifting the frequency landscape.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-zinc-200 font-bold uppercase tracking-widest text-xs">
                    <Target className="w-4 h-4 text-emerald-400" />
                    <span>Target Profiles</span>
                  </div>
                  <div className="grid gap-3">
                    {PRESETS.map(p => (
                      <div key={p.id} className="bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-zinc-200 font-bold">{p.name}</span>
                          <span className="text-[10px] font-mono text-zinc-500">{p.min/1000}k-{p.max/1000}k Hz</span>
                        </div>
                        <p className="text-xs text-zinc-500 leading-snug">{p.profile}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-800/50 p-5 rounded-3xl border border-zinc-700/50">
                  <p className="text-xs font-black text-zinc-300 mb-2 uppercase tracking-[0.2em]">Operational Safety</p>
                  <p className="text-[11px] leading-relaxed">
                    Ultrasonic sound is beyond human hearing range, but high volumes can still cause ear fatigue if placed too close. Keep the device at least 2 meters away from human sleeping areas. Some domestic pets (hamsters, guinea pigs) are sensitive to these frequencies and should be moved to a different room.
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setShowInfo(false)}
                className="w-full mt-8 py-5 bg-zinc-100 hover:bg-white text-zinc-950 rounded-[1.5rem] transition-all font-black uppercase tracking-[0.2em] shadow-2xl active:scale-[0.98]"
              >
                Acknowledge
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>
    </div>
  );
}
