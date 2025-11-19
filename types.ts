

export enum AppView {
  VoiceLab = 'VOICE_LAB',
  Studio = 'STUDIO',
  Chat = 'CHAT',
  ModelManager = 'MODEL_MANAGER',
  SpotifyConnect = 'SPOTIFY_CONNECT',
  Storage = 'STORAGE',
  DrumMachine = 'DRUM_MACHINE',
}

export enum StudioMode {
  Original = 'ORIGINAL',
  Cover = 'COVER',
}

export interface ClonedVoice {
  id: string;
  name: string;
  file: File;
  cloneDate: string;
}

export interface ChatAttachment {
  name: string;
  mimeType: string;
  data: string; // Base64
}

export interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  attachments?: ChatAttachment[];
}

export interface AudioPlaylistItem {
  id: string;
  src: string;
  title: string;
  artist: string;
}

export type SoundType = 'kick' | 'snare' | 'hihat' | 'bass' | 'fx' | 'synth';

export interface DrumPadConfig {
  id: number;
  keyTrigger: string;
  label: string;
  color: string;
  soundType: SoundType;
  baseFrequency: number; // Hz
  pitchDecay: number; // Seconds
  volumeDecay: number; // Seconds
  waveform: 'sine' | 'square' | 'sawtooth' | 'triangle';
  noise: boolean; // Mix in noise (for snares/hats)
  distortion: boolean; // Add distortion
}

export interface DrumKit {
  id: string;
  name: string;
  pads: DrumPadConfig[];
}

export interface SequencerPattern {
  id: string;
  name: string;
  bpm: number;
  grid: Record<number, boolean[]>; // PadId -> [16 steps]
}

export interface AppController {
  // State
  currentView: AppView;
  clonedVoices: ClonedVoice[];
  elevenLabsKey: string;
  openAIKey: string;
  claudeKey: string;
  ninjaKey: string;
  customModel: File | null;
  isDjActive: boolean;
  generatedTracks: AudioPlaylistItem[];
  isOnline: boolean;
  drumPads: DrumPadConfig[];
  // Setters
  setCurrentView: (view: AppView) => void;
  setClonedVoices: (voices: ClonedVoice[]) => void;
  setElevenLabsKey: (key: string) => void;
  setOpenAIKey: (key: string) => void;
  setClaudeKey: (key: string) => void;
  setNinjaKey: (key: string) => void;
  setCustomModel: (file: File | null) => void;
  setIsDjActive: (isActive: boolean) => void;
  setGeneratedTracks: (tracks: AudioPlaylistItem[]) => void;
  setDrumPads: (pads: DrumPadConfig[]) => void;
}