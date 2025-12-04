
import React from 'react';
import { AppView } from '../types';
import { MicIcon } from './icons/MicIcon';
import { MusicIcon } from './icons/MusicIcon';
import { ChatIcon } from './icons/ChatIcon';
import { CogIcon } from './icons/CogIcon';
import { SpotifyIcon } from './icons/SpotifyIcon';
import { StorageIcon } from './icons/StorageIcon';
import { DrumIcon } from './icons/DrumIcon';
import { YouTubeIcon } from './icons/YouTubeIcon';
import { CodeIcon } from './icons/CodeIcon';
import { FacebookIcon } from './icons/FacebookIcon';

interface SideNavProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  isOnline: boolean;
}

const NavItem: React.FC<{
  view: AppView;
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  icon: React.ReactNode;
  label: string;
}> = ({ view, currentView, setCurrentView, icon, label }) => {
  const isActive = currentView === view;
  return (
    <button
      onClick={() => setCurrentView(view)}
      className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start w-full p-2 my-1 rounded-lg transition-all duration-200 group ${
        isActive ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
      }`}
      aria-label={label}
    >
      {icon}
      <span className="mt-1 sm:mt-0 sm:ml-3 text-xs sm:text-sm font-medium sm:opacity-0 sm:group-hover:opacity-100 sm:group-hover:block transition-opacity duration-300 hidden">{label}</span>
       <span className="sm:hidden text-xs mt-1">{label}</span>
    </button>
  );
};

const SideNav: React.FC<SideNavProps> = ({ currentView, setCurrentView, isOnline }) => {
  return (
    <nav className="bg-gray-800 p-2 flex flex-col justify-between items-center shadow-2xl w-20 sm:w-20 sm:hover:w-56 transition-all duration-300 group overflow-hidden">
      <div>
        <div className="p-2 mb-4">
          <h1 className="text-3xl font-black text-red-600 [text-shadow:0_0_5px_rgba(220,38,38,0.5)] text-center sm:text-left">
            <span>V</span>
            <span className="sm:group-hover:hidden">L</span>
            <span className="text-2xl sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 hidden sm:group-hover:inline">illain Labz</span>
          </h1>
        </div>
        <ul>
          <li><NavItem view={AppView.VoiceLab} currentView={currentView} setCurrentView={setCurrentView} icon={<MicIcon />} label="Voice Lab" /></li>
          <li><NavItem view={AppView.Studio} currentView={currentView} setCurrentView={setCurrentView} icon={<MusicIcon />} label="Studio" /></li>
          <li><NavItem view={AppView.DrumMachine} currentView={currentView} setCurrentView={setCurrentView} icon={<DrumIcon />} label="Drum Machine" /></li>
          <li><NavItem view={AppView.CodeLab} currentView={currentView} setCurrentView={setCurrentView} icon={<CodeIcon />} label="Code Lab" /></li>
          <li><NavItem view={AppView.YouTube} currentView={currentView} setCurrentView={setCurrentView} icon={<YouTubeIcon />} label="YouTube" /></li>
          <li><NavItem view={AppView.Chat} currentView={currentView} setCurrentView={setCurrentView} icon={<ChatIcon />} label="AI Chat" /></li>
          <li><NavItem view={AppView.ModelManager} currentView={currentView} setCurrentView={setCurrentView} icon={<CogIcon />} label="Models" /></li>
          <li><NavItem view={AppView.Storage} currentView={currentView} setCurrentView={setCurrentView} icon={<StorageIcon />} label="Storage" /></li>
          <li><NavItem view={AppView.SpotifyConnect} currentView={currentView} setCurrentView={setCurrentView} icon={<SpotifyIcon />} label="Spotify" /></li>
          <li><NavItem view={AppView.FacebookConnect} currentView={currentView} setCurrentView={setCurrentView} icon={<FacebookIcon />} label="Facebook" /></li>
        </ul>
      </div>
      <div>
        <div className="flex items-center justify-center p-2 text-xs sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
            <div className={`h-2.5 w-2.5 rounded-full mr-2 ${isOnline ? 'bg-green-400' : 'bg-red-500'}`}></div>
            <span className={isOnline ? 'text-green-400' : 'text-red-500'}>{isOnline ? 'Online' : 'Offline'}</span>
        </div>
        <div className="text-xs text-gray-500 text-center hidden sm:block sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300">
            &copy; {new Date().getFullYear()}
        </div>
      </div>
    </nav>
  );
};

export default SideNav;