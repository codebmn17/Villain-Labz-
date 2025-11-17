import React, { useState, useEffect } from 'react';
import SideNav from './components/SideNav';
import VoiceLab from './components/VoiceLab';
import Studio from './components/Studio';
import Chat from './components/Chat';
import ModelManager from './components/ModelManager';
import { AppView, ClonedVoice, AudioPlaylistItem } from './types';
import SpotifyConnect from './components/SpotifyConnect';
import Storage from './components/Storage';

export interface AppController {
  // State
  currentView: AppView;
  clonedVoices: ClonedVoice[];
  elevenLabsKey: string;
  customModel: File | null;
  isDjActive: boolean;
  generatedTracks: AudioPlaylistItem[];
  isOnline: boolean;
  // Setters
  setCurrentView: (view: AppView) => void;
  setClonedVoices: (voices: ClonedVoice[]) => void;
  setElevenLabsKey: (key: string) => void;
  setCustomModel: (file: File | null) => void;
  setIsDjActive: (isActive: boolean) => void;
  setGeneratedTracks: (tracks: AudioPlaylistItem[]) => void;
}


const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.Studio);
  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);
  const [elevenLabsKey, setElevenLabsKey] = useState<string>('');
  const [customModel, setCustomModel] = useState<File | null>(null);
  const [isDjActive, setIsDjActive] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [generatedTracks, setGeneratedTracks] = useState<AudioPlaylistItem[]>([]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const appController: AppController = {
    currentView,
    clonedVoices,
    elevenLabsKey,
    customModel,
    isDjActive,
    generatedTracks,
    isOnline,
    setCurrentView,
    setClonedVoices,
    setElevenLabsKey,
    setCustomModel,
    setIsDjActive,
    setGeneratedTracks,
  };


  const renderView = () => {
    switch (currentView) {
      case AppView.VoiceLab:
        return <VoiceLab setClonedVoices={setClonedVoices} clonedVoices={clonedVoices} />;
      case AppView.Studio:
        return <Studio clonedVoices={clonedVoices} elevenLabsKey={elevenLabsKey} generatedTracks={generatedTracks} setGeneratedTracks={setGeneratedTracks} />;
      case AppView.Chat:
        return <Chat appController={appController} />;
      case AppView.ModelManager:
        return (
          <ModelManager
            elevenLabsKey={elevenLabsKey}
            setElevenLabsKey={setElevenLabsKey}
            customModel={customModel}
            setCustomModel={setCustomModel}
            isDjActive={isDjActive}
          />
        );
      case AppView.Storage:
        return <Storage generatedTracks={generatedTracks} setGeneratedTracks={setGeneratedTracks} />;
      case AppView.SpotifyConnect:
        return <SpotifyConnect />;
      default:
        return <Studio clonedVoices={clonedVoices} elevenLabsKey={elevenLabsKey} generatedTracks={generatedTracks} setGeneratedTracks={setGeneratedTracks} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 font-sans">
      <SideNav currentView={currentView} setCurrentView={setCurrentView} isOnline={isOnline} />
      <main className="flex-1 p-2 sm:p-4 lg:p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {renderView()}
        </div>
      </main>
    </div>
  );
};

export default App;
