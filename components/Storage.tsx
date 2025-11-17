import React, { useState } from 'react';
import { AudioPlaylistItem } from '../types';
import AudioPlayer from './AudioPlayer';
import { TrashIcon } from './icons/TrashIcon';
import { PencilIcon } from './icons/PencilIcon';

interface StorageProps {
  generatedTracks: AudioPlaylistItem[];
  setGeneratedTracks: (tracks: AudioPlaylistItem[]) => void;
}

const Storage: React.FC<StorageProps> = ({ generatedTracks, setGeneratedTracks }) => {
  const [editingTrack, setEditingTrack] = useState<AudioPlaylistItem | null>(null);

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

  const handleStartEdit = (track: AudioPlaylistItem) => {
    setEditingTrack({ ...track }); // Create a copy to edit
  };

  const handleCancelEdit = () => {
    setEditingTrack(null);
  };

  const handleSaveEdit = () => {
    if (!editingTrack) return;
    setGeneratedTracks(
      generatedTracks.map(track =>
        track.id === editingTrack.id ? editingTrack : track
      )
    );
    setEditingTrack(null);
  };

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-2xl animate-fade-in">
      <h2 className="text-3xl font-bold text-purple-400 mb-2">Track Storage</h2>
      <p className="text-gray-400 mb-8">All tracks generated during this session. Edit, export, or delete your creations.</p>

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
                  {editingTrack && editingTrack.id === track.id ? (
                    <>
                      <div className="flex-1 flex flex-col gap-2 pr-4">
                        <input
                          type="text"
                          value={editingTrack.title}
                          onChange={(e) => setEditingTrack({ ...editingTrack, title: e.target.value })}
                          className="bg-gray-800 border border-purple-500 rounded-md p-1 text-white w-full text-sm font-semibold"
                          aria-label="Edit title"
                        />
                        <input
                          type="text"
                          value={editingTrack.artist}
                          onChange={(e) => setEditingTrack({ ...editingTrack, artist: e.target.value })}
                          className="bg-gray-800 border border-purple-500 rounded-md p-1 text-white w-full text-xs"
                          aria-label="Edit artist"
                        />
                      </div>
                      <div className="flex items-center space-x-3 flex-shrink-0">
                        <button onClick={handleSaveEdit} className="text-green-400 hover:text-green-300 font-bold text-sm">Save</button>
                        <button onClick={handleCancelEdit} className="text-gray-400 hover:text-white text-sm">Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
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
                            onClick={() => handleStartEdit(track)}
                            className="text-gray-400 hover:text-purple-400 transition-colors p-2 rounded-full hover:bg-gray-600"
                            aria-label={`Edit ${track.title}`}
                        >
                            <PencilIcon />
                        </button>
                        <button
                          onClick={() => handleDelete(track.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-gray-600"
                          aria-label={`Delete ${track.title}`}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </>
                  )}
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