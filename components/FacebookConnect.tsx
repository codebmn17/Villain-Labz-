

import React, { useState, useEffect } from 'react';
import { FacebookIcon } from './icons/FacebookIcon';
import { AppController } from '../types';

interface FacebookConnectProps {
    appController: AppController;
}

const STORAGE_KEY_APP_ID = 'villain_facebook_app_id';

const FacebookConnect: React.FC<FacebookConnectProps> = ({ appController }) => {
    const { 
        isFacebookConnected, 
        setIsFacebookConnected, 
        facebookAppId, 
        setFacebookAppId,
        facebookUser,
        setFacebookUser
    } = appController;
    
    const [localAppId, setLocalAppId] = useState(facebookAppId);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const storedAppId = localStorage.getItem(STORAGE_KEY_APP_ID);
        if (storedAppId) {
            setFacebookAppId(storedAppId);
            setLocalAppId(storedAppId);
        }
    }, []);

    const handleConnect = () => {
        if (!localAppId.trim()) {
            setError('Facebook App ID is required to connect.');
            return;
        }
        
        setIsLoading(true);
        setError('');
        
        // Simulate OAuth flow & API call
        setTimeout(() => {
            setFacebookAppId(localAppId);
            localStorage.setItem(STORAGE_KEY_APP_ID, localAppId);
            setIsFacebookConnected(true);
            setFacebookUser({
                id: '100001234567890',
                name: 'Your Friend',
                pictureUrl: `https://i.pravatar.cc/150?u=${Date.now()}` // Random avatar
            });
            setIsLoading(false);
        }, 1500);
    };
    
    const handleDisconnect = () => {
        setIsFacebookConnected(false);
        setFacebookUser(null);
    };
    
    return (
        <div className="bg-gray-800 p-4 rounded-xl shadow-2xl animate-fade-in h-full">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-blue-500 mb-2 flex items-center">
                        <FacebookIcon className="h-8 w-8 mr-3" />
                        Facebook Connect
                    </h2>
                    <p className="text-gray-400">Connect your account to share your generated tracks.</p>
                </div>
            </div>

            {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-200 p-3 rounded-lg mb-4 flex justify-between items-center">
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="text-sm font-bold ml-2">×</button>
                </div>
            )}
            
            {!isFacebookConnected ? (
                <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-6">
                    <h3 className="text-xl font-bold text-white mb-4">Setup Connection</h3>
                    <p className="text-gray-300 text-sm mb-4">
                        To enable sharing, you need to use your own Facebook App ID.
                    </p>
                    <ol className="list-decimal list-inside text-gray-400 text-sm space-y-2 mb-6">
                        <li>Go to <a href="https://developers.facebook.com/apps/" target="_blank" className="text-blue-400 hover:underline">Meta for Developers</a>.</li>
                        <li>Create a new App (or use an existing one).</li>
                        <li>Copy the <strong>App ID</strong> and paste it below.</li>
                    </ol>
                    
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase">Facebook App ID</label>
                        <input 
                            type="text" 
                            value={localAppId}
                            onChange={(e) => setLocalAppId(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white font-mono text-sm focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. 123456789012345"
                        />
                    </div>
                    <button 
                        onClick={handleConnect}
                        disabled={isLoading}
                        className="mt-4 w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                        {isLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>}
                        {isLoading ? 'Connecting...' : 'Connect to Facebook'}
                    </button>
                </div>
            ) : (
                 <div className="bg-gray-700/50 border border-blue-500/30 rounded-lg p-6 text-center animate-fade-in">
                    <img 
                        src={facebookUser?.pictureUrl} 
                        alt="Profile" 
                        className="h-24 w-24 rounded-full mx-auto mb-4 border-4 border-blue-500 shadow-lg"
                    />
                    <h3 className="text-2xl font-bold text-white">Connected as {facebookUser?.name}</h3>
                    <p className="text-gray-400 mb-6">You can now share tracks from the Storage view.</p>
                    <button 
                        onClick={handleDisconnect}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                    >
                        Disconnect
                    </button>
                 </div>
            )}
        </div>
    );
};

export default FacebookConnect;