
import React, { useState } from 'react';
import { YouTubeIcon } from './icons/YouTubeIcon';
import { searchYouTubeVideos } from '../services/geminiService';
import { YouTubeResult } from '../types';
import { UploadIcon } from './icons/UploadIcon';

interface YouTubeConnectProps {
    onImport: (title: string, artist: string) => void;
}

const YouTubeConnect: React.FC<YouTubeConnectProps> = ({ onImport }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<YouTubeResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!query.trim()) return;
        
        setIsLoading(true);
        setError(null);
        setResults([]);

        try {
            const videos = await searchYouTubeVideos(query);
            if (videos.length === 0) {
                setError("No videos found. Try a different search.");
            } else {
                setResults(videos);
            }
        } catch (err) {
            setError("Failed to search YouTube. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const extractMetadata = (videoTitle: string, channel: string) => {
        // Simple heuristic: "Artist - Title" or "Title - Artist"
        let artist = channel.replace('VEVO', '').replace('Official', '').trim();
        let title = videoTitle;

        if (videoTitle.includes('-')) {
            const parts = videoTitle.split('-');
            if (parts.length >= 2) {
                // Assume Artist - Title usually
                artist = parts[0].trim();
                title = parts[1].replace(/\[.*?\]|\(.*?\)/g, '').trim(); // Remove (Official Video) etc
            }
        }
        
        onImport(title, artist);
    };

    return (
        <div className="bg-gray-800 p-4 rounded-xl shadow-2xl animate-fade-in h-full flex flex-col">
             <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-red-500 mb-2 flex items-center">
                        <YouTubeIcon className="h-8 w-8 mr-3" />
                        YouTube Connector
                    </h2>
                    <p className="text-gray-400">Research songs, find samples, and import metadata directly into the Studio.</p>
                </div>
            </div>

            <form onSubmit={handleSearch} className="mb-8">
                <div className="flex items-center bg-gray-700 rounded-lg p-2 border border-gray-600 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500 transition-all">
                    <YouTubeIcon className="h-6 w-6 ml-2 text-gray-400" />
                    <input 
                        type="text" 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search for a song, artist, or performance..."
                        className="bg-transparent border-none text-white placeholder-gray-400 focus:ring-0 flex-1 ml-2"
                    />
                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-md transition-colors disabled:opacity-50"
                    >
                        {isLoading ? 'Searching...' : 'Search'}
                    </button>
                </div>
            </form>

            {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-200 p-4 rounded-lg mb-6 text-center">
                    {error}
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {results.length === 0 && !isLoading && !error && (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500 border-2 border-dashed border-gray-700 rounded-lg">
                        <YouTubeIcon className="h-16 w-16 mb-4 opacity-20" />
                        <p>Search results will appear here.</p>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {results.map((video) => (
                        <div key={video.id} className="bg-gray-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-red-500 transition-all group">
                            <div className="relative aspect-video bg-gray-800">
                                <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                    <a href={video.url} target="_blank" rel="noreferrer" className="bg-red-600 text-white p-2 rounded-full hover:scale-110 transition-transform" title="Watch on YouTube">
                                        <YouTubeIcon className="h-6 w-6" />
                                    </a>
                                </div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-bold text-white mb-1 line-clamp-2" title={video.title}>{video.title}</h3>
                                <p className="text-sm text-gray-400 mb-4">{video.channel}</p>
                                <button 
                                    onClick={() => extractMetadata(video.title, video.channel)}
                                    className="w-full bg-gray-800 hover:bg-purple-600 text-gray-300 hover:text-white border border-gray-700 hover:border-purple-500 py-2 rounded-md text-sm font-bold transition-all flex items-center justify-center"
                                >
                                    <UploadIcon className="h-4 w-4 mr-2" />
                                    Import to Studio
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default YouTubeConnect;
