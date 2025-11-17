
export enum AppView {
  VoiceLab = 'VOICE_LAB',
  Studio = 'STUDIO',
  Chat = 'CHAT',
  ModelManager = 'MODEL_MANAGER',
}

export interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
}
