import React, { useState, useRef, useEffect } from 'react';
import { PlayIcon } from './icons/PlayIcon';
import { StopIcon } from './icons/StopIcon';
import { VolumeIcon } from './icons/VolumeIcon';

interface AudioPlayerProps {
  src: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [lastVolume, setLastVolume] = useState(1);

  const audioRef = useRef<HTMLAudioElement>(null);

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
    
    const handlePlaybackEnd = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handlePlaybackEnd);

    // Auto-play when a new src is provided
    if (src) {
        audio.play().then(() => {
            setIsPlaying(true);
        }).catch(error => {
            console.error("Autoplay failed:", error);
            setIsPlaying(false);
        });
    }

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handlePlaybackEnd);
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);
  
  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };
  
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0) {
        setIsMuted(false);
    }
  };
  
  const toggleMute = () => {
      if (isMuted) {
          setIsMuted(false);
          setVolume(lastVolume > 0 ? lastVolume : 0.5); // Restore last volume or a default
      } else {
          setLastVolume(volume);
          setIsMuted(true);
          setVolume(0);
      }
  };

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds) || timeInSeconds <= 0) return '00:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const currentPercentage = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-gray-900/50 p-4 rounded-lg w-full flex flex-col space-y-3">
      <audio ref={audioRef} src={src} preload="metadata"></audio>
      
      <div className="flex items-center space-x-4">
        <button onClick={togglePlayPause} className="p-2 bg-purple-600 rounded-full hover:bg-purple-700 transition flex-shrink-0" aria-label={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? <StopIcon /> : <PlayIcon />}
        </button>

        <span className="text-xs text-gray-400 font-mono w-12 text-center" aria-label="Current time">{formatTime(currentTime)}</span>
        
        <div className="relative w-full h-2 flex items-center group">
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.01"
            value={currentTime}
            onChange={handleProgressChange}
            className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
            style={{
                background: `linear-gradient(to right, #8b5cf6 ${currentPercentage}%, #4b5563 ${currentPercentage}%)`
            }}
            aria-label="Seek slider"
          />
        </div>
        
        <span className="text-xs text-gray-400 font-mono w-12 text-center" aria-label="Total duration">{formatTime(duration)}</span>

        <div className="flex items-center space-x-2">
            <button onClick={toggleMute} className="text-gray-400 hover:text-white transition" aria-label={isMuted ? "Unmute" : "Mute"}>
                <VolumeIcon volume={isMuted ? 0 : volume} />
            </button>
            <input 
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-24 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                aria-label="Volume slider"
            />
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
