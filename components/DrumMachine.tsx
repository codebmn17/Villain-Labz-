
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DrumPadConfig, AudioPlaylistItem, DrumKit, SequencerPattern } from '../types';
import { VolumeIcon } from './icons/VolumeIcon';
import { PlayIcon } from './icons/PlayIcon';
import { StopIcon } from './icons/StopIcon';
import { SaveIcon } from './icons/SaveIcon';
import { FolderOpenIcon } from './icons/FolderOpenIcon';
import { TrashIcon } from './icons/TrashIcon';
import { SequencerIcon } from './icons/SequencerIcon';
import { DrumIcon } from './icons/DrumIcon';

function makeDistortionCurve(amount: number) {
  const k = typeof amount === 'number' ? amount : 50;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

interface DrumMachineProps {
  drumPads: DrumPadConfig[];
  setDrumPads: (pads: DrumPadConfig[]) => void;
  generatedTracks: AudioPlaylistItem[];
  setGeneratedTracks: (tracks: AudioPlaylistItem[]) => void;
  defaultPads: DrumPadConfig[];
}

const DrumMachine: React.FC<DrumMachineProps> = ({ drumPads, setDrumPads, generatedTracks, setGeneratedTracks, defaultPads }) => {
  const [activePadId, setActivePadId] = useState<number | null>(null);
  const [volume, setVolume] = useState(0.8);
  const [viewMode, setViewMode] = useState<'PADS' | 'SEQUENCER'>('PADS');

  // Sequencer State
  const [bpm, setBpm] = useState(140);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [sequencerGrid, setSequencerGrid] = useState<Record<number, boolean[]>>(() => {
      const grid: Record<number, boolean[]> = {};
      for (let i = 0; i < 20; i++) {
          grid[i] = new Array(16).fill(false);
      }
      return grid;
  });
  const [savedPatterns, setSavedPatterns] = useState<SequencerPattern[]>([]);
  const [isPatternModalOpen, setIsPatternModalOpen] = useState(false);
  const [patternName, setPatternName] = useState('');

  // Main Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Looper State
  const [isLoopRecording, setIsLoopRecording] = useState(false);
  const [isLoopPlaying, setIsLoopPlaying] = useState(false);
  const [loopBuffer, setLoopBuffer] = useState<AudioBuffer | null>(null);

  // Kit Management State
  const [savedKits, setSavedKits] = useState<DrumKit[]>([]);
  const [selectedKitId, setSelectedKitId] = useState<string>('default');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newKitName, setNewKitName] = useState('');

  // Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const reverbNodeRef = useRef<ConvolverNode | null>(null); 
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);
  
  // Main Recorder Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Loop Recorder Refs
  const loopRecorderRef = useRef<MediaRecorder | null>(null);
  const loopChunksRef = useRef<Blob[]>([]);
  const loopSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // Sequencer Interval Ref
  const sequencerIntervalRef = useRef<number | null>(null);

  // Load Kits & Patterns from LocalStorage
  useEffect(() => {
    try {
      const storedKits = localStorage.getItem('villain_drum_kits');
      if (storedKits) {
        setSavedKits(JSON.parse(storedKits));
      }
      const storedPatterns = localStorage.getItem('villain_sequencer_patterns');
      if (storedPatterns) {
          setSavedPatterns(JSON.parse(storedPatterns));
      }
    } catch (e) {
      console.error("Failed to load drum data:", e);
    }
  }, []);

  // --- Sequencer Logic ---

  const toggleSequencerStep = (padId: number, stepIndex: number) => {
      setSequencerGrid(prev => {
          const newGrid = { ...prev };
          const newRow = [...newGrid[padId]];
          newRow[stepIndex] = !newRow[stepIndex];
          newGrid[padId] = newRow;
          return newGrid;
      });
  };

  const clearSequencer = () => {
      const emptyGrid: Record<number, boolean[]> = {};
      for (let i = 0; i < 20; i++) {
          emptyGrid[i] = new Array(16).fill(false);
      }
      setSequencerGrid(emptyGrid);
  };

  const randomizeSequencer = () => {
      const randomGrid: Record<number, boolean[]> = {};
      for (let i = 0; i < 20; i++) {
          randomGrid[i] = new Array(16).fill(false).map(() => Math.random() > 0.85);
      }
      setSequencerGrid(randomGrid);
  };
  
  const handleSavePattern = () => {
      if (!patternName.trim()) return;
      const newPattern: SequencerPattern = {
          id: Date.now().toString(),
          name: patternName.trim(),
          bpm: bpm,
          grid: sequencerGrid
      };
      const updatedPatterns = [...savedPatterns, newPattern];
      setSavedPatterns(updatedPatterns);
      localStorage.setItem('villain_sequencer_patterns', JSON.stringify(updatedPatterns));
      setIsPatternModalOpen(false);
      setPatternName('');
  };
  
  const handleLoadPattern = (pattern: SequencerPattern) => {
      setSequencerGrid(pattern.grid);
      setBpm(pattern.bpm);
  };

  const handleDeletePattern = (id: string) => {
     if (confirm('Delete this pattern?')) {
         const updated = savedPatterns.filter(p => p.id !== id);
         setSavedPatterns(updated);
         localStorage.setItem('villain_sequencer_patterns', JSON.stringify(updated));
     }
  };

  // --- Kit Management Handlers ---
  const handleSaveKit = () => {
    if (!newKitName.trim()) return;
    
    const newKit: DrumKit = {
      id: Date.now().toString(),
      name: newKitName.trim(),
      pads: drumPads
    };

    const updatedKits = [...savedKits, newKit];
    setSavedKits(updatedKits);
    localStorage.setItem('villain_drum_kits', JSON.stringify(updatedKits));
    
    setSelectedKitId(newKit.id);
    setIsSaveModalOpen(false);
    setNewKitName('');
  };

  const handleLoadKit = (kitId: string) => {
    setSelectedKitId(kitId);
    if (kitId === 'default') {
      setDrumPads(defaultPads);
    } else {
      const kit = savedKits.find(k => k.id === kitId);
      if (kit) {
        setDrumPads(kit.pads);
      }
    }
  };

  const handleDeleteKit = (kitId: string) => {
    if (window.confirm("Are you sure you want to delete this custom kit?")) {
      const updatedKits = savedKits.filter(k => k.id !== kitId);
      setSavedKits(updatedKits);
      localStorage.setItem('villain_drum_kits', JSON.stringify(updatedKits));
      if (selectedKitId === kitId) {
        handleLoadKit('default');
      }
    }
  };

  // Helper: Generate Impulse Response for Reverb (Street/Warehouse feel)
  const createImpulseResponse = (ctx: AudioContext, duration: number, decay: number, reverse: boolean = false) => {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = reverse ? length - i : i;
      left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
      right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
    }
    return impulse;
  };

  const createNoiseBuffer = (ctx: AudioContext) => {
      const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
      }
      return buffer;
  };

  // Initialize Audio Context
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const masterGain = ctx.createGain();
      const compressor = ctx.createDynamicsCompressor();
      const reverb = ctx.createConvolver(); 
      const dest = ctx.createMediaStreamDestination();
      
      reverb.buffer = createImpulseResponse(ctx, 0.8, 3.0); // Tighter, darker room for rap

      // Hardcore Compressor Settings
      compressor.threshold.setValueAtTime(-12, ctx.currentTime);
      compressor.knee.setValueAtTime(10, ctx.currentTime);
      compressor.ratio.setValueAtTime(12, ctx.currentTime);
      compressor.attack.setValueAtTime(0.002, ctx.currentTime);
      compressor.release.setValueAtTime(0.15, ctx.currentTime);

      compressor.connect(masterGain);
      reverb.connect(masterGain);

      masterGain.connect(ctx.destination);
      masterGain.connect(dest);
      
      audioCtxRef.current = ctx;
      masterGainRef.current = masterGain;
      compressorRef.current = compressor;
      reverbNodeRef.current = reverb;
      destRef.current = dest;
      
      masterGain.gain.value = volume;
      noiseBufferRef.current = createNoiseBuffer(ctx);

    } else if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
    }
  };

  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = volume;
    }
  }, [volume]);

  // --- Sound Generation Helpers ---

  const playSynthNote = (ctx: AudioContext, freq: number, time: number, duration: number, type: 'piano' | 'bell' | 'string' | 'pluck' | 'flute' | 'guitar' | 'brass' | 'cowbell', destination: AudioNode) => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator(); // For detuning/layering
    const gain = ctx.createGain();
    
    gain.connect(destination);

    if (type === 'piano') {
        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, time);
        osc2.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.6, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
    } else if (type === 'pluck') {
        // Clean pluck for melody
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(freq, time);
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 2, time);
        filter.frequency.exponentialRampToValueAtTime(freq, time + 0.1);
        
        osc1.connect(filter);
        filter.connect(gain);
        
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.5, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
        osc1.start(time);
        osc1.stop(time + duration);
        return;
    } else if (type === 'bell') {
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(freq, time);
        osc2.frequency.setValueAtTime(freq * 3.5, time); // Overtone
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.4, time + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration * 1.5);
    } else if (type === 'string') {
        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc1.frequency.setValueAtTime(freq, time);
        osc2.frequency.setValueAtTime(freq * 1.005, time); // Detune
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, time);
        filter.frequency.linearRampToValueAtTime(2000, time + duration/2);
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.3, time + 0.2);
        gain.gain.linearRampToValueAtTime(0, time + duration);
        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + duration);
        osc2.stop(time + duration);
        return;
    } else if (type === 'brass') {
         osc1.type = 'sawtooth';
         osc2.type = 'sawtooth';
         osc1.frequency.setValueAtTime(freq, time);
         osc2.frequency.setValueAtTime(freq * 1.01, time);
         const filter = ctx.createBiquadFilter();
         filter.type = 'lowpass';
         filter.frequency.setValueAtTime(freq * 1, time);
         filter.frequency.linearRampToValueAtTime(freq * 5, time + 0.05); // Brass swell
         filter.frequency.exponentialRampToValueAtTime(freq * 1, time + duration);
         osc1.connect(filter);
         osc2.connect(filter);
         filter.connect(gain);
         gain.gain.setValueAtTime(0, time);
         gain.gain.linearRampToValueAtTime(0.5, time + 0.05);
         gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
         osc1.start(time);
         osc2.start(time);
         osc1.stop(time + duration);
         osc2.stop(time + duration);
         return;
    } else if (type === 'cowbell') {
         osc1.type = 'square';
         osc1.frequency.setValueAtTime(freq, time);
         const filter = ctx.createBiquadFilter();
         filter.type = 'bandpass';
         filter.frequency.value = 2000;
         osc1.connect(filter);
         filter.connect(gain);
         gain.gain.setValueAtTime(0.6, time);
         gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
         osc1.start(time);
         osc1.stop(time + 0.1);
         return;
    }
    
    osc1.connect(gain);
    if(type !== 'flute' && type !== 'guitar') {
         osc2.connect(gain);
         osc2.start(time);
         osc2.stop(time + duration);
    }
    osc1.start(time);
    osc1.stop(time + duration);
  };

  const triggerSound = (type: 'kick' | 'snare' | 'hihat' | 'bass' | 'crash' | 'shaker' | 'tom' | 'snap' | 'gunshot' | 'siren', time: number, freq: number = 0, duration: number = 0.2) => {
      const ctx = audioCtxRef.current;
      const compressor = compressorRef.current;
      if(!ctx || !compressor) return;

      if (type === 'kick') {
          const osc = ctx.createOscillator();
          osc.frequency.setValueAtTime(150, time);
          osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
          const g = ctx.createGain();
          g.gain.setValueAtTime(1, time);
          g.gain.exponentialRampToValueAtTime(0.01, time + 0.3);
          osc.connect(g).connect(compressor);
          osc.start(time);
          osc.stop(time + 0.3);
      } else if (type === 'snare') {
          const noise = ctx.createBufferSource();
          noise.buffer = noiseBufferRef.current || createNoiseBuffer(ctx);
          const filter = ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.value = 1000;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.7, time);
          g.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
          noise.connect(filter).connect(g).connect(compressor);
          noise.start(time);
          noise.stop(time + 0.2);
          
          // Add body to snare
          const osc = ctx.createOscillator();
          osc.frequency.setValueAtTime(200, time);
          osc.frequency.exponentialRampToValueAtTime(150, time + 0.1);
          const og = ctx.createGain();
          og.gain.setValueAtTime(0.5, time);
          og.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
          osc.connect(og).connect(compressor);
          osc.start(time);
          osc.stop(time + 0.15);

      } else if (type === 'hihat') {
          const osc = ctx.createOscillator();
          osc.type = 'square';
          osc.frequency.value = 8000;
          const filter = ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.value = 7000;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.3, time);
          g.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
          osc.connect(filter).connect(g).connect(compressor);
          osc.start(time);
          osc.stop(time + 0.05);
      } else if (type === 'crash') {
           const noise = ctx.createBufferSource();
           noise.buffer = noiseBufferRef.current || createNoiseBuffer(ctx);
           const filter = ctx.createBiquadFilter();
           filter.type = 'highpass';
           filter.frequency.value = 3000;
           const g = ctx.createGain();
           g.gain.setValueAtTime(0.4, time);
           g.gain.exponentialRampToValueAtTime(0.01, time + 1.5);
           noise.connect(filter).connect(g).connect(compressor);
           noise.start(time);
           noise.stop(time + 1.5);
      } else if (type === 'gunshot') {
          // Composite Gunshot: Low Thud + Noise Burst
          const osc = ctx.createOscillator();
          osc.frequency.setValueAtTime(80, time);
          osc.frequency.exponentialRampToValueAtTime(20, time + 0.4);
          const g = ctx.createGain();
          g.gain.setValueAtTime(1, time);
          g.gain.exponentialRampToValueAtTime(0.01, time + 0.4);
          
          const noise = ctx.createBufferSource();
          noise.buffer = noiseBufferRef.current || createNoiseBuffer(ctx);
          const nf = ctx.createBiquadFilter();
          nf.type = 'lowpass';
          nf.frequency.value = 1200;
          const ng = ctx.createGain();
          ng.gain.setValueAtTime(1, time);
          ng.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
          
          osc.connect(g).connect(compressor);
          noise.connect(nf).connect(ng).connect(compressor);
          
          osc.start(time);
          osc.stop(time + 0.5);
          noise.start(time);
          noise.stop(time + 0.5);
      } else if (type === 'siren') {
         const osc = ctx.createOscillator();
         osc.type = 'sawtooth';
         osc.frequency.setValueAtTime(800, time);
         osc.frequency.linearRampToValueAtTime(1200, time + 0.5);
         osc.frequency.linearRampToValueAtTime(800, time + 1.0);
         const g = ctx.createGain();
         g.gain.setValueAtTime(0.5, time);
         g.gain.exponentialRampToValueAtTime(0.01, time + 1.2);
         osc.connect(g).connect(compressor);
         osc.start(time);
         osc.stop(time + 1.2);
      }
  };

  // --- Loop/Sequence Logic ---

  const playSpecialSound = (padId: number, config: DrumPadConfig) => {
    const ctx = audioCtxRef.current;
    const compressor = compressorRef.current;
    if (!ctx || !compressor) return;

    const now = ctx.currentTime;
    const beat = 60 / bpm; 

    // Purple Row (8-11): Play Melodic Scale
    if (padId >= 8 && padId <= 11) {
        playSynthNote(ctx, config.baseFrequency, now, 0.5, 'pluck', compressor);
        return;
    }

    // Row 4: Generated Beat Loops (Keys Z-V) - Now 4 Bars Long (16 beats)
    if (padId === 16) { // Chopper Speed (Tech N9ne Style - Triplets, Fast)
        for(let bar = 0; bar < 4; bar++) {
            const barStart = now + (bar * 4 * beat);
            // Kick: 1, 1.66(trip), 2.33(trip), 3.5
            triggerSound('kick', barStart);
            triggerSound('kick', barStart + beat * 1.66);
            triggerSound('kick', barStart + beat * 2.33);
            triggerSound('kick', barStart + beat * 3.5);
            
            // Snare: 2, 4
            triggerSound('snare', barStart + beat);
            triggerSound('snare', barStart + beat * 3);

            // Hats: Triplets constant
            for(let i=0; i<12; i++) {
                 // Skip hat on snare hits for cleaner mix
                 if (i !== 3 && i !== 9) {
                    triggerSound('hihat', barStart + i * (beat/3), 0, 0.05);
                 }
            }
            
            // Brass hit on 1 of bar 1 and 3
            if (bar % 2 === 0) {
                playSynthNote(ctx, 146.83, barStart, 0.5, 'brass', compressor); // D3
                playSynthNote(ctx, 73.42, barStart, 0.5, 'brass', compressor); // D2 (Octave)
            }
            // Fills on Bar 4
            if (bar === 3) {
                triggerSound('snare', barStart + beat * 3.25);
                triggerSound('snare', barStart + beat * 3.5);
                triggerSound('snare', barStart + beat * 3.75);
                triggerSound('gunshot', barStart + beat * 3.8);
            }
        }
        
    } else if (padId === 17) { // Shady Dirge (Eminem Style - Dark Piano, Minor)
        // Chromatic Walkdown D -> C# -> C -> B
        const notes = [293.66, 277.18, 261.63, 246.94]; // D4, C#4, C4, B3
        
        for(let bar = 0; bar < 4; bar++) {
            const barStart = now + (bar * 4 * beat);
            
            // Drums: Boom Bap-ish but faster
            triggerSound('kick', barStart);
            triggerSound('kick', barStart + beat * 1.5);
            triggerSound('kick', barStart + beat * 2.5);
            triggerSound('snare', barStart + beat);
            triggerSound('snare', barStart + beat * 3);
            
            // Hats: 8ths
            for(let i=0; i<8; i++) {
                triggerSound('hihat', barStart + i * (beat/2));
            }

            // Piano Melody (Quarter notes)
            const note = notes[bar % 4];
            playSynthNote(ctx, note, barStart, 0.4, 'piano', compressor);
            playSynthNote(ctx, note, barStart + beat, 0.4, 'piano', compressor);
            playSynthNote(ctx, note, barStart + beat * 2, 0.4, 'piano', compressor);
            playSynthNote(ctx, note, barStart + beat * 3, 0.4, 'piano', compressor);
            
            // Bell accent on 1
            playSynthNote(ctx, note * 2, barStart, 0.8, 'bell', compressor);
        }
        
    } else if (padId === 18) { // Detroit Rock (Heavy Stomp)
        for(let bar = 0; bar < 4; bar++) {
             const barStart = now + (bar * 4 * beat);
             
             // Heavy Stomp Kick on 1, 3
             triggerSound('kick', barStart);
             triggerSound('kick', barStart + beat * 2);
             
             // Clap/Snare layer on 2, 4
             triggerSound('snare', barStart + beat);
             triggerSound('snare', barStart + beat * 3);
             
             // Guitar Riff (Power Chords simulation)
             if (bar % 2 === 0) {
                 playSynthNote(ctx, 146.83, barStart, 0.2, 'guitar', compressor); // D
                 playSynthNote(ctx, 146.83, barStart + beat * 0.5, 0.2, 'guitar', compressor);
                 playSynthNote(ctx, 174.61, barStart + beat * 1.5, 0.3, 'guitar', compressor); // F
             } else {
                 playSynthNote(ctx, 130.81, barStart, 0.2, 'guitar', compressor); // C
                 playSynthNote(ctx, 130.81, barStart + beat * 0.5, 0.2, 'guitar', compressor);
                 playSynthNote(ctx, 123.47, barStart + beat * 1.5, 0.3, 'guitar', compressor); // B
             }
        }

    } else if (padId === 19) { // Worldwide (Orchestral Trap)
         for(let bar = 0; bar < 4; bar++) {
            const barStart = now + (bar * 4 * beat);
            
            // Trap Drums
            triggerSound('kick', barStart);
            triggerSound('kick', barStart + beat * 2.5); // Syncopated 
            triggerSound('snare', barStart + beat * 2);
            
            // Fast Hat Rolls (32nd notes occasionally)
            for(let i=0; i<16; i++) {
                triggerSound('hihat', barStart + i * (beat/4));
            }
            
            // Choir / Strings swells
            if (bar === 0 || bar === 2) {
                playSynthNote(ctx, 293.66, barStart, 2.0, 'string', compressor); // D Minor chord root
                playSynthNote(ctx, 349.23, barStart, 2.0, 'string', compressor); // F
            } else {
                 playSynthNote(ctx, 277.18, barStart, 2.0, 'string', compressor); // C# (Harmonic minor tension)
                 playSynthNote(ctx, 329.63, barStart, 2.0, 'string', compressor); // E
            }
            
            // Chant/Voice FX simulation
            if (bar === 3) {
                playSynthNote(ctx, 440, barStart + beat * 3, 0.1, 'cowbell', compressor); // "Hey"
                playSynthNote(ctx, 440, barStart + beat * 3.5, 0.1, 'cowbell', compressor); // "Hey"
            }
         }
    }
    // Fallbacks for Row 3 (FX) if handled here or via soundType check
    else if (padId >= 12 && padId <= 14) {
        if(config.soundType === 'fx' && padId === 12) { // Gun Cock
             const noise = ctx.createBufferSource();
             noise.buffer = noiseBufferRef.current || createNoiseBuffer(ctx);
             const f = ctx.createBiquadFilter();
             f.type = 'bandpass';
             f.frequency.value = 2500;
             const g = ctx.createGain();
             // Click 1
             g.gain.setValueAtTime(0.5, now);
             g.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
             // Click 2
             g.gain.setValueAtTime(0.6, now + 0.15);
             g.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
             noise.connect(f).connect(g).connect(compressor);
             noise.start(now);
             noise.stop(now + 0.3);
        } else if (config.soundType === 'fx' && padId === 13) { // Gun Blast
            triggerSound('gunshot', now);
        } else if (config.soundType === 'fx' && padId === 14) { // Siren
            triggerSound('siren', now);
        }
    }
  };

  const playPad = useCallback((pad: DrumPadConfig) => {
    initAudio();
    setActivePadId(pad.id);
    setTimeout(() => setActivePadId(null), 150);

    const ctx = audioCtxRef.current;
    const master = masterGainRef.current;
    const compressor = compressorRef.current;
    const reverb = reverbNodeRef.current;

    if (!ctx || !master || !compressor || !reverb) return;

    // Specific sequencer logic for Rows 2, 3, 4
    if ((pad.id >= 8 && pad.id <= 11) || (pad.id >= 16) || (pad.id >= 12 && pad.id <= 14)) {
        playSpecialSound(pad.id, pad);
        return;
    }

    // Standard Synthesis (Row 0 Bass & Row 1 Drums)
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const distortion = ctx.createWaveShaper();

    osc.type = pad.waveform;
    
    // Deep Bass Logic (Row 0)
    if (pad.soundType === 'bass') {
        // Clean start to avoid popping
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(1.0, t + 0.02);
        
        // Pitch Envelope for "Kick" effect on 808
        osc.frequency.setValueAtTime(pad.baseFrequency + 120, t); 
        osc.frequency.exponentialRampToValueAtTime(pad.baseFrequency, t + pad.pitchDecay);
        
        // Sustain
        gain.gain.exponentialRampToValueAtTime(0.8, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + pad.volumeDecay);
    } else {
        // Standard drum hits
        osc.frequency.setValueAtTime(pad.baseFrequency, t);
        if (pad.pitchDecay > 0) {
             osc.frequency.exponentialRampToValueAtTime(pad.baseFrequency / 2, t + pad.pitchDecay);
        }
        gain.gain.setValueAtTime(1.0, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + pad.volumeDecay);
    }

    if (pad.distortion) {
      distortion.curve = makeDistortionCurve(pad.soundType === 'bass' ? 20 : 100); // Less distortion on bass to keep it deep
      distortion.oversample = '4x';
      osc.connect(distortion);
      distortion.connect(gain);
    } else {
      osc.connect(gain);
    }
    
    // Noise layer for snares/hats
    if (pad.noise) {
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBufferRef.current || createNoiseBuffer(ctx);
        const noiseFilter = ctx.createBiquadFilter();
        const noiseGain = ctx.createGain();
        
        if(pad.soundType === 'hihat') {
            noiseFilter.type = 'highpass';
            noiseFilter.frequency.value = 5000;
            noiseGain.gain.setValueAtTime(0.4, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
        } else if (pad.soundType === 'snare') {
            noiseFilter.type = 'highpass';
            noiseFilter.frequency.value = 800;
            noiseGain.gain.setValueAtTime(0.6, t);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        }
        
        noise.connect(noiseFilter).connect(noiseGain).connect(gain);
        noise.start(t);
        noise.stop(t + pad.volumeDecay);
    }

    gain.connect(compressor); 
    
    // Reverb Send
    const reverbSend = ctx.createGain();
    reverbSend.gain.value = pad.soundType === 'bass' ? 0.05 : 0.3; // Less reverb on bass
    gain.connect(reverbSend);
    reverbSend.connect(reverb);

    osc.start(t);
    osc.stop(t + pad.volumeDecay);

  }, [drumPads, volume]);

  // Sequencer Player Clock
  useEffect(() => {
      if (isPlayingSequence) {
          // Calculate step time in ms (16th notes)
          const stepTime = (60000 / bpm) / 4;
          
          sequencerIntervalRef.current = window.setInterval(() => {
              setCurrentStep(prev => {
                  const nextStep = (prev + 1) % 16;
                  // Trigger sounds for next step
                  drumPads.forEach(pad => {
                      if (sequencerGrid[pad.id][nextStep]) {
                          playPad(pad);
                      }
                  });
                  return nextStep;
              });
          }, stepTime);
      } else {
          if (sequencerIntervalRef.current) {
              clearInterval(sequencerIntervalRef.current);
              sequencerIntervalRef.current = null;
          }
          setCurrentStep(0);
      }

      return () => {
          if (sequencerIntervalRef.current) {
              clearInterval(sequencerIntervalRef.current);
          }
      };
  }, [isPlayingSequence, bpm, drumPads, sequencerGrid, playPad]);

  // Keyboard Mapping with Repeat Fix
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return; // Prevent double firing on hold
      const key = e.key.toUpperCase();
      const pad = drumPads.find(p => p.keyTrigger === key);
      if (pad) {
        playPad(pad);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drumPads, playPad]);


  // Recording Logic
  const toggleRecord = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      if (timerRef.current) window.clearInterval(timerRef.current);
      setIsRecording(false);
      setRecordingTime(0);
    } else {
      initAudio();
      if (!destRef.current) return;
      
      chunksRef.current = [];
      const recorder = new MediaRecorder(destRef.current.stream);
      
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const newTrack: AudioPlaylistItem = {
          id: Date.now().toString(),
          title: `Drum Session ${new Date().toLocaleTimeString()}`,
          artist: 'DJ Gemini',
          src: url
        };
        setGeneratedTracks([...generatedTracks, newTrack]);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      
      const startTime = Date.now();
      timerRef.current = window.setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
  };

  // Looper Logic
  const toggleLoopRecord = () => {
    if (isLoopRecording) {
        loopRecorderRef.current?.stop();
        setIsLoopRecording(false);
    } else {
        initAudio();
        if(!destRef.current) return;
        
        loopChunksRef.current = [];
        const recorder = new MediaRecorder(destRef.current.stream);
        recorder.ondataavailable = e => loopChunksRef.current.push(e.data);
        recorder.onstop = async () => {
            const blob = new Blob(loopChunksRef.current, { type: 'audio/webm' });
            const arrayBuffer = await blob.arrayBuffer();
            if(audioCtxRef.current) {
                const buffer = await audioCtxRef.current.decodeAudioData(arrayBuffer);
                setLoopBuffer(buffer);
                setIsLoopPlaying(true); // Auto-play after record
            }
        };
        recorder.start();
        loopRecorderRef.current = recorder;
        setIsLoopRecording(true);
    }
  };

  const toggleLoopPlay = () => {
      if(isLoopPlaying) {
          if(loopSourceNodeRef.current) {
              loopSourceNodeRef.current.stop();
              loopSourceNodeRef.current = null;
          }
          setIsLoopPlaying(false);
      } else {
          if(loopBuffer && audioCtxRef.current) {
              const source = audioCtxRef.current.createBufferSource();
              source.buffer = loopBuffer;
              source.loop = true;
              source.connect(masterGainRef.current!);
              source.start();
              loopSourceNodeRef.current = source;
              setIsLoopPlaying(true);
          }
      }
  };

  // --- Render ---

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-2xl animate-fade-in h-full flex flex-col">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-purple-400">DJ Gemini Drum Machine</h2>
          <p className="text-gray-400 text-sm">WebAudio Synthesis Engine | 5x4 Matrix</p>
        </div>

        {/* Controls & Kit Management */}
        <div className="flex items-center space-x-4 bg-gray-900/50 p-2 rounded-lg">
          {/* View Toggle */}
           <div className="flex bg-gray-800 rounded-lg p-1">
              <button 
                  onClick={() => setViewMode('PADS')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'PADS' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  title="Pads View"
              >
                  <DrumIcon className="h-5 w-5" />
              </button>
              <button 
                  onClick={() => setViewMode('SEQUENCER')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'SEQUENCER' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  title="Sequencer View"
              >
                  <SequencerIcon className="h-5 w-5" />
              </button>
          </div>

          <div className="flex items-center space-x-2 border-r border-gray-700 pr-4">
              <VolumeIcon volume={volume} />
              <input 
                type="range" min="0" max="1" step="0.1" value={volume} 
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
          </div>
          
          <button 
            onClick={toggleRecord}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg ${isRecording ? 'bg-red-600 animate-pulse ring-4 ring-red-900' : 'bg-gray-700 hover:bg-red-900 text-red-500'}`}
            title="Record Session"
          >
             <div className={`rounded-full ${isRecording ? 'w-3 h-3 bg-white' : 'w-4 h-4 bg-red-500'}`}></div>
          </button>
           {isRecording && <span className="font-mono text-red-400">{new Date(recordingTime * 1000).toISOString().substr(14, 5)}</span>}
           
           {/* Looper Controls */}
           <div className="flex items-center space-x-2 border-l border-gray-700 pl-4">
               <button 
                 onClick={toggleLoopRecord}
                 className={`px-2 py-1 text-xs rounded border ${isLoopRecording ? 'bg-orange-600 border-orange-500 text-white' : 'border-orange-800 text-orange-500 hover:bg-orange-900'}`}
               >
                   {isLoopRecording ? 'REC LOOP...' : 'LOOP REC'}
               </button>
               <button
                 onClick={toggleLoopPlay}
                 disabled={!loopBuffer}
                 className={`px-2 py-1 text-xs rounded border ${isLoopPlaying ? 'bg-green-600 border-green-500 text-white' : 'border-green-800 text-green-500 hover:bg-green-900 disabled:opacity-50'}`}
               >
                   {isLoopPlaying ? 'STOP LOOP' : 'PLAY LOOP'}
               </button>
           </div>
        </div>
        
        {/* Kit Load/Save */}
        <div className="flex items-center space-x-2">
            <select 
              value={selectedKitId} 
              onChange={(e) => handleLoadKit(e.target.value)}
              className="bg-gray-700 text-xs text-white rounded p-1 border border-gray-600"
            >
                <option value="default">Factory Default</option>
                {savedKits.map(kit => (
                    <option key={kit.id} value={kit.id}>{kit.name}</option>
                ))}
            </select>
            <button onClick={() => setIsSaveModalOpen(true)} className="text-gray-400 hover:text-blue-400"><SaveIcon /></button>
            <button onClick={() => document.getElementById('kit-import')?.click()} className="text-gray-400 hover:text-green-400"><FolderOpenIcon /></button>
            {selectedKitId !== 'default' && (
                <button onClick={() => handleDeleteKit(selectedKitId)} className="text-gray-400 hover:text-red-500"><TrashIcon /></button>
            )}
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'PADS' ? (
        <>
          {/* Pads Grid */}
          <div className="grid grid-cols-4 gap-2 sm:gap-4 flex-1">
            {drumPads.map((pad) => (
              <button
                key={pad.id}
                onPointerDown={(e) => {
                    e.preventDefault(); // Fix double firing on mobile/hybrid
                    playPad(pad);
                }}
                className={`
                  relative rounded-xl transition-all duration-75 select-none flex flex-col items-center justify-center overflow-hidden touch-manipulation
                  ${pad.color} 
                  ${activePadId === pad.id ? 'brightness-150 scale-95 shadow-[0_0_20px_rgba(255,255,255,0.5)]' : 'hover:brightness-110 shadow-lg'}
                  h-20 sm:h-auto
                `}
              >
                <span className="absolute top-1 left-2 text-xs font-bold opacity-50">{pad.keyTrigger}</span>
                <span className="font-bold text-sm sm:text-lg text-center leading-tight px-1 z-10 drop-shadow-md">{pad.label}</span>
                {/* Visual indicator for sound type */}
                <div className="absolute bottom-0 left-0 w-full h-1 bg-white opacity-20"></div>
              </button>
            ))}
          </div>
          <div className="mt-4 text-center text-xs text-gray-500">
            <p>Use Keyboard keys: 1-4, 5-8, Q-R, A-F, Z-V to trigger pads. Row 0 (Top) = Deep 808 Bass.</p>
          </div>
        </>
      ) : (
        /* Sequencer View */
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-900/50 rounded-xl border border-gray-700">
             {/* Sequencer Toolbar */}
             <div className="p-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => setIsPlayingSequence(!isPlayingSequence)}
                        className={`flex items-center px-3 py-1 rounded-md font-bold text-sm ${isPlayingSequence ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}
                    >
                        {isPlayingSequence ? <StopIcon /> : <PlayIcon />}
                        <span className="ml-1">{isPlayingSequence ? 'Stop' : 'Play'}</span>
                    </button>
                    <div className="flex items-center bg-gray-700 rounded px-2">
                        <span className="text-xs text-gray-400 mr-2">BPM</span>
                        <input 
                            type="number" 
                            value={bpm} 
                            onChange={(e) => setBpm(Number(e.target.value))}
                            className="w-12 bg-transparent text-white text-sm font-mono focus:outline-none"
                        />
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                     <button onClick={clearSequencer} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-xs text-white rounded">Clear</button>
                     <button onClick={randomizeSequencer} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-xs text-white rounded">Random</button>
                     <div className="h-4 w-px bg-gray-600 mx-1"></div>
                     <button onClick={() => setIsPatternModalOpen(true)} className="text-gray-400 hover:text-blue-400"><SaveIcon /></button>
                     {savedPatterns.length > 0 && (
                         <select 
                            onChange={(e) => {
                                const pattern = savedPatterns.find(p => p.id === e.target.value);
                                if(pattern) handleLoadPattern(pattern);
                                e.target.value = ''; // reset
                            }}
                            className="bg-gray-700 text-xs text-white rounded p-1 w-24"
                         >
                             <option value="">Load...</option>
                             {savedPatterns.map(p => (
                                 <option key={p.id} value={p.id}>{p.name}</option>
                             ))}
                         </select>
                     )}
                </div>
             </div>

             {/* Sequencer Grid */}
             <div className="flex-1 overflow-y-auto p-2 space-y-1">
                 {drumPads.map((pad) => (
                     <div key={pad.id} className="flex items-center h-8">
                         <div className={`w-24 flex-shrink-0 text-xs font-bold px-2 py-1 rounded-l-md truncate ${pad.color.replace('bg-', 'text-').replace('900', '300')}`}>
                             {pad.label}
                         </div>
                         <div className="flex-1 flex space-x-1 bg-gray-800/50 p-1 rounded-r-md">
                             {sequencerGrid[pad.id].map((isActive, stepIndex) => (
                                 <button
                                    key={stepIndex}
                                    onClick={() => toggleSequencerStep(pad.id, stepIndex)}
                                    className={`flex-1 rounded-sm transition-all duration-100 h-full
                                        ${isActive ? pad.color : 'bg-gray-700'}
                                        ${currentStep === stepIndex ? 'ring-2 ring-white ring-opacity-50 brightness-125' : ''}
                                        ${stepIndex % 4 === 0 ? 'mr-1' : ''} 
                                    `}
                                 />
                             ))}
                         </div>
                     </div>
                 ))}
             </div>
        </div>
      )}

      {/* Save Kit Modal */}
      {isSaveModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
              <div className="bg-gray-800 p-6 rounded-lg shadow-2xl border border-gray-600 w-80">
                  <h3 className="text-xl font-bold text-white mb-4">Save Custom Kit</h3>
                  <input 
                    type="text" 
                    placeholder="Kit Name (e.g. My Trap Kit)"
                    value={newKitName}
                    onChange={(e) => setNewKitName(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white mb-4 focus:ring-2 focus:ring-purple-500"
                    autoFocus
                  />
                  <div className="flex justify-end space-x-2">
                      <button onClick={() => setIsSaveModalOpen(false)} className="px-4 py-2 text-gray-300 hover:text-white">Cancel</button>
                      <button onClick={handleSaveKit} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold">Save</button>
                  </div>
              </div>
          </div>
      )}

      {/* Save Pattern Modal */}
      {isPatternModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
              <div className="bg-gray-800 p-6 rounded-lg shadow-2xl border border-gray-600 w-80">
                  <h3 className="text-xl font-bold text-white mb-4">Save Pattern</h3>
                  <input 
                    type="text" 
                    placeholder="Pattern Name (e.g. Hard Beat 1)"
                    value={patternName}
                    onChange={(e) => setPatternName(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white mb-4 focus:ring-2 focus:ring-purple-500"
                    autoFocus
                  />
                  <div className="flex justify-end space-x-2">
                      <button onClick={() => setIsPatternModalOpen(false)} className="px-4 py-2 text-gray-300 hover:text-white">Cancel</button>
                      <button onClick={handleSavePattern} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-bold">Save</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default DrumMachine;
