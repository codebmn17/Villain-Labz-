import React, { useState, useEffect } from 'react';
import { elevenLabsGenerate } from '../services/elevenLabsService';
import { researchAndAdaptSong, findSongLyrics } from '../services/geminiService';
import { UploadIcon } from './icons/UploadIcon';
import { ClonedVoice, StudioMode, AudioPlaylistItem } from '../types';
import AudioPlayer from './AudioPlayer';

interface StudioProps {
  clonedVoices: ClonedVoice[];
  elevenLabsKey: string;
  generatedTracks: AudioPlaylistItem[];
  setGeneratedTracks: (tracks: AudioPlaylistItem[]) => void;
}

const Studio: React.FC<StudioProps> = ({ clonedVoices, elevenLabsKey, generatedTracks, setGeneratedTracks }) => {
  const [studioMode, setStudioMode] = useState<StudioMode>(StudioMode.Original);
  const [lyrics, setLyrics] = useState('');
  const [style, setStyle] = useState('Dark Synthwave with heavy bass');
  const [bpm, setBpm] = useState(120);
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalArtist, setOriginalArtist] = useState('');
  const [shouldAdaptLyrics, setShouldAdaptLyrics] = useState(true);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

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


  const handleGenerateMusic = async () => {
    if (studioMode === StudioMode.Cover) {
        if (!originalTitle || !originalArtist) {
            setError('Please provide the original song title and artist.');
            return;
        }
    } else { // Original mode
        if (!lyrics || !style) {
            setError('Please provide lyrics and a music style.');
            return;
        }
    }

    if (!selectedVoiceId && !elevenLabsKey) {
        setError('Please select a cloned voice or add an ElevenLabs API key in the Model Manager.');
        return;
    }

    setError(null);
    setIsGenerating(true);
    setGenerationStatus('');

    try {
        let lyricsToGenerate = lyrics;

        if (studioMode === StudioMode.Cover) {
            setGenerationStatus('Researching song via web...');
            
            const fetchedLyrics = shouldAdaptLyrics
                ? await researchAndAdaptSong(originalTitle, originalArtist, style)
                : await findSongLyrics(originalTitle, originalArtist);
            
            setLyrics(fetchedLyrics);
            lyricsToGenerate = fetchedLyrics;

            setGenerationStatus('Analyzing musical structure...');
            await new Promise(res => setTimeout(res, 1500));
        }

        setGenerationStatus('Generating vocals & instrumentals...');
        
        const audioUrl = await elevenLabsGenerate(lyricsToGenerate, elevenLabsKey);
        
        const newTrack: AudioPlaylistItem = {
          id: Date.now().toString(),
          src: audioUrl,
          title: studioMode === StudioMode.Cover ? originalTitle : `Original Track - ${style.substring(0, 20)}`,
          artist: studioMode === StudioMode.Cover ? originalArtist : 'Villain Labz',
        };
        setGeneratedTracks([...generatedTracks, newTrack]);

    } catch (e) {
        console.error("Generation Error:", e);
        if (e instanceof Error) {
            if (e.message.includes('ELEVENLABS_API_KEY_REQUIRED')) {
                setError('An ElevenLabs API key is required for longer audio generation. Please add one in the Model Manager.');
            } else if (e.message.includes('research')) {
                setError('Failed to research the song. The web might be unreachable or the song could not be found.');
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

  const getLyricsLabel = () => {
    if (studioMode === StudioMode.Cover) {
      return shouldAdaptLyrics ? "Adapted Lyrics (AI will generate this)" : "Original Lyrics (Fetched by AI)";
    }
    return "Lyrics";
  };

  const getLyricsPlaceholder = () => {
    if (studioMode === StudioMode.Cover) {
      return shouldAdaptLyrics 
        ? "AI will research the original song and adapt the lyrics based on your chosen style." 
        : "AI will research and fetch the original song lyrics here for you to use or edit.";
    }
    return "Enter your lyrics here...";
  };

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
      

      {error && <p className="text-red-400 bg-red-900/50 p-2 rounded-md mb-4">{error}</p>}

      <div className="space-y-6">
        {studioMode === StudioMode.Cover && (
          <div className="p-3 bg-gray-700/50 rounded-lg animate-fade-in">
            <h3 className="text-lg font-semibold text-purple-300 mb-3">Cover Song Details</h3>
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
             <div className="flex items-center mt-4">
                <input 
                    id="adaptLyrics" 
                    type="checkbox" 
                    checked={shouldAdaptLyrics} 
                    onChange={(e) => setShouldAdaptLyrics(e.target.checked)} 
                    className="h-4 w-4 text-purple-600 bg-gray-900 border-gray-600 rounded focus:ring-purple-500 cursor-pointer" 
                />
                <label htmlFor="adaptLyrics" className="ml-3 block text-sm text-gray-300">
                    Have AI adapt lyrics to the new style
                </label>
            </div>
            <p className="text-xs text-gray-500 mt-3">Connecting to Spotify can enhance song data research.</p>
          </div>
        )}
        
        <div>
           <div className="flex justify-between items-center mb-2">
            <label htmlFor="lyrics" className="block text-sm font-medium text-gray-300">
              {getLyricsLabel()}
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
                disabled={studioMode === StudioMode.Cover && isGenerating}
              />
            </label>
          </div>
          <textarea
            id="lyrics"
            rows={8}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
            placeholder={getLyricsPlaceholder()}
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            readOnly={studioMode === StudioMode.Cover && isGenerating}
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
            {isGenerating ? 'Generating...' : (studioMode === StudioMode.Cover ? 'Generate Cover' : 'Generate Music')}
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