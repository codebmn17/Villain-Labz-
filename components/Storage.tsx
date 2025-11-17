import React from 'react';
import { AudioPlaylistItem } from '../types';
import AudioPlayer from './AudioPlayer';
import { TrashIcon } from './icons/TrashIcon';

interface StorageProps {
  generatedTracks: AudioPlaylistItem[];
  setGeneratedTracks: (tracks: AudioPlaylistItem[]) => void;
}

const Storage: React.FC<StorageProps> = ({ generatedTracks, setGeneratedTracks }) => {

  const handleDownload = (track: AudioPlaylistItem, format: 'wav' | 'mp3') => {
    const link = document.createElement('a');
    link.href = track.src;
    const safeTitle = track.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${safeTitle}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = (trackId: string) => {
    if (window.confirm("Are you sure you want to delete this track? It will be removed permanently.")) {
      setGeneratedTracks(generatedTracks.filter(track => track.id !== trackId));
    }
  };
  
  const handleClearAll = () => {
    if (window.confirm("Are you sure you want to delete ALL tracks? This action cannot be undone.")) {
      setGeneratedTracks([]);
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-2xl animate-fade-in">
      <h2 className="text-3xl font-bold text-purple-400 mb-2">Track Storage</h2>
      <p className="text-gray-400 mb-8">All tracks generated during this session. Note: Tracks are not saved permanently.</p>

      {generatedTracks.length === 0 ? (
        <div className="text-center text-gray-500 bg-gray-900/50 p-10 rounded-lg">
          <p className="text-lg">Your generated tracks will appear here.</p>
          <p>Go to the Studio to create some music!</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-purple-300 mb-4">Session Playlist</h3>
            <AudioPlayer playlist={generatedTracks} />
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-purple-300">Track Library ({generatedTracks.length})</h3>
              {generatedTracks.length > 0 && (
                  <button 
                    onClick={handleClearAll}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-lg text-xs transition-colors flex items-center"
                  >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Clear All
                  </button>
              )}
            </div>
            <ul className="space-y-3">
              {generatedTracks.map((track) => (
                <li key={track.id} className="bg-gray-700 p-3 rounded-lg flex items-center justify-between transition-all duration-300">
                  <div className="flex-1 overflow-hidden">
                    <p className="font-semibold text-white truncate" title={track.title}>{track.title}</p>
                    <p className="text-sm text-gray-400">{track.artist}</p>
                  </div>
                  <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                    <button
                      onClick={() => handleDownload(track, 'wav')}
                      className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-1 px-3 rounded-lg text-xs transition-colors"
                      aria-label={`Export ${track.title} as WAV`}
                    >
                      Export WAV
                    </button>
                    <button
                      onClick={() => handleDownload(track, 'mp3')}
                      className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-1 px-3 rounded-lg text-xs transition-colors"
                      aria-label={`Export ${track.title} as MP3`}
                    >
                      Export MP3
                    </button>
                    <button
                      onClick={() => handleDelete(track.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-gray-600"
                      aria-label={`Delete ${track.title}`}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default Storage;