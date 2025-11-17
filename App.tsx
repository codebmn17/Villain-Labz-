import React, { useState, useEffect } from 'react';
import SideNav from './components/SideNav';
import VoiceLab from './components/VoiceLab';
import Studio from './components/Studio';
import Chat from './components/Chat';
import ModelManager from './components/ModelManager';
import { AppView, ClonedVoice } from './types';
import SpotifyConnect from './components/SpotifyConnect';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.Studio);
  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);
  const [elevenLabsKey, setElevenLabsKey] = useState<string>('');
  const [customModel, setCustomModel] = useState<File | null>(null);
  const [isDjActive, setIsDjActive] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

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

  const renderView = () => {
    switch (currentView) {
      case AppView.VoiceLab:
        return <VoiceLab setClonedVoices={setClonedVoices} clonedVoices={clonedVoices} />;
      case AppView.Studio:
        return <Studio clonedVoices={clonedVoices} elevenLabsKey={elevenLabsKey} />;
      case AppView.Chat:
        return <Chat isDjActive={isDjActive} />;
      case AppView.ModelManager:
        return (
          <ModelManager
            elevenLabsKey={elevenLabsKey}
            setElevenLabsKey={setElevenLabsKey}
            customModel={customModel}
            setCustomModel={setCustomModel}
            isDjActive={isDjActive}
            setIsDjActive={setIsDjActive}
          />
        );
      case AppView.SpotifyConnect:
        return <SpotifyConnect />;
      default:
        return <Studio clonedVoices={clonedVoices} elevenLabsKey={elevenLabsKey} />;
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