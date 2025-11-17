import React, { useState } from 'react';
import { SpotifyIcon } from './icons/SpotifyIcon';
import { CheckIcon } from './icons/CheckIcon';

const SpotifyConnect: React.FC = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    const handleConnect = () => {
        setIsConnecting(true);
        // Simulate API call for OAuth
        setTimeout(() => {
            setIsConnected(true);
            setIsConnecting(false);
        }, 2000);
    };

    return (
        <div className="bg-gray-800 p-6 rounded-xl shadow-2xl animate-fade-in">
            <h2 className="text-3xl font-bold text-purple-400 mb-2">Connect to Spotify</h2>
            <p className="text-gray-400 mb-8">Link your Spotify account to unlock new features, like exporting your generated tracks directly to your playlists.</p>
            
            <div className="bg-gray-700/50 rounded-lg p-8 flex flex-col items-center justify-center text-center">
                <SpotifyIcon className="h-16 w-16 text-green-500 mb-4" />
                {isConnected ? (
                     <div className="text-center">
                        <div className="flex items-center justify-center bg-green-500/20 text-green-300 font-semibold px-6 py-3 rounded-lg">
                            <CheckIcon className="h-6 w-6 mr-2" />
                            <span>Successfully Connected to Spotify</span>
                        </div>
                        <p className="text-gray-400 mt-4 text-sm">You can now disconnect from your Spotify account settings.</p>
                    </div>
                ) : (
                    <>
                        <h3 className="text-2xl font-bold text-white mb-2">Connect Your Account</h3>
                        <p className="text-gray-400 mb-6 max-w-md">By connecting, you allow Villain Labz to create new playlists and add tracks to your Spotify library on your behalf.</p>
                        <button
                            onClick={handleConnect}
                            disabled={isConnecting}
                            className="flex items-center justify-center bg-green-500 hover:bg-green-600 disabled:bg-green-800 disabled:cursor-wait text-white font-bold py-3 px-8 rounded-full transition-all duration-300 shadow-lg"
                        >
                            <SpotifyIcon className="h-5 w-5 mr-3" />
                            {isConnecting ? 'Connecting...' : 'Connect with Spotify'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default SpotifyConnect;