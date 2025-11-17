
import React from 'react';
import { AppView } from '../types';
import { MicIcon } from './icons/MicIcon';
import { MusicIcon } from './icons/MusicIcon';
import { ChatIcon } from './icons/ChatIcon';
import { CogIcon } from './icons/CogIcon';

interface SideNavProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
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
      className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start w-full p-3 my-1 rounded-lg transition-all duration-200 ${
        isActive ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
      }`}
      aria-label={label}
    >
      {icon}
      <span className="mt-1 sm:mt-0 sm:ml-4 text-xs sm:text-sm font-medium hidden sm:block">{label}</span>
    </button>
  );
};

const SideNav: React.FC<SideNavProps> = ({ currentView, setCurrentView }) => {
  return (
    <nav className="bg-gray-800 p-2 sm:p-4 flex flex-col justify-between items-center shadow-2xl">
      <div>
        <div className="text-center sm:text-left p-2 mb-6">
            <h1 className="text-2xl font-bold text-purple-400 hidden sm:block">Villain Labz</h1>
            <h1 className="text-2xl font-bold text-purple-400 block sm:hidden">VL</h1>
        </div>
        <ul>
          <li><NavItem view={AppView.VoiceLab} currentView={currentView} setCurrentView={setCurrentView} icon={<MicIcon />} label="Voice Lab" /></li>
          <li><NavItem view={AppView.Studio} currentView={currentView} setCurrentView={setCurrentView} icon={<MusicIcon />} label="Studio" /></li>
          <li><NavItem view={AppView.Chat} currentView={currentView} setCurrentView={setCurrentView} icon={<ChatIcon />} label="AI Chat" /></li>
          <li><NavItem view={AppView.ModelManager} currentView={currentView} setCurrentView={setCurrentView} icon={<CogIcon />} label="Model Manager" /></li>
        </ul>
      </div>
      <div className="text-xs text-gray-500 text-center hidden sm:block">
        &copy; {new Date().getFullYear()}
      </div>
    </nav>
  );
};

export default SideNav;
