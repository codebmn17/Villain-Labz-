import React, { useState } from 'react';
import SideNav from './components/SideNav';
import VoiceLab from './components/VoiceLab';
import Studio from './components/Studio';
import Chat from './components/Chat';
import ModelManager from './components/ModelManager';
import { AppView } from './types';
import SpotifyConnect from './components/SpotifyConnect';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.Studio);
  const [clonedVoice, setClonedVoice] = useState<File | null>(null);
  const [elevenLabsKey, setElevenLabsKey] = useState<string>('');
  const [customModel, setCustomModel] = useState<File | null>(null);

  const renderView = () => {
    switch (currentView) {
      case AppView.VoiceLab:
        return <VoiceLab setClonedVoice={setClonedVoice} clonedVoice={clonedVoice} />;
      case AppView.Studio:
        return <Studio clonedVoice={clonedVoice} elevenLabsKey={elevenLabsKey} />;
      case AppView.Chat:
        return <Chat />;
      case AppView.ModelManager:
        return (
          <ModelManager
            elevenLabsKey={elevenLabsKey}
            setElevenLabsKey={setElevenLabsKey}
            customModel={customModel}
            setCustomModel={setCustomModel}
          />
        );
      case AppView.SpotifyConnect:
        return <SpotifyConnect />;
      default:
        return <Studio clonedVoice={clonedVoice} elevenLabsKey={elevenLabsKey} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 font-sans">
      <SideNav currentView={currentView} setCurrentView={setCurrentView} />
      <main className="flex-1 p-2 sm:p-4 lg:p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {renderView()}
        </div>
      </main>
    </div>
  );
};

export default App;