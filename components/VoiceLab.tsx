
import React, { useState, useRef, useCallback } from 'react';
import { UploadIcon } from './icons/UploadIcon';

interface VoiceLabProps {
  setClonedVoice: (file: File | null) => void;
  clonedVoice: File | null;
}

const VoiceLab: React.FC<VoiceLabProps> = ({ setClonedVoice, clonedVoice }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('audio/')) {
        setError(null);
        setIsUploading(true);
        // Simulate upload/processing delay
        setTimeout(() => {
          setClonedVoice(file);
          setIsUploading(false);
        }, 1500);
      } else {
        setError('Please upload a valid audio file.');
        setClonedVoice(null);
      }
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRecording(true);
      setError(null);
      audioChunksRef.current = [];
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
        setClonedVoice(audioFile);
        stream.getTracks().forEach(track => track.stop()); // Stop microphone
      };
      mediaRecorderRef.current.start();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  const handleRecordClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };


  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-2xl animate-fade-in">
      <h2 className="text-3xl font-bold text-purple-400 mb-2">Voice Lab</h2>
      <p className="text-gray-400 mb-6">Clone your voice by uploading a high-quality audio sample or recording yourself. Clear, mono audio without background noise works best.</p>
      
      {error && <p className="text-red-400 bg-red-900/50 p-2 rounded-md mb-4">{error}</p>}
      
      {clonedVoice && !isUploading && (
        <div className="bg-green-900/50 text-green-300 p-3 rounded-lg mb-6 text-center">
          <p className="font-semibold">Voice sample loaded: {clonedVoice.name}</p>
          <p className="text-sm">You can now use this voice in the Studio.</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center flex flex-col items-center justify-center hover:border-purple-500 transition-colors">
          <UploadIcon />
          <p className="mt-4 text-gray-300">Drag & drop an audio file or click to browse</p>
          <input 
            type="file" 
            accept="audio/*"
            onChange={handleFileChange}
            className="absolute w-full h-full opacity-0 cursor-pointer" 
            disabled={isUploading || isRecording}
          />
          {isUploading && <p className="mt-2 text-purple-400 animate-pulse">Cloning voice...</p>}
        </div>

        <div className="bg-gray-700 rounded-lg p-6 text-center flex flex-col items-center justify-center">
          <p className="text-lg font-semibold text-gray-200 mb-4">Or record audio directly</p>
          <button 
            onClick={handleRecordClick}
            disabled={isUploading}
            className={`px-4 py-2 font-bold rounded-full transition-all duration-300 text-white flex items-center ${
              isRecording 
              ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
              : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceLab;