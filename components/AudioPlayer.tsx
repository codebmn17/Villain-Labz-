
import React, { useState, useRef, useEffect } from 'react';
import { PlayIcon } from './icons/PlayIcon';
import { StopIcon } from './icons/StopIcon';
import { VolumeIcon } from './icons/VolumeIcon';
import { NextIcon } from './icons/NextIcon';
import { PrevIcon } from './icons/PrevIcon';
import { EqIcon } from './icons/EqIcon';
import { AudioPlaylistItem } from '../types';

interface AudioPlayerProps {
  playlist: AudioPlaylistItem[];
}

const EQ_FREQUENCIES = [60, 310, 1000, 6000, 16000]; // 5-band EQ
const EQ_PRESETS: { [name: string]: number[] } = {
    'Flat': [0, 0, 0, 0, 0],
    'Bass Boost': [6, 4, 0, -2, -3],
    'Vocal Booster': [-2, -1, 3, 4, 2],
    'Treble Boost': [-2, -1, 0, 4, 6],
    'Rock': [5, 2, -2, 3, 4],
    'Pop': [-1, 2, 3, 2, -1],
};


const AudioPlayer: React.FC<AudioPlayerProps> = ({ playlist }) => {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [lastVolume, setLastVolume] = useState(1);

  // EQ State
  const [isEqVisible, setIsEqVisible] = useState(false);
  const [eqGains, setEqGains] = useState<number[]>(EQ_PRESETS['Flat']);
  const [activePreset, setActivePreset] = useState('Flat');

  const audioRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const currentTrack = playlist?.[currentTrackIndex];

  // Reset to first track and auto-play when playlist changes
  useEffect(() => {
    if (playlist.length > 0) {
      setCurrentTrackIndex(playlist.length - 1);
    }
  }, [playlist.length]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const setAudioData = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      setCurrentTime(audio.currentTime);
    };
    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const handlePlaybackEnd = () => handleNext();

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handlePlaybackEnd);

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handlePlaybackEnd);
    };
  }, [currentTrackIndex, playlist]); // Re-attach listeners if track changes

  // Audio source and playback control
  useEffect(() => {
    const audio = audioRef.current;
    if (audio && currentTrack?.src) {
        // If source changed, update it
        if (audio.src !== currentTrack.src) {
            audio.src = currentTrack.src;
        }
        
        // Play with error handling for interruptions
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => setIsPlaying(true))
                .catch((error) => {
                    // Ignore AbortError which happens when skipping tracks rapidly
                    if (error.name === 'AbortError' || error.message.includes('interrupted')) {
                        // console.log('Playback interrupted by new load');
                    } else {
                        console.error("Playback error:", error);
                    }
                    setIsPlaying(false);
                });
        }
    }
  }, [currentTrack]);
  

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);
  
  // Update EQ filter gains when state changes
  useEffect(() => {
    if (filtersRef.current.length > 0) {
        eqGains.forEach((gain, index) => {
            if (filtersRef.current[index]) {
                filtersRef.current[index].gain.value = gain;
            }
        });
    }
  }, [eqGains]);

  const initAudioContext = () => {
    if (!audioCtxRef.current && audioRef.current) {
        const context = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = context.createMediaElementSource(audioRef.current);
        
        const newFilters = EQ_FREQUENCIES.map((freq, i) => {
            const filter = context.createBiquadFilter();
            filter.type = i === 0 ? 'lowshelf' : i === EQ_FREQUENCIES.length - 1 ? 'highshelf' : 'peaking';
            filter.frequency.value = freq;
            filter.gain.value = eqGains[i];
            filter.Q.value = 1;
            return filter;
        });

        // Chain the audio source through the filters to the destination
        source.connect(newFilters[0]);
        for (let i = 0; i < newFilters.length - 1; i++) {
            newFilters[i].connect(newFilters[i + 1]);
        }
        newFilters[newFilters.length - 1].connect(context.destination);

        audioCtxRef.current = context;
        sourceNodeRef.current = source;
        filtersRef.current = newFilters;
    }
  };


  const togglePlayPause = () => {
    if (!audioCtxRef.current) {
        initAudioContext();
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };
  
  const handleNext = () => {
    if (currentTrackIndex < playlist.length - 1) {
      setCurrentTrackIndex(prev => prev + 1);
    } else {
        setIsPlaying(false);
        if(audioRef.current) audioRef.current.currentTime = 0;
    }
  };

  const handlePrev = () => {
    if (currentTrackIndex > 0) {
      setCurrentTrackIndex(prev => prev - 1);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) audioRef.current.currentTime = newTime;
  };
  
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0) setIsMuted(false);
  };
  
  const toggleMute = () => {
      if (isMuted) {
          setIsMuted(false);
          setVolume(lastVolume > 0 ? lastVolume : 0.5);
      } else {
          setLastVolume(volume);
          setIsMuted(true);
          setVolume(0);
      }
  };

  const handleEqGainChange = (index: number, value: number) => {
    const newGains = [...eqGains];
    newGains[index] = value;
    setEqGains(newGains);
    setActivePreset('Custom'); // User is making a custom adjustment
  };

  const handlePresetChange = (presetName: string) => {
    if (EQ_PRESETS[presetName]) {
        setEqGains(EQ_PRESETS[presetName]);
        setActivePreset(presetName);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time <= 0) return '00:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;
  if (!playlist || playlist.length === 0) return null;

  return (
    <div className="bg-gray-900/50 p-4 rounded-lg w-full flex flex-col space-y-3">
      <audio ref={audioRef} preload="metadata" crossOrigin="anonymous"></audio>
      
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
            <button onClick={handlePrev} disabled={currentTrackIndex === 0} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed">
                <PrevIcon />
            </button>
            <button onClick={togglePlayPause} className="p-2 bg-purple-600 rounded-full hover:bg-purple-700 transition flex-shrink-0">
                {isPlaying ? <StopIcon /> : <PlayIcon />}
            </button>
            <button onClick={handleNext} disabled={currentTrackIndex === playlist.length - 1} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed">
                <NextIcon />
            </button>
        </div>

        <div className="flex-grow">
            <p className="text-white font-semibold truncate" title={currentTrack.title}>{currentTrack.title}</p>
            <p className="text-gray-400 text-sm truncate" title={currentTrack.artist}>{currentTrack.artist}</p>
        </div>

        <div className="hidden lg:flex items-center space-x-2 w-1/3">
            <span className="text-xs text-gray-400 font-mono w-12 text-center">{formatTime(currentTime)}</span>
            <div className="relative w-full h-2 flex items-center group">
                <input
                    type="range" min="0" max={duration || 0} step="0.01" value={currentTime} onChange={handleProgressChange}
                    className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    style={{ background: `linear-gradient(to right, #8b5cf6 ${progressPercent}%, #4b5563 ${progressPercent}%)` }}
                />
            </div>
            <span className="text-xs text-gray-400 font-mono w-12 text-center">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center space-x-2">
            <button onClick={toggleMute} className="text-gray-400 hover:text-white transition">
                <VolumeIcon volume={isMuted ? 0 : volume} />
            </button>
            <input 
                type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : volume} onChange={handleVolumeChange}
                className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <button onClick={() => setIsEqVisible(!isEqVisible)} className={`p-1 rounded-full transition ${isEqVisible ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                <EqIcon />
            </button>
        </div>
      </div>
       {isEqVisible && (
        <div className="p-3 bg-gray-800 rounded-md animate-fade-in mt-2 space-y-4">
            <div className="max-w-xs">
                <label htmlFor="eq-preset" className="block text-sm font-medium text-gray-300 mb-1">EQ Preset</label>
                <select
                    id="eq-preset"
                    value={activePreset}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md p-1 text-sm text-gray-100 focus:ring-2 focus:ring-purple-500"
                >
                    <option value="Custom" disabled>Custom</option>
                    {Object.keys(EQ_PRESETS).map(name => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-6 gap-y-3">
                {EQ_FREQUENCIES.map((freq, index) => (
                    <div key={freq} className="flex flex-col items-center">
                        <label className="text-xs font-bold text-gray-400 mb-2">{freq < 1000 ? `${freq}Hz` : `${freq/1000}kHz`}</label>
                        <input
                            type="range"
                            min="-12"
                            max="12"
                            step="0.1"
                            value={eqGains[index]}
                            onChange={(e) => handleEqGainChange(index, parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                        <span className="text-xs text-purple-400 mt-1 font-mono">{eqGains[index].toFixed(1)} dB</span>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;
