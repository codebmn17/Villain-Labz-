
import React, { useState, useRef } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { ClonedVoice } from '../types';
import { PencilIcon } from './icons/PencilIcon';
import { TrashIcon } from './icons/TrashIcon';

interface VoiceLabProps {
  setClonedVoices: (voices: ClonedVoice[]) => void;
  clonedVoices: ClonedVoice[];
}

const VoiceLab: React.FC<VoiceLabProps> = ({ setClonedVoices, clonedVoices }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingVoice, setEditingVoice] = useState<{id: string, name: string} | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const showSuccessMessage = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleAddVoice = (file: File) => {
    const newVoice: ClonedVoice = {
      id: Date.now().toString(),
      name: file.name || `Recording-${new Date().toLocaleDateString()}`,
      file: file,
      cloneDate: new Date().toISOString(),
    };
    setClonedVoices([...clonedVoices, newVoice]);
    showSuccessMessage(`Voice "${newVoice.name}" cloned successfully!`);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('audio/')) {
        setError(null);
        setIsUploading(true);
        // Simulate upload/processing delay
        setTimeout(() => {
          handleAddVoice(file);
          setIsUploading(false);
        }, 1500);
      } else {
        setError('Please upload a valid audio file.');
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
        const audioFile = new File([audioBlob], `recording-${new Date().toISOString()}.wav`, { type: 'audio/wav' });
        handleAddVoice(audioFile);
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

  const handleDelete = (voiceId: string) => {
    if (window.confirm("Are you sure you want to delete this voice? This action cannot be undone.")) {
        setClonedVoices(clonedVoices.filter(v => v.id !== voiceId));
    }
  };

  const handleStartRename = (voice: ClonedVoice) => {
    setEditingVoice({ id: voice.id, name: voice.name });
  };
  
  const handleConfirmRename = () => {
    if (editingVoice && editingVoice.name.trim()) {
        setClonedVoices(clonedVoices.map(v => 
            v.id === editingVoice.id ? { ...v, name: editingVoice.name.trim() } : v
        ));
        setEditingVoice(null);
    }
  };
  
  const handleCancelRename = () => {
    setEditingVoice(null);
  };


  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-2xl animate-fade-in">
      <h2 className="text-3xl font-bold text-purple-400 mb-2">Voice Lab</h2>
      <p className="text-gray-400 mb-6">Clone your voice by uploading a high-quality audio sample or recording yourself. Clear, mono audio without background noise works best.</p>
      
      {error && <p className="text-red-400 bg-red-900/50 p-2 rounded-md mb-4">{error}</p>}
      {successMessage && (
        <div className="bg-green-900/50 text-green-300 p-3 rounded-lg mb-6 text-center">
            <p className="font-semibold">{successMessage}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center flex flex-col items-center justify-center hover:border-purple-500 transition-colors relative">
          <UploadIcon />
          <p className="mt-4 text-gray-300">Drag & drop an audio file or click to browse</p>
          <p className="text-xs text-gray-500 mt-1">Max file size: 3GB</p>
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

       <div className="mt-8">
        <h3 className="text-xl font-semibold text-purple-300 mb-4">Voice Library</h3>
        {clonedVoices.length === 0 ? (
            <div className="text-center text-gray-500 bg-gray-900/50 p-6 rounded-lg">
                <p>Your cloned voices will appear here.</p>
            </div>
        ) : (
            <ul className="space-y-3">
                {clonedVoices.map(voice => (
                    <li key={voice.id} className="bg-gray-700 p-3 rounded-lg flex items-center justify-between transition-all duration-300">
                        {editingVoice?.id === voice.id ? (
                            <div className="flex-1 flex items-center gap-2" onBlur={handleCancelRename}>
                                <input 
                                    type="text" 
                                    value={editingVoice.name}
                                    onChange={(e) => setEditingVoice({...editingVoice, name: e.target.value})}
                                    onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
                                    className="bg-gray-800 border border-purple-500 rounded-md p-1 text-white w-full"
                                    autoFocus
                                 />
                                 <button onClick={handleConfirmRename} className="text-green-400 hover:text-green-300 text-sm font-bold">Save</button>
                                 <button onClick={handleCancelRename} className="text-gray-400 hover:text-white text-sm">Cancel</button>
                            </div>
                        ) : (
                            <>
                              <div className="flex-1 overflow-hidden">
                                  <p className="font-semibold text-white truncate" title={voice.name}>{voice.name}</p>
                                  <p className="text-xs text-gray-400">Cloned on: {new Date(voice.cloneDate).toLocaleDateString()}</p>
                              </div>
                              <div className="flex items-center space-x-3 ml-4 flex-shrink-0">
                                  <button onClick={() => handleStartRename(voice)} className="text-gray-400 hover:text-purple-400 transition-colors" aria-label={`Rename ${voice.name}`}>
                                      <PencilIcon />
                                  </button>
                                  <button onClick={() => handleDelete(voice.id)} className="text-gray-400 hover:text-red-500 transition-colors" aria-label={`Delete ${voice.name}`}>
                                      <TrashIcon />
                                  </button>
                              </div>
                            </>
                        )}
                    </li>
                ))}
            </ul>
        )}
      </div>
    </div>
  );
};

export default VoiceLab;
