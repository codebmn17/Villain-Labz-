import React, { useState, useEffect } from 'react';
import { elevenLabsGenerate } from '../services/elevenLabsService';
import { researchAndAdaptSong, findSongLyrics } from '../services/geminiService';
import { PlayIcon } from './icons/PlayIcon';
import { StopIcon } from './icons/StopIcon';
import { StudioMode } from '../types';

interface StudioProps {
  clonedVoice: File | null;
  elevenLabsKey: string;
}

const Studio: React.FC<StudioProps> = ({ clonedVoice, elevenLabsKey }) => {
  const [studioMode, setStudioMode] = useState<StudioMode>(StudioMode.Original);
  const [lyrics, setLyrics] = useState('');
  const [style, setStyle] = useState('Dark Synthwave with heavy bass');
  const [bpm, setBpm] = useState(120);
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalArtist, setOriginalArtist] = useState('');
  const [shouldAdaptLyrics, setShouldAdaptLyrics] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [generatedAudioUrl]);


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

    if (!clonedVoice && !elevenLabsKey) {
        setError('Please clone a voice in the Voice Lab or add an ElevenLabs API key in the Model Manager.');
        return;
    }

    setError(null);
    setIsGenerating(true);
    setGeneratedAudioUrl(null);

    try {
        let lyricsToGenerate = lyrics;

        if (studioMode === StudioMode.Cover) {
            setGenerationStatus('Researching song via web...');
            await new Promise(res => setTimeout(res, 1000));
            
            const fetchedLyrics = shouldAdaptLyrics
                ? await researchAndAdaptSong(originalTitle, originalArtist, style)
                : await findSongLyrics(originalTitle, originalArtist);
            
            setLyrics(fetchedLyrics);
            lyricsToGenerate = fetchedLyrics;

            setGenerationStatus('Analyzing musical structure...');
            await new Promise(res => setTimeout(res, 1500));
        }

        setGenerationStatus('Generating vocals & instrumentals...');
        await new Promise(res => setTimeout(res, 1000));
        
        const audioUrl = await elevenLabsGenerate(lyricsToGenerate, elevenLabsKey);
        setGeneratedAudioUrl(audioUrl);

    } catch (e) {
        setError('Failed to generate audio. Please try again.');
    } finally {
        setIsGenerating(false);
        setGenerationStatus('');
    }
  };

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (audio) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play();
      }
    }
  };

  const handleDownload = (format: 'wav' | 'mp3') => {
    if (!generatedAudioUrl) {
      setError("No audio to download.");
      return;
    }
    
    // In a real app, converting to MP3 would require a client-side library.
    // For this demo, we'll download the original WAV blob with the chosen file extension.
    const link = document.createElement('a');
    link.href = generatedAudioUrl;
    link.download = `villain-labz-track-${Date.now()}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    <div className="bg-gray-800 p-4 rounded-xl shadow-2xl animate-fade-in">
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
          <label htmlFor="lyrics" className="block text-sm font-medium text-gray-300 mb-2">
            {getLyricsLabel()}
          </label>
          <textarea
            id="lyrics"
            rows={8}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
            placeholder={getLyricsPlaceholder()}
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            readOnly={studioMode === StudioMode.Cover && isGenerating}
          />
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
      
      {isGenerating && (
        <div className="mt-6 text-center">
            <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-purple-400 mx-auto"></div>
            <p className="mt-4 text-gray-300 font-semibold animate-pulse">{generationStatus}</p>
        </div>
      )}

      {generatedAudioUrl && !isGenerating && (
        <div className="mt-8 p-3 bg-gray-700 rounded-lg animate-fade-in">
          <h3 className="text-lg font-semibold mb-3">Generated Track</h3>
          <div className="flex items-center space-x-4">
            <button onClick={togglePlayback} className="p-2 bg-purple-600 rounded-full hover:bg-purple-700 transition">
              {isPlaying ? <StopIcon /> : <PlayIcon />}
            </button>
            <div className="flex-1">
                <audio ref={audioRef} src={generatedAudioUrl} controls className="w-full"/>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-600">
            <h4 className="text-md font-semibold mb-2 text-gray-300">Export Options</h4>
            <div className="flex space-x-3">
                <button 
                    onClick={() => handleDownload('wav')}
                    className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                >
                    Download WAV
                </button>
                <button 
                    onClick={() => handleDownload('mp3')}
                    className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
                >
                    Download MP3
                </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Note: MP3 conversion is simulated. The downloaded file will be in WAV format.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Studio;