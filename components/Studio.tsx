
import React, { useState, useEffect } from 'react';
import { elevenLabsGenerate } from '../services/elevenLabsService';
import { researchAndAdaptSong, findSongLyrics, analyzeSongMetadata } from '../services/geminiService';
import { saveTrackToDB } from '../services/storageService';
import { UploadIcon } from './icons/UploadIcon';
import { ClonedVoice, StudioMode, AudioPlaylistItem } from '../types';
import AudioPlayer from './AudioPlayer';
import { AgentIcon } from './icons/AgentIcon'; // Reusing agent icon for "Magic" analysis

interface StudioProps {
  clonedVoices: ClonedVoice[];
  elevenLabsKey: string;
  generatedTracks: AudioPlaylistItem[];
  setGeneratedTracks: (tracks: AudioPlaylistItem[]) => void;
  initialCoverData?: { title: string, artist: string };
}

const Studio: React.FC<StudioProps> = ({ clonedVoices, elevenLabsKey, generatedTracks, setGeneratedTracks, initialCoverData }) => {
  const [studioMode, setStudioMode] = useState<StudioMode>(StudioMode.Original);
  const [lyrics, setLyrics] = useState('');
  const [style, setStyle] = useState('Dark Synthwave with heavy bass');
  const [bpm, setBpm] = useState(120);
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalArtist, setOriginalArtist] = useState('');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false); // For metadata (BPM/Style)
  const [isFetchingLyrics, setIsFetchingLyrics] = useState(false); // For lyrics
  const [generationStatus, setGenerationStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
      if (initialCoverData) {
          setStudioMode(StudioMode.Cover);
          setOriginalTitle(initialCoverData.title);
          setOriginalArtist(initialCoverData.artist);
      }
  }, [initialCoverData]);

  useEffect(() => {
    // If the selected voice is deleted, reset the selection
    if (selectedVoiceId && !clonedVoices.find(v => v.id === selectedVoiceId)) {
        setSelectedVoiceId('');
    }
    // If there's only one voice, select it by default
    else if (!selectedVoiceId && clonedVoices.length > 0) {
       setSelectedVoiceId(clonedVoices[0].id);
    }
  }, [clonedVoices, selectedVoiceId]);


  const handleAnalyzeSong = async () => {
      if (!originalTitle || !originalArtist) {
          setError("Please enter a title and artist to analyze.");
          return;
      }
      setIsAnalyzing(true);
      setError(null);
      try {
          const data = await analyzeSongMetadata(originalTitle, originalArtist);
          setBpm(data.bpm);
          setStyle(data.style);
          setGenerationStatus(`Detected: ${data.bpm} BPM, ${data.style}`);
          setTimeout(() => setGenerationStatus(''), 3000);
      } catch (e) {
          setError("Failed to analyze song. Please try entering manually.");
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleFetchLyrics = async (adapt: boolean) => {
      if (!originalTitle || !originalArtist) {
          setError("Please enter a title and artist first.");
          return;
      }

      setIsFetchingLyrics(true);
      setError(null);
      setGenerationStatus(adapt ? 'Researching and adapting lyrics...' : 'Fetching original lyrics...');

      try {
          const fetchedLyrics = adapt
            ? await researchAndAdaptSong(originalTitle, originalArtist, style)
            : await findSongLyrics(originalTitle, originalArtist);
          
          setLyrics(fetchedLyrics);
          setGenerationStatus('Lyrics updated. Feel free to edit them below.');
          setTimeout(() => setGenerationStatus(''), 3000);

      } catch (e) {
          console.error(e);
          setError("Failed to fetch lyrics. Please check the song details or try pasting them manually.");
      } finally {
          setIsFetchingLyrics(false);
      }
  };

  const handleGenerateMusic = async () => {
    if (studioMode === StudioMode.Cover) {
        if (!originalTitle || !originalArtist) {
            setError('Please provide the original song title and artist.');
            return;
        }
    } 
    
    if (!lyrics || !style) {
        setError('Please provide lyrics and a music style.');
        return;
    }

    if (!selectedVoiceId && !elevenLabsKey) {
        setError('Please select a cloned voice or add an ElevenLabs API key in the Model Manager.');
        return;
    }

    setError(null);
    setIsGenerating(true);
    setGenerationStatus('');

    try {
        setGenerationStatus('Generating vocals & instrumentals...');
        
        // We use the lyrics from the state (which allows user edits after fetching)
        const audioUrl = await elevenLabsGenerate(lyrics, elevenLabsKey);
        
        const newTrack: AudioPlaylistItem = {
          id: Date.now().toString(),
          src: audioUrl,
          title: studioMode === StudioMode.Cover ? `${originalTitle} (Cover)` : `Original - ${style.substring(0, 15)}`,
          artist: studioMode === StudioMode.Cover ? `${originalArtist} ft. AI` : 'Villain Labz',
          createdAt: Date.now(),
        };

        // Persist to DB then update state
        await saveTrackToDB(newTrack);
        setGeneratedTracks([newTrack, ...generatedTracks]);

    } catch (e) {
        console.error("Generation Error:", e);
        if (e instanceof Error) {
            if (e.message.includes('ELEVENLABS_API_KEY_REQUIRED')) {
                setError('An ElevenLabs API key is required for longer audio generation. Please add one in the Model Manager.');
            } else {
                 setError('Failed to generate audio. Please check your inputs and try again.');
            }
        } else {
            setError('An unknown error occurred. Please try again.');
        }
    } finally {
        setIsGenerating(false);
        setGenerationStatus('');
    }
  };
  
  const handleLyricsFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const MAX_SIZE = 3 * 1024 * 1024 * 1024; // 3GB
    if (file.size > MAX_SIZE) {
      setError(`File is too large. Maximum size is ${MAX_SIZE / 1024 / 1024 / 1024}GB.`);
      if (event.target) event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setLyrics(text);
      setError(null); // Clear previous errors
    };
    reader.onerror = (e) => {
      console.error("Error reading file:", e);
      setError("Failed to read the lyrics file.");
    };
    reader.readAsText(file);

    if (event.target) event.target.value = '';
  };


  const ModeButton: React.FC<{mode: StudioMode, label: string}> = ({mode, label}) => (
      <button 
        onClick={() => setStudioMode(mode)}
        className={`px-3 py-1 rounded-md text-sm font-medium transition ${studioMode === mode ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
      >
        {label}
      </button>
  );

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-2xl animate-fade-in relative">
      {isGenerating && (
        <div className="absolute inset-0 bg-gray-800 bg-opacity-90 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl z-10 transition-opacity duration-300 animate-fade-in">
          <div className="text-center p-4">
            <div className="w-20 h-20 border-8 border-dashed rounded-full animate-spin border-purple-500 mx-auto"></div>
            <h3 className="mt-6 text-2xl font-bold text-purple-300 animate-pulse">{generationStatus || 'Initializing Generation...'}</h3>
            <p className="mt-2 text-gray-400">This may take a few moments. Please don't close the tab.</p>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-purple-400 mb-2">Studio</h2>
          <p className="text-gray-400">Compose your masterpiece, original or cover.</p>
        </div>
        <div className="flex space-x-2 p-1 bg-gray-900/50 rounded-lg">
          <ModeButton mode={StudioMode.Original} label="Original" />
          <ModeButton mode={StudioMode.Cover} label="Cover Song" />
        </div>
      </div>
      
      {/* Notification area for analysis success/error */}
      {(generationStatus && !isGenerating) && (
          <div className="bg-green-900/50 text-green-300 p-2 rounded-md mb-4 text-sm text-center">
              {generationStatus}
          </div>
      )}

      {error && <p className="text-red-400 bg-red-900/50 p-2 rounded-md mb-4">{error}</p>}

      <div className="space-y-6">
        {studioMode === StudioMode.Cover && (
          <div className="p-3 bg-gray-700/50 rounded-lg animate-fade-in">
            <div className="flex justify-between items-center mb-3">
                 <h3 className="text-lg font-semibold text-purple-300">Cover Song Details</h3>
                 <button 
                    onClick={handleAnalyzeSong}
                    disabled={isAnalyzing || !originalTitle || !originalArtist}
                    className="flex items-center text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-3 py-1 rounded-full transition-colors"
                    title="Automatically detect BPM and Style"
                 >
                     {isAnalyzing ? (
                         <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                     ) : (
                         <AgentIcon className="w-4 h-4 mr-1 text-white" />
                     )}
                     Auto-Detect Settings
                 </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="originalTitle" className="block text-sm font-medium text-gray-300 mb-2">Original Song Title</label>
                <input id="originalTitle" type="text" className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 focus:ring-2 focus:ring-purple-500" placeholder="e.g., Blinding Lights" value={originalTitle} onChange={(e) => setOriginalTitle(e.target.value)} />
              </div>
              <div>
                <label htmlFor="originalArtist" className="block text-sm font-medium text-gray-300 mb-2">Original Artist</label>
                <input id="originalArtist" type="text" className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 focus:ring-2 focus:ring-purple-500" placeholder="e.g., The Weeknd" value={originalArtist} onChange={(e) => setOriginalArtist(e.target.value)} />
              </div>
            </div>
            
            {/* Lyric Fetching Controls */}
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button 
                    onClick={() => handleFetchLyrics(false)}
                    disabled={isFetchingLyrics || !originalTitle || !originalArtist}
                    className="flex-1 bg-gray-800 hover:bg-gray-600 text-gray-300 border border-gray-600 py-2 px-4 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                    {isFetchingLyrics ? 'Fetching...' : 'Get Original Lyrics'}
                </button>
                <button 
                    onClick={() => handleFetchLyrics(true)}
                    disabled={isFetchingLyrics || !originalTitle || !originalArtist}
                    className="flex-1 bg-gray-800 hover:bg-purple-900/50 text-purple-300 border border-purple-500/50 py-2 px-4 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center"
                    title="Rewrites lyrics to match the 'New Music Style'"
                >
                    {isFetchingLyrics ? 'Adapting...' : 'Get Adapted Lyrics'}
                </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">Tip: Fetch lyrics to populate the editor below, then you can add your own verses or edits before generating.</p>
          </div>
        )}
        
        <div>
           <div className="flex justify-between items-center mb-2">
            <label htmlFor="lyrics" className="block text-sm font-medium text-gray-300">
              Lyrics
            </label>
            <label htmlFor="lyrics-file-upload" className="flex items-center text-sm text-purple-400 hover:text-purple-300 cursor-pointer font-medium transition-colors">
              <UploadIcon className="h-5 w-5 mr-2 text-purple-400" />
              <span>Upload Lyrics</span>
              <input 
                id="lyrics-file-upload"
                type="file"
                accept=".txt,.md"
                className="hidden"
                onChange={handleLyricsFileUpload}
                disabled={isGenerating}
              />
            </label>
          </div>
          <textarea
            id="lyrics"
            rows={8}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
            placeholder={studioMode === StudioMode.Cover ? "Fetch lyrics above or type your own..." : "Enter your lyrics here..."}
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            readOnly={isGenerating}
          />
          <p className="text-xs text-gray-500 mt-2">You can paste lyrics directly or upload a text file (up to 3GB).</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="style" className="block text-sm font-medium text-gray-300 mb-2">New Music Style</label>
            <input
              id="style"
              type="text"
              className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
              placeholder="e.g., Sad acoustic ballad"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="bpm" className="block text-sm font-medium text-gray-300 mb-2">BPM: <span className="font-bold text-purple-400">{bpm}</span></label>
            <input
              id="bpm"
              type="range"
              min="60"
              max="180"
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
          </div>
           <div className="md:col-span-2">
            <label htmlFor="voice-select" className="block text-sm font-medium text-gray-300 mb-2">Cloned Voice</label>
            <select
                id="voice-select"
                value={selectedVoiceId}
                onChange={(e) => setSelectedVoiceId(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 focus:ring-2 focus:ring-purple-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition"
                disabled={clonedVoices.length === 0}
            >
                <option value="" disabled>
                    {clonedVoices.length === 0 ? "No voices available" : "Select a voice..."}
                </option>
                {clonedVoices.map(voice => (
                    <option key={voice.id} value={voice.id}>{voice.name}</option>
                ))}
            </select>
             <p className="text-xs text-gray-500 mt-1">
                {clonedVoices.length === 0 
                    ? "Go to the Voice Lab to clone a voice. " 
                    : "Or, use a premium voice with an "
                }
                <span className="font-semibold">ElevenLabs key</span> in the Model Manager.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={handleGenerateMusic}
            disabled={isGenerating}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-bold py-2 px-6 rounded-lg transition-all duration-300 shadow-lg"
          >
            {isGenerating ? 'Generating...' : 'Generate Music'}
          </button>
        </div>
      </div>

      {generatedTracks.length > 0 && !isGenerating && (
        <div className="mt-8 p-3 bg-gray-700 rounded-lg animate-fade-in">
          <h3 className="text-lg font-semibold mb-3">Latest Generated Track</h3>
          <AudioPlayer playlist={generatedTracks} />
        </div>
      )}
    </div>
  );
};

export default Studio;
