import React, { useState, useRef, useEffect } from 'react';
import { PlayIcon } from './icons/PlayIcon';
import { StopIcon } from './icons/StopIcon';
import { VolumeIcon } from './icons/VolumeIcon';
import { NextIcon } from './icons/NextIcon';
import { PrevIcon } from './icons/PrevIcon';
import { AudioPlaylistItem } from '../types';

interface AudioPlayerProps {
  playlist: AudioPlaylistItem[];
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ playlist }) => {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [lastVolume, setLastVolume] = useState(1);

  const audioRef = useRef<HTMLAudioElement>(null);
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
        if (audio.src !== currentTrack.src) {
            audio.src = currentTrack.src;
        }
        audio.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  }, [currentTrack]);
  

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
      <audio ref={audioRef} preload="metadata"></audio>
      
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

        <div className="flex items-center space-x-2 w-1/3">
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
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
