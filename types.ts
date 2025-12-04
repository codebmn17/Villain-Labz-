

export enum AppView {
  VoiceLab = 'VOICE_LAB',
  Studio = 'STUDIO',
  Chat = 'CHAT',
  ModelManager = 'MODEL_MANAGER',
  SpotifyConnect = 'SPOTIFY_CONNECT',
  Storage = 'STORAGE',
  DrumMachine = 'DRUM_MACHINE',
  YouTube = 'YOUTUBE',
  CodeLab = 'CODE_LAB',
  FacebookConnect = 'FACEBOOK_CONNECT',
}

export enum StudioMode {
  Original = 'ORIGINAL',
  Cover = 'COVER',
}

export type AiModel = 'gemini' | 'openai' | 'claude' | 'ninja' | 'custom';

export interface ClonedVoice {
  id: string;
  name: string;
  file?: File; // Optional now, as fetched voices won't have the source file locally
  previewUrl?: string;
  description?: string;
  cloneDate: string;
  category?: string; // 'cloned' | 'premade'
}

export interface ChatAttachment {
  name: string;
  mimeType: string;
  data?: string; // Base64 for small files
  fileUri?: string; // URI for large files uploaded to Gemini
  isUploading?: boolean; // UI state
  error?: string;
  originalFile?: File; // Reference for local tool usage
}

export interface AudioPlaylistItem {
  id: string;
  src: string;
  title: string;
  artist: string;
  createdAt?: number; // Timestamp
  size?: number; // Bytes
  type?: string; // 'wav' | 'mp3' etc
}

export interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  attachments?: ChatAttachment[];
  audioTrack?: AudioPlaylistItem; // Track generated in this message
  svgContent?: string; // For rendering sheet music, etc.
  htmlContent?: string; // For rendering rich HTML content
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

export interface SongSection {
  id: string;
  name: string;
  patternId: string;
  repetitions: number;
}

export interface SongArrangement {
  id: string;
  name: string;
  sections: SongSection[];
}

export interface YouTubeResult {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  url: string;
}

// Mock user type for Facebook Connect
export interface FacebookUser {
    id: string;
    name: string;
    pictureUrl: string;
}

export interface AppController {
  // State
  currentView: AppView;
  activeModel: AiModel;
  clonedVoices: ClonedVoice[];
  elevenLabsKey: string;
  openAIKey: string;
  claudeKey: string;
  ninjaKey: string;
  customModel: File | null;
  customModelName: string;
  isDjActive: boolean;
  isAiVoiceEnabled: boolean;
  generatedTracks: AudioPlaylistItem[];
  isOnline: boolean;
  drumPads: DrumPadConfig[];
  reverbMix: number;
  reverbDecay: number;
  codeLabContent: string;
  runCodeLabTrigger: number;
  bpm: number;
  sequencerGrid: Record<number, boolean[]>;
  savedPatterns: SequencerPattern[];
  savedArrangements: SongArrangement[];
  isFacebookConnected: boolean;
  facebookAppId: string;
  facebookUser: FacebookUser | null;
  // Setters
  setCurrentView: (view: AppView) => void;
  setActiveModel: (model: AiModel) => void;
  setClonedVoices: (voices: ClonedVoice[]) => void;
  setElevenLabsKey: (key: string) => void;
  setOpenAIKey: (key: string) => void;
  setClaudeKey: (key: string) => void;
  setNinjaKey: (key: string) => void;
  setCustomModel: (file: File | null) => void;
  setCustomModelName: (name: string) => void;
  setIsDjActive: (isActive: boolean) => void;
  setIsAiVoiceEnabled: (enabled: boolean) => void;
  setGeneratedTracks: (tracks: AudioPlaylistItem[]) => void;
  setDrumPads: (pads: DrumPadConfig[]) => void;
  setReverbMix: (mix: number) => void;
  setReverbDecay: (decay: number) => void;
  setCodeLabContent: (content: string) => void;
  setRunCodeLabTrigger: (updater: (prev: number) => number) => void;
  setBpm: (bpm: number) => void;
  setSequencerGrid: (grid: Record<number, boolean[]>) => void;
  setSavedPatterns: (patterns: SequencerPattern[]) => void;
  setSavedArrangements: (arrangements: SongArrangement[]) => void;
  setIsFacebookConnected: (connected: boolean) => void;
  setFacebookAppId: (appId: string) => void;
  setFacebookUser: (user: FacebookUser | null) => void;
  // Navigation Props (Optional for data passing)
  navProps?: any;
  setNavProps?: (props: any) => void;
}