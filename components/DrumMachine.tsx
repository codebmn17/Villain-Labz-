
import React, { useState, useEffect, useRef } from 'react';
import { DrumPadConfig, AudioPlaylistItem, DrumKit, SequencerPattern, SongArrangement, SongSection } from '../types';
import { VolumeIcon } from './icons/VolumeIcon';
import { PlayIcon } from './icons/PlayIcon';
import { StopIcon } from './icons/StopIcon';
import { SaveIcon } from './icons/SaveIcon';
import { FolderOpenIcon } from './icons/FolderOpenIcon';
import { MicIcon } from './icons/MicIcon';
import { DrumIcon } from './icons/DrumIcon';
import { TrashIcon } from './icons/TrashIcon';
import { saveTrackToDB } from '../services/storageService';
import { MagicIcon } from './icons/MagicIcon';
import { generateSequencerPatternFromPrompt } from '../services/geminiService';
import { SequencerIcon } from './icons/SequencerIcon';


// Soft clipping distortion curve (Warmth, not destruction)
function makeDistortionCurve(amount: number) {
  const k = amount; 
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

interface DrumMachineProps {
  drumPads: DrumPadConfig[];
  setDrumPads: (pads: DrumPadConfig[]) => void;
  generatedTracks: AudioPlaylistItem[];
  setGeneratedTracks: (tracks: AudioPlaylistItem[]) => void;
  defaultPads: DrumPadConfig[];
  reverbMix: number;
  reverbDecay: number;
  setReverbMix: (mix: number) => void;
  setReverbDecay: (decay: number) => void;
  bpm: number;
  setBpm: (bpm: number) => void;
  sequencerGrid: Record<number, boolean[]>;
  setSequencerGrid: (grid: Record<number, boolean[]>) => void;
  savedPatterns: SequencerPattern[];
  setSavedPatterns: (patterns: (p: SequencerPattern[]) => SequencerPattern[]) => void;
  savedArrangements: SongArrangement[];
  setSavedArrangements: (arrs: SongArrangement[]) => void;
}

const DrumMachine: React.FC<DrumMachineProps> = ({ 
    drumPads, 
    setDrumPads, 
    generatedTracks, 
    setGeneratedTracks, 
    defaultPads,
    reverbMix,
    reverbDecay,
    setReverbMix,
    setReverbDecay,
    bpm,
    setBpm,
    sequencerGrid,
    setSequencerGrid,
    savedPatterns,
    setSavedPatterns,
    savedArrangements,
    setSavedArrangements,
}) => {
  const [activePadId, setActivePadId] = useState<number | null>(null);
  const [volume, setVolume] = useState(0.8);
  const [viewMode, setViewMode] = useState<'PADS' | 'SEQUENCER' | 'ARRANGE'>('PADS');
  
  // Recording States
  const [isAudioRecording, setIsAudioRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Looping States
  const [isLoopMode, setIsLoopMode] = useState(false);
  const [activeLoops, setActiveLoops] = useState<Set<number>>(new Set());

  // Performance Controls
  const [pitchBend, setPitchBend] = useState(0); // Semitones -12 to +12
  
  // Sequencer State
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPatternModalOpen, setIsPatternModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [patternName, setPatternName] = useState('');

  // Arrangement State
  const [currentArrangement, setCurrentArrangement] = useState<SongArrangement>({ id: 'current', name: 'New Song', sections: [] });
  const [isPlayingSong, setIsPlayingSong] = useState(false);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentSectionRep, setCurrentSectionRep] = useState(0);
  const [newSectionForm, setNewSectionForm] = useState({ name: 'Intro', patternId: '', repetitions: 4 });

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
  const wetGainRef = useRef<GainNode | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);
  
  // Interval Refs & Imperative State
  const recordingIntervalRef = useRef<number | null>(null);
  const loopIntervalsRef = useRef<Map<number, number>>(new Map());
  const sequenceIntervalRef = useRef<number | null>(null);
  const songIntervalRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const currentStepRef = useRef(0);

  // Load Kits & Patterns from LocalStorage
  useEffect(() => {
    try {
      const storedKits = localStorage.getItem('villain_drum_kits');
      if (storedKits) {
        setSavedKits(JSON.parse(storedKits));
      }
    } catch (e) {
      console.error("Failed to load drum data:", e);
    }
  }, []);

  // --- Arrangement Logic ---
  const handleAddSection = () => {
      if (!newSectionForm.patternId) {
          alert("Please select a pattern for the new section.");
          return;
      }
      const newSection: SongSection = {
          ...newSectionForm,
          id: Date.now().toString(),
      };
      setCurrentArrangement(prev => ({ ...prev, sections: [...prev.sections, newSection] }));
      setNewSectionForm({ name: 'Verse', patternId: '', repetitions: 8 }); // Reset for next section
  };

  const handleDeleteSection = (sectionId: string) => {
      setCurrentArrangement(prev => ({ ...prev, sections: prev.sections.filter(s => s.id !== sectionId) }));
  };

  const handlePlaySong = () => {
      if (isPlayingSong) {
          if (songIntervalRef.current) clearInterval(songIntervalRef.current);
          setIsPlayingSong(false);
          setCurrentStep(0);
          return;
      }
      
      initAudio();
      setIsPlayingSong(true);
      setCurrentSectionIndex(0);
      setCurrentSectionRep(0);
      currentStepRef.current = -1;

      const playNextStep = () => {
          const currentSection = currentArrangement.sections[currentSectionIndex];
          if (!currentSection) {
              handlePlaySong(); // Stop playback
              return;
          }

          const pattern = savedPatterns.find(p => p.id === currentSection.patternId);
          if (!pattern) {
              console.error(`Pattern ${currentSection.patternId} not found!`);
              handlePlaySong(); // Stop
              return;
          }
          
          const stepDurationMs = (60 / pattern.bpm) * 1000 / 4;
          if (songIntervalRef.current) clearInterval(songIntervalRef.current);

          songIntervalRef.current = window.setInterval(() => {
              currentStepRef.current = (currentStepRef.current + 1);

              if (currentStepRef.current >= 16) {
                  currentStepRef.current = 0;
                  const newRep = currentSectionRep + 1;
                  setCurrentSectionRep(newRep);

                  if (newRep >= currentSection.repetitions) {
                      const newIndex = currentSectionIndex + 1;
                      if (newIndex >= currentArrangement.sections.length) {
                          handlePlaySong(); // End of song
                          return;
                      }
                      setCurrentSectionIndex(newIndex);
                      setCurrentSectionRep(0);
                  }
                  playNextStep(); // Recursively call to setup interval for next section/rep
                  return;
              }

              setCurrentStep(currentStepRef.current);
              
              drumPads.forEach(pad => {
                  if (pattern.grid[pad.id]?.[currentStepRef.current]) {
                      triggerPad(pad.id, audioCtxRef.current?.currentTime || 0);
                  }
              });

          }, stepDurationMs);
      };
      
      playNextStep();
  };


  // --- Sequencer Logic ---
  const toggleSequencerStep = (padId: number, stepIndex: number) => {
      const newGrid = { ...sequencerGrid };
      newGrid[padId] = [...newGrid[padId]]; // Make a copy
      newGrid[padId][stepIndex] = !newGrid[padId][stepIndex];
      setSequencerGrid(newGrid);
  };

  const clearSequencer = () => {
      const emptyGrid: Record<number, boolean[]> = {};
      for (let i = 0; i < 20; i++) {
          emptyGrid[i] = new Array(16).fill(false);
      }
      setSequencerGrid(emptyGrid);
  };
  
  const handleGeneratePattern = async () => {
      if (!generatePrompt.trim()) return;
      setIsGenerating(true);
      try {
          const { grid, bpm } = await generateSequencerPatternFromPrompt(generatePrompt, drumPads);
          setSequencerGrid(grid);
          setBpm(bpm);
          setIsGenerateModalOpen(false);
          setGeneratePrompt('');
      } catch (e) {
          console.error("Failed to generate pattern", e);
          alert("Could not generate pattern. Please try a different prompt.");
      } finally {
          setIsGenerating(false);
      }
  };


  const handleSavePattern = () => {
      if (!patternName.trim()) return;
      const newPattern: SequencerPattern = {
          id: Date.now().toString(),
          name: patternName.trim(),
          bpm: bpm,
          grid: sequencerGrid
      };
      setSavedPatterns(prev => {
        const updated = [...prev, newPattern];
        localStorage.setItem('villain_sequencer_patterns', JSON.stringify(updated));
        return updated;
      });
      setIsPatternModalOpen(false);
      setPatternName('');
  };
  
  const handleLoadPattern = (pattern: SequencerPattern) => {
      setSequencerGrid(pattern.grid);
      setBpm(pattern.bpm);
  };

  const handleDeletePattern = (id: string) => {
     if (confirm('Delete this pattern?')) {
        setSavedPatterns(prev => {
            const updated = prev.filter(p => p.id !== id);
            localStorage.setItem('villain_sequencer_patterns', JSON.stringify(updated));
            return updated;
        });
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
  
  const handleKitSelectionChange = (value: string) => {
      if (value === '__SAVE_NEW_KIT__') {
          setNewKitName(`My Kit ${savedKits.length + 1}`);
          setIsSaveModalOpen(true);
      } else {
          handleLoadKit(value);
      }
  };
  
  const handleDeleteKit = (kitId: string) => {
      if (window.confirm("Are you sure you want to delete this kit permanently?")) {
          const updatedKits = savedKits.filter(k => k.id !== kitId);
          setSavedKits(updatedKits);
          localStorage.setItem('villain_drum_kits', JSON.stringify(updatedKits));
          handleLoadKit('default'); // Revert to default kit
      }
  };

  const createImpulseResponse = (ctx: AudioContext, duration: number, decay: number) => {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i / length; // Normalized time
      left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
      right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
    }
    return impulse;
  };

  const createNoiseBuffer = (ctx: AudioContext) => {
      const bufferSize = ctx.sampleRate * 2; 
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
      }
      return buffer;
  };

  const initAudio = () => {
    if (!audioCtxRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const masterGain = ctx.createGain();
      const compressor = ctx.createDynamicsCompressor();
      const reverb = ctx.createConvolver();
      const wetGain = ctx.createGain();
      const dryGain = ctx.createGain();
      const dest = ctx.createMediaStreamDestination();
      
      reverb.buffer = createImpulseResponse(ctx, reverbDecay, 2.0);
      wetGain.gain.value = reverbMix;
      dryGain.gain.value = 1 - reverbMix;

      compressor.threshold.setValueAtTime(-12, ctx.currentTime);
      compressor.knee.setValueAtTime(10, ctx.currentTime);
      compressor.ratio.setValueAtTime(12, ctx.currentTime);
      compressor.attack.setValueAtTime(0.002, ctx.currentTime);
      compressor.release.setValueAtTime(0.15, ctx.currentTime);

      compressor.connect(dryGain);
      compressor.connect(reverb);
      
      reverb.connect(wetGain);
      
      dryGain.connect(masterGain);
      wetGain.connect(masterGain);

      masterGain.connect(ctx.destination);
      masterGain.connect(dest);
      
      audioCtxRef.current = ctx;
      masterGainRef.current = masterGain;
      compressorRef.current = compressor;
      reverbNodeRef.current = reverb;
      wetGainRef.current = wetGain;
      destRef.current = dest;
      
      masterGain.gain.value = volume;
      noiseBufferRef.current = createNoiseBuffer(ctx);

    } else if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
    }
  };

  const startAudioRecording = () => {
    initAudio();
    if (!destRef.current || !audioCtxRef.current) {
        console.error("Audio Context or Dest not initialized");
        return;
    }

    try {
        audioChunksRef.current = [];
        const mediaRecorder = new MediaRecorder(destRef.current.stream);
        
        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            const newTrack: AudioPlaylistItem = {
                id: Date.now().toString(),
                src: audioUrl,
                title: `Recording ${new Date().toLocaleTimeString()}`,
                artist: 'Drum Session',
                createdAt: Date.now(),
                size: audioBlob.size
            };
            
            await saveTrackToDB(newTrack);
            setGeneratedTracks([newTrack, ...generatedTracks]);
            
            setRecordingTime(0);
            if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        };

        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsAudioRecording(true);
        
        setRecordingTime(0);
        recordingIntervalRef.current = window.setInterval(() => {
            setRecordingTime(prev => prev + 1);
        }, 1000);

    } catch(e) {
        console.error("Recording failed to start", e);
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isAudioRecording) {
        mediaRecorderRef.current.stop();
        setIsAudioRecording(false);
    }
  };

  const formatRecordingTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (wetGainRef.current && audioCtxRef.current) {
      wetGainRef.current.gain.setValueAtTime(reverbMix, audioCtxRef.current.currentTime);
    }
  }, [reverbMix]);
  
  useEffect(() => {
    if (reverbNodeRef.current && audioCtxRef.current) {
      reverbNodeRef.current.buffer = createImpulseResponse(audioCtxRef.current, reverbDecay, 2);
    }
  }, [reverbDecay]);

  const handleStopSequence = () => {
      if (sequenceIntervalRef.current) {
          clearInterval(sequenceIntervalRef.current);
          sequenceIntervalRef.current = null;
      }
      isPlayingRef.current = false;
      setIsPlayingSequence(false);
      setCurrentStep(0);
      currentStepRef.current = 0;
  };

  const handlePlaySequence = () => {
      initAudio();
      isPlayingRef.current = true;
      setIsPlayingSequence(true);
      currentStepRef.current = -1;

      const stepDurationMs = (60 / bpm) * 1000 / 4;
      
      sequenceIntervalRef.current = window.setInterval(() => {
          if (!isPlayingRef.current) {
              if (sequenceIntervalRef.current) clearInterval(sequenceIntervalRef.current);
              return;
          }
          
          const ctx = audioCtxRef.current;
          if(!ctx) return;

          currentStepRef.current = (currentStepRef.current + 1) % 16;
          setCurrentStep(currentStepRef.current);

          drumPads.forEach(pad => {
              if (sequencerGrid[pad.id]?.[currentStepRef.current]) {
                  triggerPad(pad.id, ctx.currentTime);
              }
          });
      }, stepDurationMs);
  };

  const handleToggleSequencePlayback = () => {
      if (isPlayingSequence) {
          handleStopSequence();
      } else {
          handlePlaySequence();
      }
  };

  useEffect(() => {
    return () => {
      if (sequenceIntervalRef.current) clearInterval(sequenceIntervalRef.current);
      if (songIntervalRef.current) clearInterval(songIntervalRef.current);
    };
  }, []);


  const playTrapKick = (ctx: AudioContext, dest: AudioNode, time: number, freq: number, decay: number, dist: boolean, waveform: 'sine' | 'triangle' | 'square' | 'sawtooth' = 'sine') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = waveform;
      const startFreq = freq > 0 ? freq : 60;
      osc.frequency.setValueAtTime(startFreq, time);
      const endFreq = 20; 
      osc.frequency.exponentialRampToValueAtTime(endFreq, time + decay);
      gain.gain.setValueAtTime(1.0, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
      osc.connect(gain);
      if (dist) {
          const shaper = ctx.createWaveShaper();
          shaper.curve = makeDistortionCurve(40); 
          shaper.oversample = '4x';
          gain.connect(shaper);
          shaper.connect(dest);
      } else {
          gain.connect(dest);
      }
      osc.start(time);
      osc.stop(time + decay + 0.1);
  };

  const playTrapSnare = (ctx: AudioContext, dest: AudioNode, time: number, freq: number, decay: number, isClap: boolean) => {
      if (!isClap) {
          const osc = ctx.createOscillator();
          const oscGain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq > 0 ? freq : 200, time);
          oscGain.gain.setValueAtTime(0.5, time);
          oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
          osc.connect(oscGain);
          oscGain.connect(dest);
          osc.start(time);
          osc.stop(time + 0.2);
      }
      if (noiseBufferRef.current) {
          const noise = ctx.createBufferSource();
          noise.buffer = noiseBufferRef.current;
          const filter = ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.value = 1200; 
          const noiseGain = ctx.createGain();
          if (isClap) {
              noiseGain.gain.setValueAtTime(0, time);
              noiseGain.gain.linearRampToValueAtTime(0.8, time + 0.001);
              noiseGain.gain.exponentialRampToValueAtTime(0.1, time + 0.010);
              noiseGain.gain.setValueAtTime(0.8, time + 0.015);
              noiseGain.gain.exponentialRampToValueAtTime(0.1, time + 0.025);
              noiseGain.gain.setValueAtTime(0.8, time + 0.030);
              noiseGain.gain.exponentialRampToValueAtTime(0.01, time + decay);
          } else {
              noiseGain.gain.setValueAtTime(0.8, time);
              noiseGain.gain.exponentialRampToValueAtTime(0.01, time + decay);
          }
          noise.connect(filter);
          filter.connect(noiseGain);
          noiseGain.connect(dest);
          noise.start(time);
          noise.stop(time + decay + 0.1);
      }
  };

  const playHiHat = (ctx: AudioContext, dest: AudioNode, time: number, decay: number) => {
      if (noiseBufferRef.current) {
          const noise = ctx.createBufferSource();
          noise.buffer = noiseBufferRef.current;
          const filter = ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.value = 8000; 
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.6, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + (decay < 0.05 ? 0.05 : decay)); 
          noise.connect(filter);
          filter.connect(gain);
          gain.connect(dest);
          noise.start(time);
          noise.stop(time + decay + 0.1);
      }
  };

  const playSynthNote = (ctx: AudioContext, freq: number, time: number, duration: number, type: 'pluck' | 'lead', destination: AudioNode) => {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const safeFreq = freq > 0 ? freq : 1;
    osc1.type = 'sawtooth';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(safeFreq, time);
    osc2.frequency.setValueAtTime(safeFreq * 2, time);
    filter.type = 'lowpass';
    filter.Q.value = 2;
    const startFilterFreq = safeFreq * 6;
    const endFilterFreq = safeFreq * 0.8;
    filter.frequency.setValueAtTime(startFilterFreq > 1 ? startFilterFreq : 1, time);
    filter.frequency.exponentialRampToValueAtTime(endFilterFreq > 0.01 ? endFilterFreq : 0.01, time + (duration * 0.7));
    osc1.connect(filter);
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.5;
    osc2.connect(osc2Gain);
    osc2Gain.connect(gain);
    filter.connect(gain);
    gain.connect(destination);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.4, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 1.5);
    osc1.start(time);
    osc1.stop(time + duration * 1.5);
    osc2.start(time);
    osc2.stop(time + 0.05);
  };

  const playGunCock = (ctx: AudioContext, dest: AudioNode, time: number) => {
      if (noiseBufferRef.current) {
          const noise = ctx.createBufferSource();
          noise.buffer = noiseBufferRef.current;
          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.value = 2500;
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.8, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
          noise.connect(filter);
          filter.connect(gain);
          gain.connect(dest);
          noise.start(time);
          noise.stop(time + 0.15);
      }
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, time);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(time);
      osc.stop(time + 0.05);
  };

  const playGunBlast = (ctx: AudioContext, dest: AudioNode, time: number) => {
      if (noiseBufferRef.current) {
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBufferRef.current;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, time);
        filter.frequency.exponentialRampToValueAtTime(100, time + 0.4);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(1.0, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
        const shaper = ctx.createWaveShaper();
        shaper.curve = makeDistortionCurve(100);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(shaper);
        shaper.connect(dest);
        noise.start(time);
        noise.stop(time + 1.0);
        playTrapKick(ctx, dest, time, 60, 0.3, true, 'square');
      }
  };

  const playTapeStop = (ctx: AudioContext, dest: AudioNode, time: number) => {
    const stopTime = 0.5;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(dest);
    osc.frequency.setValueAtTime(880, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + stopTime);
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.linearRampToValueAtTime(0, time + stopTime + 0.05);
    osc.start(time);
    osc.stop(time + stopTime + 0.1);
    if (noiseBufferRef.current) {
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBufferRef.current;
        const noiseGain = ctx.createGain();
        noise.playbackRate.setValueAtTime(1, time);
        noise.playbackRate.exponentialRampToValueAtTime(0.01, time + stopTime);
        noiseGain.gain.setValueAtTime(0.1, time);
        noiseGain.gain.linearRampToValueAtTime(0, time + stopTime + 0.05);
        noise.connect(noiseGain);
        noiseGain.connect(dest);
        noise.start(time);
        noise.stop(time + stopTime + 0.1);
    }
  };

  const playScratch = (ctx: AudioContext, dest: AudioNode, time: number) => {
      if (noiseBufferRef.current) {
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBufferRef.current;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 8;
        filter.frequency.setValueAtTime(800, time);
        filter.frequency.linearRampToValueAtTime(2000, time + 0.05);
        filter.frequency.linearRampToValueAtTime(500, time + 0.12);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.6, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        noise.start(time);
        noise.stop(time + 0.2);
      }
  };

  const playGeneratedLoop = (padId: number, ctx: AudioContext, dest: AudioNode, time: number) => {
      const t = time;
      const beat = 60 / bpm;
      const bar = beat * 4;
      const loopGain = ctx.createGain();
      loopGain.gain.value = 0.8;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 8;
      loopGain.connect(comp);
      comp.connect(dest);
      const playCleanSynth = (startTime: number, freq: number, dur: number) => {
           playSynthNote(ctx, freq, startTime, dur, 'pluck', loopGain);
      };
      if (padId === 16) {
          for(let i=0; i<32; i++) playHiHat(ctx, loopGain, t + i*(beat/2), 0.03);
          playTrapKick(ctx, loopGain, t, 50, 0.6, true, 'sine');
          playTrapKick(ctx, loopGain, t + beat*1.5, 50, 0.6, true, 'sine');
          playTrapKick(ctx, loopGain, t + beat*2.5, 45, 0.8, true, 'triangle');
          playTrapKick(ctx, loopGain, t + beat*3.25, 40, 0.4, true, 'square');
      } 
      else if (padId === 17) {
          playTrapKick(ctx, loopGain, t, 35, 3.0, true, 'triangle'); 
          playTrapKick(ctx, loopGain, t+bar*2, 30, 3.0, true, 'triangle');
          const chord = (st: number, notes: number[]) => notes.forEach(n => playCleanSynth(st, n, bar));
          chord(t, [144.16, 216.00]);
          chord(t+bar*2, [128.29, 192.43]);
      }
      else if (padId === 18) {
          for(let i=0; i<16; i++) {
              const f = (i%4===0) ? 72 : (i%2===0 ? 108 : 0);
              if(f) playTrapKick(ctx, loopGain, t+i*beat, f, 0.3, true, 'sawtooth');
          }
          playCleanSynth(t, 144, bar*2);
      }
      else if (padId === 19) {
          const noteDuration = beat / 4;
          const riffNotes = [110.00, 130.81, 164.81, 130.81];
          for (let i = 0; i < 64; i++) {
              const noteFreq = riffNotes[i % 4];
              const startTime = t + (i * noteDuration);
              playSynthNote(ctx, noteFreq, startTime, noteDuration * 0.9, 'pluck', loopGain);
          }
          for(let i = 0; i < 16; i++) {
              if(i % 4 === 0) playTrapKick(ctx, loopGain, t + i * beat, 60, 0.5, false, 'sine');
              if(i % 4 === 2) playTrapSnare(ctx, loopGain, t + i * beat, 200, 0.2, false);
          }
      }
  }

  const triggerPad = (padId: number, when: number = 0) => {
      initAudio();
      const ctx = audioCtxRef.current;
      if (!ctx || !compressorRef.current) return;

      const pad = drumPads.find(p => p.id === padId);
      if (!pad) return;

      setActivePadId(padId);
      setTimeout(() => setActivePadId(null), 150);

      const time = when || ctx.currentTime;
      const master = compressorRef.current;
      const freq = pad.baseFrequency * Math.pow(2, pitchBend / 12);

      if (isLoopMode && when === 0) {
          if (activeLoops.has(padId)) {
              const interval = loopIntervalsRef.current.get(padId);
              if (interval) clearInterval(interval);
              loopIntervalsRef.current.delete(padId);
              setActiveLoops(prev => {
                  const next = new Set(prev);
                  next.delete(padId);
                  return next;
              });
              return;
          } else {
              setActiveLoops(prev => new Set(prev).add(padId));
              const beatMs = (60 / bpm) * 1000;
              const loopDurationMs = pad.id >= 16 ? beatMs * 16 : beatMs * 4; 
              
              const interval = window.setInterval(() => {
                   if(audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume();
                   if(audioCtxRef.current && compressorRef.current) {
                      const currentPad = drumPads.find(p => p.id === padId);
                      if (currentPad) {
                         const currentFreq = currentPad.baseFrequency * Math.pow(2, pitchBend / 12);
                         triggerSound(audioCtxRef.current, compressorRef.current, audioCtxRef.current.currentTime, currentPad, currentFreq);
                      }
                   }
              }, loopDurationMs);
              
              loopIntervalsRef.current.set(padId, interval);
          }
      }

      triggerSound(ctx, master, time, pad, freq);
  };

  const triggerSound = (ctx: AudioContext, master: AudioNode, time: number, pad: DrumPadConfig, freq: number) => {
      if (pad.id >= 16) {
           playGeneratedLoop(pad.id, ctx, master, time);
           return;
      }

      if (pad.soundType === 'bass' || pad.soundType === 'kick') {
          playTrapKick(ctx, master, time, freq, pad.pitchDecay, pad.distortion, pad.waveform as any);
      } 
      else if (pad.soundType === 'snare') {
          playTrapSnare(ctx, master, time, freq, pad.volumeDecay, pad.label.toLowerCase().includes('clap'));
      }
      else if (pad.soundType === 'hihat') {
          playHiHat(ctx, master, time, pad.volumeDecay);
      }
      else if (pad.soundType === 'synth') {
          playSynthNote(ctx, freq, time, pad.volumeDecay, 'pluck', master);
      }
      else if (pad.soundType === 'fx') {
            const label = pad.label.toLowerCase();
            if (label.includes('gun') && label.includes('cock')) playGunCock(ctx, master, time);
            else if (label.includes('blast') || label.includes('gun')) playGunBlast(ctx, master, time);
            else if (label.includes('tape stop')) playTapeStop(ctx, master, time);
            else if (label.includes('scratch')) playScratch(ctx, master, time);
            else playTrapKick(ctx, master, time, 100, 0.2, true, 'sawtooth');
      }
  };

  const handlePadDown = (padId: number) => {
      triggerPad(padId);
  };

  const handlePadUp = (padId: number) => {
      // Nothing needed for one-shots
  };

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.repeat) return;
          const key = e.key.toUpperCase();
          const pad = drumPads.find(p => p.keyTrigger === key);
          if (pad) handlePadDown(pad.id);
      };
      const handleKeyUp = (e: KeyboardEvent) => {
          const key = e.key.toUpperCase();
          const pad = drumPads.find(p => p.keyTrigger === key);
          if (pad) handlePadUp(pad.id);
      };
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
      };
  }, [drumPads, pitchBend, isLoopMode, bpm]);

  
  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-2xl animate-fade-in h-full flex flex-col">
      {/* Header / Controls */}
      <div className="flex flex-wrap items-center justify-between mb-4 gap-4 p-2 bg-gray-700/30 rounded-lg">
          <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-bold text-emerald-400 flex items-center">
                  <DrumIcon className="mr-2" />
                  Drum Machine
              </h2>
              <div className="flex items-center space-x-2 bg-gray-900 rounded-lg p-1">
                  <button 
                      onClick={() => setViewMode('PADS')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition ${viewMode === 'PADS' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                      PADS
                  </button>
                  <button 
                      onClick={() => setViewMode('SEQUENCER')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition ${viewMode === 'SEQUENCER' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                      SEQUENCER
                  </button>
                  <button 
                      onClick={() => setViewMode('ARRANGE')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition ${viewMode === 'ARRANGE' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                      ARRANGE
                  </button>
              </div>
          </div>

          <div className="flex items-center space-x-4">
              <div className="flex flex-col items-center">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">BPM</label>
                  <input 
                      type="number" 
                      value={bpm} 
                      onChange={(e) => setBpm(Number(e.target.value))}
                      className="w-16 bg-gray-900 border border-gray-600 rounded text-center text-emerald-400 font-mono font-bold focus:ring-1 focus:ring-emerald-500"
                  />
              </div>
              
              <div className="flex flex-col items-center">
                 <label className="text-[10px] text-gray-400 font-bold uppercase">Pitch</label>
                 <input 
                    type="range" min="-12" max="12" step="1" 
                    value={pitchBend} onChange={(e) => setPitchBend(Number(e.target.value))}
                    className="w-20 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                 />
                 <span className="text-[10px] text-emerald-400">{pitchBend > 0 ? '+' : ''}{pitchBend}</span>
              </div>

              <div className="flex flex-col items-center">
                  <label className="text-[10px] text-gray-400 font-bold uppercase">Volume</label>
                  <div className="flex items-center">
                      <VolumeIcon volume={volume} />
                      <input 
                          type="range" min="0" max="1" step="0.01" 
                          value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))}
                          className="w-20 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-emerald-500 ml-2"
                      />
                  </div>
              </div>
          </div>
          
          <div className="flex items-center space-x-4 border-l border-gray-600 pl-4">
                <div className="flex flex-col items-center">
                    <label className="text-[10px] text-gray-400 font-bold uppercase">Reverb Mix</label>
                    <input 
                        type="range" min="0" max="1" step="0.01" 
                        value={reverbMix} onChange={(e) => setReverbMix(Number(e.target.value))}
                        className="w-20 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <span className="text-[10px] text-emerald-400">{Math.round(reverbMix * 100)}%</span>
                </div>
                <div className="flex flex-col items-center">
                    <label className="text-[10px] text-gray-400 font-bold uppercase">Reverb Decay</label>
                    <input 
                        type="range" min="0.1" max="5" step="0.1" 
                        value={reverbDecay} onChange={(e) => setReverbDecay(Number(e.target.value))}
                        className="w-20 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <span className="text-[10px] text-emerald-400">{reverbDecay.toFixed(1)}s</span>
                </div>
          </div>

          <div className="flex items-center space-x-2">
               <button 
                   onClick={() => setIsLoopMode(!isLoopMode)}
                   className={`flex flex-col items-center justify-center px-3 py-1 rounded border transition-all ${
                       isLoopMode 
                       ? 'bg-yellow-600 border-yellow-500 text-white shadow-[0_0_10px_rgba(202,138,4,0.5)]' 
                       : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'
                   }`}
                   title="Loop Mode: Click pads to toggle continuous play"
               >
                   <span className="font-black text-xs">LOOP</span>
                   <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isLoopMode ? 'bg-white' : 'bg-gray-600'}`}></div>
               </button>
               
               <button 
                    onClick={isAudioRecording ? stopAudioRecording : startAudioRecording}
                    className={`flex items-center justify-center px-3 py-1 rounded border font-bold text-xs transition-all ${
                        isAudioRecording 
                        ? 'bg-red-600 border-red-500 text-white animate-pulse shadow-[0_0_10px_rgba(220,38,38,0.8)]' 
                        : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white hover:border-red-500'
                    }`}
               >
                   <MicIcon />
                   <span className="ml-1">{isAudioRecording ? formatRecordingTime(recordingTime) : 'REC AUDIO'}</span>
               </button>

               <div className="h-6 w-px bg-gray-600 mx-2"></div>
               
               <div className="flex items-center">
                    <select
                        value={selectedKitId}
                        onChange={(e) => handleKitSelectionChange(e.target.value)}
                        className={`bg-gray-900 border border-gray-600 px-2 py-1.5 text-xs text-white focus:outline-none max-w-[150px] ${selectedKitId !== 'default' ? 'rounded-l-md' : 'rounded-md'}`}
                    >
                        <option value="default">Default Kit</option>
                        {savedKits.map(kit => (
                            <option key={kit.id} value={kit.id}>{kit.name}</option>
                        ))}
                        <option value="__SAVE_NEW_KIT__" className="italic text-emerald-400 bg-gray-800 mt-1 pt-1 border-t border-gray-700">
                            + Save current kit...
                        </option>
                    </select>
                    {selectedKitId !== 'default' && (
                        <button
                            onClick={() => handleDeleteKit(selectedKitId)}
                            className="bg-gray-800 border border-l-0 border-gray-600 rounded-r-md p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-700"
                            title="Delete selected kit"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
          </div>
      </div>

      {/* Main View */}
      <div className="flex-1 overflow-y-auto bg-gray-900 rounded-lg p-4 border border-gray-700 shadow-inner relative">
          {isLoopMode && (
              <div className="absolute top-2 right-2 bg-yellow-600/20 border border-yellow-500 text-yellow-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider pointer-events-none z-20">
                  Loop Mode Active
              </div>
          )}

          {viewMode === 'PADS' && (
              <div className="grid grid-cols-4 gap-4 h-full">
                  {drumPads.map((pad) => (
                      <button
                          key={pad.id}
                          onPointerDown={(e) => { e.preventDefault(); handlePadDown(pad.id); }}
                          onPointerUp={(e) => { e.preventDefault(); handlePadUp(pad.id); }}
                          onPointerLeave={(e) => { e.preventDefault(); handlePadUp(pad.id); }}
                          onClick={(e) => e.preventDefault()}
                          className={`relative rounded-xl shadow-lg transition-all duration-75 border-b-4 active:border-b-0 active:translate-y-1 flex flex-col items-center justify-center p-2 group touch-none select-none
                              ${activePadId === pad.id ? 'border-white ring-4 ring-emerald-400/50 z-10 scale-95' : 'border-black/30'}
                              ${activeLoops.has(pad.id) ? 'ring-2 ring-yellow-400 bg-blend-overlay brightness-125' : ''}
                              ${pad.color}
                          `}
                      >
                          <span className="text-2xl font-black text-white/90 drop-shadow-md mb-1 select-none">{pad.keyTrigger}</span>
                          <span className="text-xs font-medium text-white/70 uppercase tracking-wider select-none text-center leading-tight">{pad.label}</span>
                          {pad.id >= 16 && <span className="text-[9px] text-white/50 absolute bottom-1">(LOOP)</span>}
                          
                          {activeLoops.has(pad.id) && (
                              <div className="absolute top-2 left-2">
                                  <div className="w-2 h-2 rounded-full bg-yellow-400 animate-ping"></div>
                              </div>
                          )}
                          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white/30 group-hover:bg-white/80"></div>
                      </button>
                  ))}
              </div>
          )}
          
          {viewMode === 'SEQUENCER' && (
              <div className="space-y-2">
                   <div className="flex justify-between items-center mb-4 sticky top-0 bg-gray-900 z-10 pb-2 border-b border-gray-700">
                       <div className="flex space-x-2 items-center">
                           <button 
                               onClick={handleToggleSequencePlayback}
                               className={`flex items-center px-4 py-2 rounded font-bold text-white shadow-lg transition ${isPlayingSequence ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                           >
                               {isPlayingSequence ? <StopIcon className="mr-2" /> : <PlayIcon className="mr-2" />}
                               {isPlayingSequence ? 'STOP' : 'PLAY'}
                           </button>
                           
                           <button onClick={clearSequencer} className="px-3 py-2 bg-gray-700 text-gray-300 hover:text-white rounded font-bold text-xs">CLEAR</button>
                           <button onClick={() => setIsGenerateModalOpen(true)} className="px-3 py-2 bg-purple-800 text-purple-200 hover:bg-purple-700 rounded font-bold text-xs flex items-center">
                                <MagicIcon className="w-4 h-4 mr-1" />
                                GENERATE
                           </button>
                       </div>
                       <div className="flex space-x-2">
                            <button onClick={() => setIsPatternModalOpen(true)} className="p-2 bg-gray-700 text-emerald-400 rounded hover:bg-gray-600"><SaveIcon className="w-5 h-5" /></button>
                            <div className="relative">
                                <button onClick={() => document.getElementById('pattern-dropdown')?.classList.toggle('hidden')} className="p-2 bg-gray-700 text-emerald-400 rounded hover:bg-gray-600">
                                    <FolderOpenIcon className="w-5 h-5" />
                                </button>
                                <div id="pattern-dropdown" className="hidden absolute right-0 top-full mt-2 w-48 bg-gray-800 border border-gray-600 rounded shadow-xl z-20">
                                    {savedPatterns.length === 0 && <div className="p-2 text-xs text-gray-500">No saved patterns</div>}
                                    {savedPatterns.map(p => (
                                        <div key={p.id} className="flex justify-between items-center p-2 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-0">
                                            <span onClick={() => handleLoadPattern(p)} className="text-xs text-white flex-1">{p.name} ({p.bpm} BPM)</span>
                                            <span onClick={(e) => {e.stopPropagation(); handleDeletePattern(p.id)}} className="text-red-500 hover:text-red-300 font-bold px-2">×</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                       </div>
                   </div>

                   <div className="overflow-x-auto pb-4">
                       <div className="min-w-[800px]">
                           <div className="flex mb-1 ml-24">
                               {Array.from({ length: 16 }).map((_, i) => (
                                   <div key={i} className={`flex-1 h-1 mx-0.5 rounded-full transition-colors ${isPlayingSequence && currentStep === i ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-gray-700'}`}></div>
                               ))}
                           </div>
                           
                           {drumPads.slice(0, 20).map((pad) => (
                               <div key={pad.id} className="flex items-center mb-1 group hover:bg-gray-800/50 rounded p-1">
                                   <div className="w-24 flex-shrink-0 flex items-center">
                                       <div className={`w-3 h-3 rounded-full mr-2 ${pad.color}`}></div>
                                       <span className="text-xs font-bold text-gray-400 truncate w-16" title={pad.label}>{pad.label}</span>
                                   </div>
                                   <div className="flex-1 flex justify-between">
                                       {Array.from({ length: 16 }).map((_, stepIndex) => (
                                           <button
                                               key={stepIndex}
                                               onClick={() => toggleSequencerStep(pad.id, stepIndex)}
                                               className={`w-full aspect-square mx-0.5 rounded-sm transition-all duration-100
                                                   ${sequencerGrid[pad.id]?.[stepIndex] ? pad.color : 'bg-gray-800 hover:bg-gray-700'}
                                                   ${isPlayingSequence && currentStep === stepIndex ? 'ring-1 ring-white brightness-150' : ''}
                                               `}
                                           ></button>
                                       ))}
                                   </div>
                               </div>
                           ))}
                       </div>
                   </div>
              </div>
          )}

          {viewMode === 'ARRANGE' && (
              <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-700">
                      <h3 className="text-xl font-bold text-emerald-400">Song Arranger</h3>
                      <button 
                          onClick={handlePlaySong}
                          className={`flex items-center px-4 py-2 rounded font-bold text-white shadow-lg transition ${isPlayingSong ? 'bg-red-600' : 'bg-emerald-600'}`}
                      >
                           {isPlayingSong ? <StopIcon className="mr-2" /> : <PlayIcon className="mr-2" />}
                           {isPlayingSong ? 'STOP SONG' : 'PLAY SONG'}
                      </button>
                  </div>

                  <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                      <h4 className="font-bold text-white mb-2">Add Section</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <input type="text" value={newSectionForm.name} onChange={e => setNewSectionForm({...newSectionForm, name: e.target.value})} placeholder="Section Name (e.g., Verse)" className="bg-gray-700 p-2 rounded text-sm"/>
                          <select value={newSectionForm.patternId} onChange={e => setNewSectionForm({...newSectionForm, patternId: e.target.value})} className="bg-gray-700 p-2 rounded text-sm">
                              <option value="">Select Pattern...</option>
                              {savedPatterns.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <div className="flex items-center">
                              <input type="number" value={newSectionForm.repetitions} onChange={e => setNewSectionForm({...newSectionForm, repetitions: parseInt(e.target.value) || 1})} min="1" className="bg-gray-700 p-2 rounded w-20 text-sm"/>
                              <span className="ml-2 text-sm text-gray-400">reps</span>
                          </div>
                      </div>
                      <button onClick={handleAddSection} className="mt-3 w-full bg-emerald-600 text-white font-bold py-2 rounded hover:bg-emerald-500">Add to Arrangement</button>
                  </div>

                  <div>
                      <h4 className="font-bold text-white mb-2">Timeline</h4>
                      <div className="space-y-2">
                           {currentArrangement.sections.length === 0 ? (
                               <p className="text-gray-500 text-center py-4">Your song structure will appear here.</p>
                           ) : currentArrangement.sections.map((section, index) => (
                                <div key={section.id} className={`p-3 rounded-lg border flex items-center justify-between transition-all ${isPlayingSong && index === currentSectionIndex ? 'bg-emerald-900/50 border-emerald-500' : 'bg-gray-800 border-gray-700'}`}>
                                    <div>
                                        <h5 className="font-bold text-white">{section.name}</h5>
                                        <p className="text-xs text-gray-400">Pattern: "{savedPatterns.find(p => p.id === section.patternId)?.name || 'N/A'}" | Repeats: {section.repetitions} times</p>
                                    </div>
                                    <button onClick={() => handleDeleteSection(section.id)} className="text-red-500 p-1"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            ))}
                      </div>
                  </div>
              </div>
          )}
      </div>
      
      {/* Modals */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-emerald-500/30 w-80">
                <h3 className="text-lg font-bold text-emerald-400 mb-4">Save Custom Kit</h3>
                <input 
                    type="text" 
                    placeholder="Kit Name" 
                    value={newKitName}
                    onChange={(e) => setNewKitName(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white mb-4 focus:border-emerald-500 focus:outline-none"
                    autoFocus
                />
                <div className="flex justify-end space-x-2">
                    <button onClick={() => setIsSaveModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                    <button onClick={handleSaveKit} className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500">Save</button>
                </div>
            </div>
        </div>
      )}
      
      {isGenerateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-purple-500/30 w-96">
                <h3 className="text-lg font-bold text-purple-400 mb-4 flex items-center"><MagicIcon className="w-5 h-5 mr-2"/>Generate Pattern</h3>
                <p className="text-sm text-gray-400 mb-4">Describe the kind of beat you want, and the AI will generate a pattern for you.</p>
                <textarea
                    placeholder="e.g., A classic 90s hip-hop beat, a fast drum and bass pattern, a minimal lo-fi rhythm..."
                    value={generatePrompt}
                    onChange={(e) => setGeneratePrompt(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white mb-4 h-24 focus:border-purple-500 focus:outline-none"
                    autoFocus
                />
                <div className="flex justify-end space-x-2">
                    <button onClick={() => setIsGenerateModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                    <button onClick={handleGeneratePattern} disabled={isGenerating} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-500 disabled:opacity-50 flex items-center">
                        {isGenerating && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>}
                        {isGenerating ? 'Generating...' : 'Generate'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {isPatternModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-emerald-500/30 w-80">
                <h3 className="text-lg font-bold text-emerald-400 mb-4">Save Pattern</h3>
                <input 
                    type="text"
                    placeholder="Pattern Name" 
                    value={patternName}
                    onChange={(e) => setPatternName(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white mb-4 focus:border-emerald-500 focus:outline-none"
                    autoFocus
                />
                <div className="flex justify-end space-x-2">
                    <button onClick={() => setIsPatternModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button>
                    <button onClick={handleSavePattern} className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500">Save</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default DrumMachine;
