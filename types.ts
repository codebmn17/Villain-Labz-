export enum AppView {
  VoiceLab = 'VOICE_LAB',
  Studio = 'STUDIO',
  Chat = 'CHAT',
  ModelManager = 'MODEL_MANAGER',
  SpotifyConnect = 'SPOTIFY_CONNECT',
  Storage = 'STORAGE',
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

export interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
}

export interface AudioPlaylistItem {
  src: string;
  title: string;
  artist: string;
}
