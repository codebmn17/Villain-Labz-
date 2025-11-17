import React, { useState, useEffect } from 'react';
import { elevenLabsGenerate } from '../services/elevenLabsService';
import { PlayIcon } from './icons/PlayIcon';
import { StopIcon } from './icons/StopIcon';

interface StudioProps {
  clonedVoice: File | null;
  elevenLabsKey: string;
}

const Studio: React.FC<StudioProps> = ({ clonedVoice, elevenLabsKey }) => {
  const [lyrics, setLyrics] = useState('');
  const [style, setStyle] = useState('Dark Synthwave with heavy bass');
  const [bpm, setBpm] = useState(120);
  const [isGenerating, setIsGenerating] = useState(false);
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


  const handleGenerate = async () => {
    if (!lyrics || !style) {
      setError('Please provide lyrics and a music style.');
      return;
    }
    if (!clonedVoice && !elevenLabsKey) {
      setError('Please clone a voice in the Voice Lab or add an ElevenLabs API key in the Model Manager.');
      return;
    }

    setError(null);
    setIsGenerating(true);
    setGeneratedAudioUrl(null);

    try {
      // Simulate using ElevenLabs if key is provided, otherwise use "cloned voice"
      const audioUrl = await elevenLabsGenerate(lyrics, elevenLabsKey);
      setGeneratedAudioUrl(audioUrl);
    } catch (e) {
      setError('Failed to generate audio. Please try again.');
    } finally {
      setIsGenerating(false);
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

  return (
    <div className="bg-gray-800 p-6 rounded-xl shadow-2xl animate-fade-in">
      <h2 className="text-3xl font-bold text-purple-400 mb-2">Studio</h2>
      <p className="text-gray-400 mb-6">Compose your masterpiece. Write lyrics, define the style, and let the AI generate the track using your voice.</p>

      {error && <p className="text-red-400 bg-red-900/50 p-3 rounded-md mb-4">{error}</p>}

      <div className="space-y-6">
        <div>
          <label htmlFor="lyrics" className="block text-sm font-medium text-gray-300 mb-2">Lyrics</label>
          <textarea
            id="lyrics"
            rows={8}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
            placeholder="Enter your lyrics here..."
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="style" className="block text-sm font-medium text-gray-300 mb-2">Music Style</label>
            <input
              id="style"
              type="text"
              className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
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

        <div className="flex justify-end">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-lg transition-all duration-300 shadow-lg"
          >
            {isGenerating ? 'Generating...' : 'Generate Music'}
          </button>
        </div>
      </div>
      
      {isGenerating && (
        <div className="mt-6 text-center">
            <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-purple-400 mx-auto"></div>
            <p className="mt-4 text-gray-300">The AI is composing your track...</p>
        </div>
      )}

      {generatedAudioUrl && (
        <div className="mt-8 p-4 bg-gray-700 rounded-lg">
          <h3 className="text-lg font-semibold mb-3">Generated Track</h3>
          <div className="flex items-center space-x-4">
            <button onClick={togglePlayback} className="p-3 bg-purple-600 rounded-full hover:bg-purple-700 transition">
              {isPlaying ? <StopIcon /> : <PlayIcon />}
            </button>
            <div className="w-full bg-gray-600 rounded-full h-2.5">
                <div className="bg-purple-500 h-2.5 rounded-full" style={{width: "45%"}}></div>
            </div>
            <audio ref={audioRef} src={generatedAudioUrl} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Studio;
