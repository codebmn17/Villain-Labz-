
import React, { useState, useEffect } from 'react';
import SideNav from './components/SideNav';
import VoiceLab from './components/VoiceLab';
import Studio from './components/Studio';
import Chat from './components/Chat';
import ModelManager from './components/ModelManager';
import { AppView, ClonedVoice, AudioPlaylistItem, DrumPadConfig, AppController } from './types';
import SpotifyConnect from './components/SpotifyConnect';
import Storage from './components/Storage';
import DrumMachine from './components/DrumMachine';

// Hardcore Rap / Sub-Woofer Configuration (5x4 Grid)
const DEFAULT_PADS: DrumPadConfig[] = [
  // Row 0 (Keys 5-8): DEEP BASS 808s (Single Shots)
  { id: 0, keyTrigger: '5', label: 'Spinz 808', color: 'bg-emerald-900', soundType: 'bass', baseFrequency: 38, pitchDecay: 0.08, volumeDecay: 2.5, waveform: 'sine', noise: false, distortion: true },
  { id: 1, keyTrigger: '6', label: 'Sub Woofer', color: 'bg-emerald-800', soundType: 'bass', baseFrequency: 32, pitchDecay: 0.02, volumeDecay: 3.5, waveform: 'sine', noise: false, distortion: false },
  { id: 2, keyTrigger: '7', label: 'Punch 808', color: 'bg-emerald-700', soundType: 'bass', baseFrequency: 42, pitchDecay: 0.12, volumeDecay: 1.5, waveform: 'triangle', noise: false, distortion: true },
  { id: 3, keyTrigger: '8', label: 'Drill Glide', color: 'bg-emerald-600', soundType: 'bass', baseFrequency: 35, pitchDecay: 0.5, volumeDecay: 2.0, waveform: 'sine', noise: false, distortion: true },
  
  // Row 1 (Keys 1-4): RAP PERCUSSION (One Shots)
  { id: 4, keyTrigger: '1', label: 'Trap Clap', color: 'bg-orange-800', soundType: 'snare', baseFrequency: 0, pitchDecay: 0, volumeDecay: 0.2, waveform: 'square', noise: true, distortion: false },
  { id: 5, keyTrigger: '2', label: 'Hard Snare', color: 'bg-orange-700', soundType: 'snare', baseFrequency: 200, pitchDecay: 0.1, volumeDecay: 0.25, waveform: 'triangle', noise: true, distortion: true },
  { id: 6, keyTrigger: '3', label: 'Hi-Hat Closed', color: 'bg-orange-600', soundType: 'hihat', baseFrequency: 0, pitchDecay: 0, volumeDecay: 0.05, waveform: 'square', noise: true, distortion: false },
  { id: 7, keyTrigger: '4', label: 'Hi-Hat Open', color: 'bg-orange-500', soundType: 'hihat', baseFrequency: 0, pitchDecay: 0, volumeDecay: 0.4, waveform: 'square', noise: true, distortion: false },
  
  // Row 2 (Keys Q-R): MELODIC SCALES (D Minor)
  { id: 8, keyTrigger: 'Q', label: 'Pluck D3', color: 'bg-purple-900', soundType: 'synth', baseFrequency: 146.83, pitchDecay: 0, volumeDecay: 0.5, waveform: 'sawtooth', noise: false, distortion: false },
  { id: 9, keyTrigger: 'W', label: 'Pluck F3', color: 'bg-purple-800', soundType: 'synth', baseFrequency: 174.61, pitchDecay: 0, volumeDecay: 0.5, waveform: 'sawtooth', noise: false, distortion: false },
  { id: 10, keyTrigger: 'E', label: 'Pluck G3', color: 'bg-purple-700', soundType: 'synth', baseFrequency: 196.00, pitchDecay: 0, volumeDecay: 0.5, waveform: 'sawtooth', noise: false, distortion: false },
  { id: 11, keyTrigger: 'R', label: 'Pluck A3', color: 'bg-purple-600', soundType: 'synth', baseFrequency: 220.00, pitchDecay: 0, volumeDecay: 0.5, waveform: 'sawtooth', noise: false, distortion: false },
  
  // Row 3 (Keys A-F): STREET FX
  { id: 12, keyTrigger: 'A', label: 'Gun Cock', color: 'bg-blue-900', soundType: 'fx', baseFrequency: 0, pitchDecay: 0, volumeDecay: 0.3, waveform: 'sawtooth', noise: true, distortion: false },
  { id: 13, keyTrigger: 'S', label: 'Gun Blast', color: 'bg-blue-800', soundType: 'fx', baseFrequency: 0, pitchDecay: 0, volumeDecay: 0.6, waveform: 'sawtooth', noise: true, distortion: true },
  { id: 14, keyTrigger: 'D', label: 'Cop Siren', color: 'bg-blue-700', soundType: 'fx', baseFrequency: 0, pitchDecay: 0, volumeDecay: 2.0, waveform: 'sine', noise: false, distortion: true },
  { id: 15, keyTrigger: 'F', label: 'Vinyl Scratch', color: 'bg-blue-600', soundType: 'fx', baseFrequency: 800, pitchDecay: 0.1, volumeDecay: 0.15, waveform: 'triangle', noise: true, distortion: false },
  
  // Row 4 (Keys Z-V): FULL LENGTH 4-BAR LOOPS
  { id: 16, keyTrigger: 'Z', label: 'Chopper Speed', color: 'bg-red-900', soundType: 'fx', baseFrequency: 0, pitchDecay: 0, volumeDecay: 8, waveform: 'sawtooth', noise: false, distortion: true },
  { id: 17, keyTrigger: 'X', label: 'Shady Dirge', color: 'bg-red-800', soundType: 'fx', baseFrequency: 0, pitchDecay: 0, volumeDecay: 8, waveform: 'square', noise: false, distortion: true },
  { id: 18, keyTrigger: 'C', label: 'Detroit Rock', color: 'bg-red-700', soundType: 'fx', baseFrequency: 0, pitchDecay: 0, volumeDecay: 8, waveform: 'sawtooth', noise: true, distortion: true },
  { id: 19, keyTrigger: 'V', label: 'Worldwide', color: 'bg-red-600', soundType: 'fx', baseFrequency: 600, pitchDecay: 1.5, volumeDecay: 8, waveform: 'sine', noise: false, distortion: true },
];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.Studio);
  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);
  const [elevenLabsKey, setElevenLabsKey] = useState<string>('');
  const [openAIKey, setOpenAIKey] = useState<string>('');
  const [claudeKey, setClaudeKey] = useState<string>('');
  const [ninjaKey, setNinjaKey] = useState<string>('');
  const [customModel, setCustomModel] = useState<File | null>(null);
  const [isDjActive, setIsDjActive] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [generatedTracks, setGeneratedTracks] = useState<AudioPlaylistItem[]>([]);
  const [drumPads, setDrumPads] = useState<DrumPadConfig[]>(DEFAULT_PADS);

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
    openAIKey,
    claudeKey,
    ninjaKey,
    customModel,
    isDjActive,
    generatedTracks,
    isOnline,
    drumPads,
    setCurrentView,
    setClonedVoices,
    setElevenLabsKey,
    setOpenAIKey,
    setClaudeKey,
    setNinjaKey,
    setCustomModel,
    setIsDjActive,
    setGeneratedTracks,
    setDrumPads,
  };


  const renderView = () => {
    switch (currentView) {
      case AppView.VoiceLab:
        return <VoiceLab setClonedVoices={setClonedVoices} clonedVoices={clonedVoices} />;
      case AppView.Studio:
        return <Studio clonedVoices={clonedVoices} elevenLabsKey={elevenLabsKey} generatedTracks={generatedTracks} setGeneratedTracks={setGeneratedTracks} />;
      case AppView.DrumMachine:
        return <DrumMachine drumPads={drumPads} setDrumPads={setDrumPads} generatedTracks={generatedTracks} setGeneratedTracks={setGeneratedTracks} defaultPads={DEFAULT_PADS} />;
      case AppView.Chat:
        return <Chat appController={appController} />;
      case AppView.ModelManager:
        return (
          <ModelManager
            elevenLabsKey={elevenLabsKey}
            setElevenLabsKey={setElevenLabsKey}
            openAIKey={openAIKey}
            setOpenAIKey={setOpenAIKey}
            claudeKey={claudeKey}
            setClaudeKey={setClaudeKey}
            ninjaKey={ninjaKey}
            setNinjaKey={setNinjaKey}
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
