
import React, { useState, useEffect, useMemo } from 'react';
import { AudioPlaylistItem } from '../types';
import AudioPlayer from './AudioPlayer';
import { TrashIcon } from './icons/TrashIcon';
import { PencilIcon } from './icons/PencilIcon';
import { deleteTrackFromDB, updateTrackInDB, clearAllTracksFromDB } from '../services/storageService';

interface StorageProps {
  generatedTracks: AudioPlaylistItem[];
  setGeneratedTracks: (tracks: AudioPlaylistItem[]) => void;
}

const Storage: React.FC<StorageProps> = ({ generatedTracks, setGeneratedTracks }) => {
  const [editingTrack, setEditingTrack] = useState<AudioPlaylistItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name' | 'size'>('newest');

  // Calculate Total Storage Usage
  const totalBytes = useMemo(() => generatedTracks.reduce((acc, track) => acc + (track.size || 0), 0), [generatedTracks]);
  const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filter and Sort Tracks
  const filteredTracks = useMemo(() => {
      let tracks = [...generatedTracks];
      
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          tracks = tracks.filter(t => 
              t.title.toLowerCase().includes(lowerTerm) || 
              t.artist.toLowerCase().includes(lowerTerm)
          );
      }

      tracks.sort((a, b) => {
          switch (sortOrder) {
              case 'newest': return (b.createdAt || 0) - (a.createdAt || 0);
              case 'oldest': return (a.createdAt || 0) - (b.createdAt || 0);
              case 'name': return a.title.localeCompare(b.title);
              case 'size': return (b.size || 0) - (a.size || 0);
              default: return 0;
          }
      });

      return tracks;
  }, [generatedTracks, searchTerm, sortOrder]);

  const handleDownload = (track: AudioPlaylistItem, format: 'wav' | 'mp3') => {
    const link = document.createElement('a');
    link.href = track.src;
    const safeTitle = track.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${safeTitle}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (trackId: string) => {
    if (window.confirm("Are you sure you want to delete this track? It will be removed permanently from disk.")) {
      await deleteTrackFromDB(trackId);
      setGeneratedTracks(generatedTracks.filter(track => track.id !== trackId));
    }
  };
  
  const handleClearAll = async () => {
    if (window.confirm("Are you sure you want to delete ALL tracks? This action cannot be undone.")) {
      await clearAllTracksFromDB();
      setGeneratedTracks([]);
    }
  };

  const handleStartEdit = (track: AudioPlaylistItem) => {
    setEditingTrack({ ...track }); // Create a copy to edit
  };

  const handleCancelEdit = () => {
    setEditingTrack(null);
  };

  const handleSaveEdit = async () => {
    if (!editingTrack) return;
    
    // Optimistic update
    setGeneratedTracks(
      generatedTracks.map(track =>
        track.id === editingTrack.id ? editingTrack : track
      )
    );
    
    // Async persist
    await updateTrackInDB(editingTrack);
    setEditingTrack(null);
  };

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-2xl animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h2 className="text-3xl font-bold text-purple-400 mb-2">Track Storage</h2>
            <p className="text-gray-400">Persistent Audio Vault. All generated tracks are saved to disk.</p>
          </div>
          
          {/* Capacity Meter */}
          <div className="bg-gray-900 p-3 rounded-lg border border-gray-700 w-full md:w-64 mt-4 md:mt-0">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Storage Used</span>
                  <span className="text-purple-400 font-bold">{formatBytes(totalBytes)}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2.5">
                  <div className="bg-purple-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${Math.min((totalBytes / (1024*1024*500)) * 100, 100)}%` }}></div>
              </div>
              <p className="text-[10px] text-right text-gray-600 mt-1">System limit depends on browser</p>
          </div>
      </div>

      {generatedTracks.length === 0 ? (
        <div className="text-center text-gray-500 bg-gray-900/50 p-10 rounded-lg border border-gray-700 border-dashed">
          <p className="text-lg">Your generated tracks will appear here.</p>
          <p>Go to the Studio to create some music!</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Filters & Tools */}
          <div className="flex flex-col sm:flex-row gap-4 bg-gray-700/30 p-3 rounded-lg">
              <input 
                type="text" 
                placeholder="Search tracks..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 flex-grow"
              />
              <select 
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500"
              >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="size">Size (Largest)</option>
              </select>
               <button 
                    onClick={handleClearAll}
                    className="bg-red-900/50 hover:bg-red-700 text-red-200 border border-red-800 font-bold py-2 px-4 rounded text-xs transition-colors flex items-center justify-center whitespace-nowrap"
                  >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      Clear All
                </button>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-purple-300 mb-4">Session Playlist</h3>
            <AudioPlayer playlist={filteredTracks} />
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-purple-300">Track Library ({filteredTracks.length})</h3>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {filteredTracks.map((track) => (
                <div key={track.id} className="bg-gray-700 p-3 rounded-lg flex flex-col sm:flex-row items-center justify-between transition-all duration-300 hover:bg-gray-600">
                  {editingTrack && editingTrack.id === track.id ? (
                    <>
                      <div className="flex-1 flex flex-col gap-2 w-full sm:pr-4 mb-2 sm:mb-0">
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
                      <div className="flex-1 overflow-hidden w-full text-center sm:text-left mb-2 sm:mb-0">
                        <p className="font-semibold text-white truncate" title={track.title}>{track.title}</p>
                        <div className="flex items-center justify-center sm:justify-start text-xs text-gray-400 space-x-2">
                            <span>{track.artist}</span>
                            <span>•</span>
                            <span>{formatBytes(track.size || 0)}</span>
                            <span>•</span>
                            <span>{track.createdAt ? new Date(track.createdAt).toLocaleDateString() : 'Unknown Date'}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <button
                          onClick={() => handleDownload(track, 'wav')}
                          className="bg-gray-800 hover:bg-gray-500 text-white font-bold py-1 px-3 rounded-lg text-[10px] uppercase tracking-wider transition-colors"
                          aria-label={`Export ${track.title} as WAV`}
                        >
                          WAV
                        </button>
                        <button
                          onClick={() => handleDownload(track, 'mp3')}
                          className="bg-gray-800 hover:bg-gray-500 text-white font-bold py-1 px-3 rounded-lg text-[10px] uppercase tracking-wider transition-colors"
                          aria-label={`Export ${track.title} as MP3`}
                        >
                          MP3
                        </button>
                         <button
                            onClick={() => handleStartEdit(track)}
                            className="text-gray-400 hover:text-purple-400 transition-colors p-2 rounded-full hover:bg-gray-800"
                            aria-label={`Edit ${track.title}`}
                        >
                            <PencilIcon />
                        </button>
                        <button
                          onClick={() => handleDelete(track.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-gray-800"
                          aria-label={`Delete ${track.title}`}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Storage;
