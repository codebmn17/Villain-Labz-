
import React, { useState, useEffect } from 'react';
import { SpotifyIcon } from './icons/SpotifyIcon';
import { CheckIcon } from './icons/CheckIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PlayIcon } from './icons/PlayIcon';

// --- PKCE Helper Functions ---
const generateRandomString = (length: number) => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const generateCodeChallenge = async (codeVerifier: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  
  // Convert to base64url string
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

// --- Types ---
interface SpotifyUser {
    id: string;
    display_name: string;
    email: string;
    images: { url: string }[];
    followers: { total: number };
    product: string;
}

interface SpotifyPlaylist {
    id: string;
    name: string;
    images: { url: string }[];
    tracks: { total: number };
    owner: { display_name: string };
    uri: string;
}

// --- Constants ---
const SCOPES = 'user-read-private user-read-email playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private';
const STORAGE_KEYS = {
    CLIENT_ID: 'villain_spotify_client_id',
    ACCESS_TOKEN: 'villain_spotify_access_token',
    REFRESH_TOKEN: 'villain_spotify_refresh_token',
    EXPIRES_AT: 'villain_spotify_expires_at',
    CODE_VERIFIER: 'villain_spotify_verifier'
};

const SpotifyConnect: React.FC = () => {
    // Auth State
    const [clientId, setClientId] = useState(localStorage.getItem(STORAGE_KEYS.CLIENT_ID) || '');
    const [accessToken, setAccessToken] = useState(localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || '');
    const [redirectUri, setRedirectUri] = useState(window.location.origin); // Auto-detect origin

    // UI State
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [showConfig, setShowConfig] = useState(!localStorage.getItem(STORAGE_KEYS.CLIENT_ID));
    
    // Data State
    const [user, setUser] = useState<SpotifyUser | null>(null);
    const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
    const [newPlaylistName, setNewPlaylistName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Check for Auth Code in URL (Returned from Spotify)
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        
        if (code) {
            handleTokenExchange(code);
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (accessToken) {
            // Validate existing token
            const expiresAt = localStorage.getItem(STORAGE_KEYS.EXPIRES_AT);
            if (expiresAt && Date.now() > parseInt(expiresAt)) {
                refreshAccessToken();
            } else {
                setIsConnected(true);
                fetchUserData(accessToken);
            }
        }
    }, [accessToken]);

    // --- Auth Handlers ---

    const handleLogin = async () => {
        if (!clientId) {
            setError("Client ID is required");
            return;
        }
        
        localStorage.setItem(STORAGE_KEYS.CLIENT_ID, clientId);
        setIsConnecting(true);

        const codeVerifier = generateRandomString(128);
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        
        localStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, codeVerifier);

        const authUrl = new URL('https://accounts.spotify.com/authorize');
        const params = {
            response_type: 'code',
            client_id: clientId,
            scope: SCOPES,
            code_challenge_method: 'S256',
            code_challenge: codeChallenge,
            redirect_uri: redirectUri,
        };

        authUrl.search = new URLSearchParams(params).toString();
        window.location.href = authUrl.toString();
    };

    const handleTokenExchange = async (code: string) => {
        setIsConnecting(true);
        const codeVerifier = localStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
        const storedClientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);

        if (!codeVerifier || !storedClientId) {
            setError("Auth state missing. Please try connecting again.");
            setIsConnecting(false);
            return;
        }

        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: storedClientId,
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: redirectUri,
                    code_verifier: codeVerifier,
                }),
            });

            const data = await response.json();

            if (data.error) throw new Error(data.error_description || data.error);

            saveTokenData(data);
            setIsConnected(true);
            fetchUserData(data.access_token);

        } catch (err: any) {
            console.error("Token Exchange Error", err);
            setError(err.message || "Failed to connect to Spotify");
        } finally {
            setIsConnecting(false);
        }
    };

    const refreshAccessToken = async () => {
        const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
        const storedClientId = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);
        
        if (!refreshToken || !storedClientId) {
            handleDisconnect();
            return;
        }

        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                    client_id: storedClientId,
                }),
            });
            
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            
            saveTokenData(data);
            setIsConnected(true); // Re-connected
            fetchUserData(data.access_token);

        } catch (e) {
            console.error("Refresh failed", e);
            handleDisconnect();
        }
    };

    const saveTokenData = (data: any) => {
        const now = Date.now();
        const expiresAt = now + (data.expires_in * 1000);
        
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
        localStorage.setItem(STORAGE_KEYS.EXPIRES_AT, expiresAt.toString());
        if (data.refresh_token) {
            localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
        }
        
        setAccessToken(data.access_token);
    };

    const handleDisconnect = () => {
        setIsConnected(false);
        setUser(null);
        setPlaylists([]);
        setAccessToken('');
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.EXPIRES_AT);
    };

    const handleResetConfig = () => {
        handleDisconnect();
        setClientId('');
        localStorage.removeItem(STORAGE_KEYS.CLIENT_ID);
        setShowConfig(true);
    }

    // --- Data Fetching ---

    const fetchUserData = async (token: string) => {
        try {
            // 1. Get Profile
            const profileRes = await fetch('https://api.spotify.com/v1/me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const profileData = await profileRes.json();
            if(profileData.error) throw new Error(profileData.error.message);
            setUser(profileData);

            // 2. Get Playlists
            const playlistsRes = await fetch('https://api.spotify.com/v1/me/playlists?limit=20', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const playlistData = await playlistsRes.json();
            setPlaylists(playlistData.items || []);

        } catch (err: any) {
            console.error("Data Fetch Error", err);
            if (err.message.includes('expired')) {
                refreshAccessToken();
            } else {
                setError("Failed to load Spotify data.");
            }
        }
    };

    const handleCreatePlaylist = async () => {
        if(!newPlaylistName.trim() || !user) return;
        setIsCreating(true);
        
        try {
            const response = await fetch(`https://api.spotify.com/v1/users/${user.id}/playlists`, {
                method: 'POST',
                headers: { 
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: newPlaylistName,
                    description: "Created with Villain Labz AI",
                    public: false
                })
            });

            const data = await response.json();
            if(data.error) throw new Error(data.error.message);

            setPlaylists([data, ...playlists]);
            setNewPlaylistName('');

        } catch (e: any) {
            setError(e.message || "Failed to create playlist");
        } finally {
            setIsCreating(false);
        }
    }

    // Note: The API endpoint to DELETE a playlist is actually "Unfollow"
    const deletePlaylist = async (id: string) => {
        if(window.confirm('Are you sure you want to delete (unfollow) this playlist from your Spotify account?')) {
            try {
                await fetch(`https://api.spotify.com/v1/playlists/${id}/followers`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${accessToken}` }
                });
                setPlaylists(playlists.filter(p => p.id !== id));
            } catch (e) {
                console.error("Delete failed", e);
                setError("Could not delete playlist.");
            }
        }
    }

    // --- Render ---

    return (
        <div className="bg-gray-800 p-4 rounded-xl shadow-2xl animate-fade-in h-full overflow-y-auto relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-purple-400 mb-2">Spotify Integration</h2>
                    <p className="text-gray-400 break-words max-w-lg">Link your account to export generated tracks directly to your playlists.</p>
                </div>
                <div className="flex items-center space-x-3">
                    <a 
                        href="https://open.spotify.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                    >
                        <PlayIcon />
                        <span className="ml-2">Open Web Player</span>
                    </a>
                    {isConnected && (
                        <button 
                            onClick={handleDisconnect}
                            className="text-xs text-red-400 hover:text-red-300 underline"
                        >
                            Disconnect
                        </button>
                    )}
                    {!isConnected && !showConfig && (
                        <button onClick={() => setShowConfig(true)} className="text-xs text-gray-400 hover:text-white">Config</button>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-red-900/50 border border-red-700 text-red-200 p-3 rounded-lg mb-4 flex justify-between items-center break-words">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-sm font-bold ml-2">×</button>
                </div>
            )}
            
            {/* Configuration / Setup Mode */}
            {(!isConnected && showConfig) && (
                <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-6 mb-6">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                        <span className="bg-purple-600 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">1</span>
                        Setup Connection
                    </h3>
                    <p className="text-gray-300 text-sm mb-4 break-words">
                        To connect to Spotify securely from this browser, you need to register this app in your Spotify Developer Dashboard.
                    </p>
                    <ol className="list-decimal list-inside text-gray-400 text-sm space-y-2 mb-6">
                        <li>Go to <a href="https://developer.spotify.com/dashboard" target="_blank" className="text-purple-400 hover:underline">Spotify Developer Dashboard</a>.</li>
                        <li>Create a new App called "Villain Labz".</li>
                        <li>Edit Settings and add this <strong>Redirect URI</strong>: <br/>
                            <code className="bg-black/30 px-2 py-1 rounded text-green-400 select-all break-all block mt-1">{redirectUri}</code>
                        </li>
                        <li>Copy the <strong>Client ID</strong> and paste it below.</li>
                    </ol>
                    
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase">Spotify Client ID</label>
                        <input 
                            type="text" 
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white font-mono text-sm focus:ring-2 focus:ring-green-500"
                            placeholder="e.g. 8a24..."
                        />
                    </div>
                    <button 
                        onClick={handleLogin}
                        className="mt-4 w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded transition-colors"
                    >
                        Save & Connect
                    </button>
                    
                    <div className="mt-6 pt-6 border-t border-gray-600 text-center">
                        <p className="text-gray-400 text-sm mb-3">Don't want to configure?</p>
                        <a 
                            href="https://open.spotify.com" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-green-400 hover:text-green-300 font-bold"
                        >
                            Just Open Spotify Web Player &rarr;
                        </a>
                    </div>
                </div>
            )}

            {/* Connect Button (Configured but not connected) */}
            {(!isConnected && !showConfig) && (
                <div className="bg-gray-700/50 rounded-lg p-12 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="bg-black p-4 rounded-full shadow-lg">
                        <SpotifyIcon className="h-16 w-16 text-green-500" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-white mb-2">Ready to Connect</h3>
                        <p className="text-gray-400 max-w-md mx-auto text-sm break-words">
                            Configuration loaded. Click below to authorize access to your Spotify Library.
                        </p>
                    </div>
                    <button
                        onClick={handleLogin}
                        disabled={isConnecting}
                        className="flex items-center justify-center bg-green-500 hover:bg-green-600 disabled:bg-green-800 disabled:cursor-wait text-white font-bold py-3 px-8 rounded-full transition-all duration-300 shadow-lg transform hover:scale-105"
                    >
                        {isConnecting ? (
                            <>Connecting...</>
                        ) : (
                            <>
                                <SpotifyIcon className="h-5 w-5 mr-2" />
                                Login with Spotify
                            </>
                        )}
                    </button>
                    
                    <div className="flex flex-col space-y-2 mt-4">
                         <button onClick={handleResetConfig} className="text-xs text-gray-500 hover:text-gray-300 underline">Reset Configuration</button>
                         <a 
                            href="https://open.spotify.com" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-green-500 hover:text-green-400 underline"
                         >
                            Go to Spotify Web Player instead
                         </a>
                    </div>
                </div>
            )}

            {/* Connected Dashboard */}
            {isConnected && (
                <div className="space-y-8 animate-fade-in">
                    {/* User Profile */}
                    <div className="bg-gradient-to-r from-gray-700 to-gray-800 p-6 rounded-xl flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 border border-gray-600 shadow-lg">
                        {user?.images?.[0]?.url ? (
                             <img 
                                src={user.images[0].url} 
                                alt="Avatar" 
                                className="h-20 w-20 rounded-full border-4 border-green-500 shadow-lg flex-shrink-0" 
                            />
                        ) : (
                            <div className="h-20 w-20 rounded-full bg-gray-600 flex flex-shrink-0 items-center justify-center text-2xl font-bold text-gray-400">
                                {user?.display_name?.charAt(0)}
                            </div>
                        )}
                       
                        <div className="text-center sm:text-left w-full min-w-0">
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                <h3 className="text-2xl font-bold text-white break-words">{user?.display_name}</h3>
                                {user?.product === 'premium' && (
                                    <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded-full border border-green-500/30">PREMIUM</span>
                                )}
                            </div>
                            <p className="text-gray-400 break-all">{user?.email}</p>
                            <div className="flex items-center justify-center sm:justify-start mt-2 text-sm text-gray-300">
                                <span className="font-bold mr-1">{user?.followers?.total || 0}</span> Followers
                                <span className="mx-2">•</span>
                                <span className="font-bold mr-1">{playlists.length}</span> Playlists
                            </div>
                        </div>
                    </div>

                    {/* Playlists Section */}
                    <div>
                        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
                             <h3 className="text-xl font-bold text-white">Your Playlists</h3>
                             <div className="flex w-full sm:w-auto">
                                 <input 
                                    type="text" 
                                    placeholder="New Playlist Name..." 
                                    value={newPlaylistName}
                                    onChange={(e) => setNewPlaylistName(e.target.value)}
                                    className="bg-gray-900 border border-gray-600 rounded-l-md px-3 py-1 text-sm text-white focus:outline-none focus:border-green-500 flex-grow"
                                 />
                                 <button 
                                    onClick={handleCreatePlaylist}
                                    disabled={isCreating || !newPlaylistName}
                                    className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-3 py-1 rounded-r-md text-sm font-bold transition-colors whitespace-nowrap"
                                 >
                                     {isCreating ? '...' : 'Create'}
                                 </button>
                             </div>
                        </div>

                        {playlists.length === 0 ? (
                             <p className="text-gray-500 text-center py-8">No playlists found.</p>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {playlists.map(playlist => (
                                    <div key={playlist.id} className="bg-gray-900/50 group p-4 rounded-lg hover:bg-gray-700 transition-all cursor-pointer relative">
                                        <div className="relative aspect-square mb-3 overflow-hidden rounded-md shadow-md bg-gray-800 flex items-center justify-center">
                                            {playlist.images?.[0]?.url ? (
                                                <img src={playlist.images[0].url} alt={playlist.name} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                                            ) : (
                                                <SpotifyIcon className="h-12 w-12 text-gray-600" />
                                            )}
                                            
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                                <SpotifyIcon className="h-10 w-10 text-green-500" />
                                            </div>
                                            
                                            {/* Only allow deleting own playlists roughly checked by owner name matching current user display name */}
                                            {playlist.owner.display_name === user?.display_name && (
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); deletePlaylist(playlist.id); }}
                                                    className="absolute top-2 right-2 bg-red-600 p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all z-10"
                                                    title="Delete Playlist"
                                                >
                                                    <TrashIcon className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                        <h4 className="font-bold text-white text-sm line-clamp-2" title={playlist.name}>{playlist.name}</h4>
                                        <p className="text-xs text-gray-400 break-words">By {playlist.owner.display_name}</p>
                                        <p className="text-[10px] text-gray-500 mt-1">{playlist.tracks.total} Tracks</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SpotifyConnect;
