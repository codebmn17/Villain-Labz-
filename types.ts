export enum AppView {
  VoiceLab = 'VOICE_LAB',
  Studio = 'STUDIO',
  Chat = 'CHAT',
  ModelManager = 'MODEL_MANAGER',
  SpotifyConnect = 'SPOTIFY_CONNECT',
}

export interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
}
