
import React, { useState, useRef, useEffect } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { ClonedVoice } from '../types';
import { PencilIcon } from './icons/PencilIcon';
import { TrashIcon } from './icons/TrashIcon';
import { addVoice, getVoices } from '../services/elevenLabsService';
import { PlayIcon } from './icons/PlayIcon';
import { StopIcon } from './icons/StopIcon';

interface VoiceLabProps {
  setClonedVoices: (voices: ClonedVoice[]) => void;
  clonedVoices: ClonedVoice[];
  elevenLabsKey: string;
}

const VoiceLab: React.FC<VoiceLabProps> = ({ setClonedVoices, clonedVoices, elevenLabsKey }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editingVoice, setEditingVoice] = useState<{id: string, name: string} | null>(null);
  
  // New Creation State
  const [creationStep, setCreationStep] = useState<'select' | 'details'>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [voiceName, setVoiceName] = useState('');
  const [voiceDescription, setVoiceDescription] = useState('');
  
  // Audio Playback State
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [playingPreviewId, setPlayingPreviewId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
      // Load voices from API on mount if key exists
      if (elevenLabsKey) {
          loadVoices();
      }
  }, [elevenLabsKey]);

  const loadVoices = async () => {
      try {
          const voices = await getVoices(elevenLabsKey);
          if(voices.length > 0) setClonedVoices(voices);
      } catch (e) {
          console.error("Failed to load voices", e);
      }
  };

  const showSuccessMessage = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };
  
  // --- Audio Visualizer ---
  const drawVisualizer = () => {
      if (!analyserRef.current || !canvasRef.current) return;
      
      const canvas = canvasRef.current;
      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) return;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
          animationFrameRef.current = requestAnimationFrame(draw);
          analyserRef.current!.getByteTimeDomainData(dataArray);

          canvasCtx.fillStyle = 'rgb(31, 41, 55)'; // Match bg-gray-800
          canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

          canvasCtx.lineWidth = 2;
          canvasCtx.strokeStyle = 'rgb(167, 139, 250)'; // Purple-400
          canvasCtx.beginPath();

          const sliceWidth = canvas.width * 1.0 / bufferLength;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
              const v = dataArray[i] / 128.0;
              const y = v * canvas.height / 2;

              if (i === 0) {
                  canvasCtx.moveTo(x, y);
              } else {
                  canvasCtx.lineTo(x, y);
              }
              x += sliceWidth;
          }

          canvasCtx.lineTo(canvas.width, canvas.height / 2);
          canvasCtx.stroke();
      };
      draw();
  };

  // --- File Handling ---
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 369 * 1024 * 1024) {
          setError('File is too large. Maximum size is 369MB.');
          return;
      }

      if (file.type.startsWith('audio/')) {
        setError(null);
        setSelectedFile(file);
        setVoiceName(file.name.split('.')[0]);
        setCreationStep('details');
      } else {
        setError('Please upload a valid audio file.');
      }
    }
  };

  // --- Recording Handling ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup Visualizer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;
      drawVisualizer();

      setIsRecording(true);
      setError(null);
      audioChunksRef.current = [];
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioFile = new File([audioBlob], `recording-${new Date().toLocaleTimeString()}.wav`, { type: 'audio/wav' });
        setSelectedFile(audioFile);
        setVoiceName(`Recording ${new Date().toLocaleTimeString()}`);
        setCreationStep('details');
        
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        stream.getTracks().forEach(track => track.stop());
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

  // --- Final Creation ---
  const handleCreateVoice = async () => {
      if (!selectedFile || !voiceName) return;
      
      setIsUploading(true);
      try {
          const newVoice = await addVoice(voiceName, voiceDescription, [selectedFile], elevenLabsKey);
          setClonedVoices([newVoice, ...clonedVoices]);
          showSuccessMessage(`Voice "${newVoice.name}" created successfully!`);
          
          // Reset Form
          setCreationStep('select');
          setSelectedFile(null);
          setVoiceName('');
          setVoiceDescription('');
      } catch (e: any) {
          setError(e.message || 'Failed to clone voice.');
      } finally {
          setIsUploading(false);
      }
  };

  // --- UI Helpers ---
  const handlePreview = (url: string | undefined, id: string) => {
      if (!url) return;
      
      if (playingPreviewId === id && previewAudio) {
          previewAudio.pause();
          setPlayingPreviewId(null);
          return;
      }

      if (previewAudio) {
          previewAudio.pause();
      }

      const audio = new Audio(url);
      audio.onended = () => setPlayingPreviewId(null);
      audio.play();
      setPreviewAudio(audio);
      setPlayingPreviewId(id);
  };

  const handleDelete = (voiceId: string) => {
    if (window.confirm("Are you sure you want to delete this voice? This action cannot be undone.")) {
        setClonedVoices(clonedVoices.filter(v => v.id !== voiceId));
    }
  };

  return (
    <div className="bg-gray-800 p-2 rounded-xl shadow-2xl animate-fade-in">
      <div className="flex justify-between items-start mb-2">
         <div>
             <h2 className="text-2xl font-bold text-purple-400 mb-0.5">Voice Lab</h2>
             <p className="text-gray-400 text-[10px]">Instant Voice Cloning. Upload a clean sample or record directly.</p>
         </div>
         {!elevenLabsKey && (
             <div className="bg-yellow-900/30 border border-yellow-700 text-yellow-500 px-1.5 py-0.5 rounded-lg text-[7px] leading-tight max-w-[150px]">
                 Note: Add ElevenLabs API Key in Model Manager. Running in simulation.
             </div>
         )}
      </div>
      
      {error && <p className="text-red-400 bg-red-900/50 p-1 rounded-md mb-2 text-[10px]">{error}</p>}
      {successMessage && (
        <div className="bg-green-900/50 text-green-300 p-1 rounded-lg mb-2 text-center text-[10px]">
            <p className="font-semibold">{successMessage}</p>
        </div>
      )}

      {/* Creation Flow */}
      <div className="bg-gray-700/30 border border-gray-700 rounded-lg p-2 mb-2">
          {creationStep === 'select' ? (
              <div className="grid md:grid-cols-2 gap-2">
                <div className="border border-dashed border-gray-600 rounded-lg p-2 text-center flex flex-col items-center justify-center hover:border-purple-500 transition-colors relative bg-gray-800/50 h-24">
                    <UploadIcon className="h-6 w-6 text-gray-500" />
                    <p className="mt-0.5 text-gray-300 font-medium text-[10px]">Upload Audio Sample</p>
                    <p className="text-[8px] text-gray-500 mt-0.5">WAV, MP3 (Max 369MB)</p>
                    <input 
                        type="file" 
                        accept="audio/*"
                        onChange={handleFileChange}
                        className="absolute w-full h-full opacity-0 cursor-pointer" 
                        disabled={isUploading || isRecording}
                    />
                </div>

                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2 text-center flex flex-col items-center justify-center relative overflow-hidden h-24">
                    {isRecording && (
                        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" width="400" height="200"></canvas>
                    )}
                    <p className="text-xs font-semibold text-gray-200 mb-1 z-10">Record Sample</p>
                    <button 
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isUploading}
                        className={`z-10 px-2 py-1 font-bold rounded-full transition-all duration-300 text-white flex items-center shadow-lg text-[10px] ${
                        isRecording 
                        ? 'bg-red-600 hover:bg-red-700 animate-pulse ring-2 ring-red-900/50' 
                        : 'bg-purple-600 hover:bg-purple-700'
                        }`}
                    >
                        <div className={`mr-1 h-1.5 w-1.5 rounded-full ${isRecording ? 'bg-white' : 'bg-red-300'}`}></div>
                        {isRecording ? 'Stop' : 'Record'}
                    </button>
                </div>
              </div>
          ) : (
              <div className="animate-fade-in">
                  <h3 className="text-xs font-semibold text-white mb-1">Voice Details</h3>
                  <div className="grid md:grid-cols-2 gap-2">
                      <div className="space-y-1">
                          <div>
                              <label className="block text-[9px] font-medium text-gray-300 mb-0.5">Voice Name</label>
                              <input 
                                type="text" 
                                value={voiceName}
                                onChange={(e) => setVoiceName(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded-md p-1 text-[10px] text-white focus:ring-1 focus:ring-purple-500"
                                placeholder="e.g. My Clone"
                              />
                          </div>
                          <div>
                              <label className="block text-[9px] font-medium text-gray-300 mb-0.5">Description</label>
                              <textarea 
                                value={voiceDescription}
                                onChange={(e) => setVoiceDescription(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-600 rounded-md p-1 text-[10px] text-white focus:ring-1 focus:ring-purple-500 h-10"
                                placeholder="Optional description..."
                              />
                          </div>
                      </div>
                      <div className="flex flex-col justify-between">
                          <div className="bg-gray-800 p-1.5 rounded-lg">
                              <p className="text-[9px] text-gray-400 mb-0.5">Selected Sample:</p>
                              <div className="flex items-center justify-between">
                                  <span className="font-mono text-purple-300 truncate max-w-[100px] text-[10px]">{selectedFile?.name}</span>
                                  <span className="text-[9px] text-gray-500">{(selectedFile?.size || 0) / 1024 > 1000 ? `${((selectedFile?.size || 0) / 1024 / 1024).toFixed(2)} MB` : `${((selectedFile?.size || 0) / 1024).toFixed(0)} KB`}</span>
                              </div>
                              {selectedFile && (
                                  <audio controls src={URL.createObjectURL(selectedFile)} className="w-full mt-1 h-5" />
                              )}
                          </div>
                          <div className="flex gap-2 mt-1">
                              <button 
                                onClick={() => setCreationStep('select')}
                                className="flex-1 px-2 py-1 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 text-[10px]"
                              >
                                  Back
                              </button>
                              <button 
                                onClick={handleCreateVoice}
                                disabled={isUploading || !voiceName}
                                className="flex-1 px-2 py-1 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-[10px]"
                              >
                                  {isUploading ? (
                                      <>
                                        <div className="w-2 h-2 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                                        Cloning...
                                      </>
                                  ) : 'Create'}
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* Library */}
       <div>
        <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-semibold text-purple-300">Voice Library</h3>
            <button onClick={loadVoices} className="text-[9px] text-gray-400 hover:text-white underline">Refresh</button>
        </div>
        
        {clonedVoices.length === 0 ? (
            <div className="text-center text-gray-500 bg-gray-900/50 p-2 rounded-lg border border-gray-700 border-dashed text-[10px]">
                <p>Your cloned voices will appear here.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {clonedVoices.map(voice => (
                    <div key={voice.id} className="bg-gray-700 p-1.5 rounded-lg border border-gray-600 hover:border-purple-500 transition-colors group">
                        <div className="flex justify-between items-start mb-0.5">
                            <div>
                                <h4 className="font-bold text-white text-xs truncate max-w-[120px]" title={voice.name}>{voice.name}</h4>
                                <span className="text-[7px] uppercase tracking-wider bg-gray-800 text-gray-400 px-1 py-0 rounded-full">
                                    {voice.category || 'Cloned'}
                                </span>
                            </div>
                            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleDelete(voice.id)} className="text-gray-400 hover:text-red-500 p-0.5 rounded">
                                    <TrashIcon className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                        
                        {voice.description && (
                            <p className="text-[9px] text-gray-400 mb-0.5 line-clamp-1">{voice.description}</p>
                        )}

                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-gray-600">
                             <span className="text-[8px] text-gray-500">{new Date(voice.cloneDate).toLocaleDateString()}</span>
                             {voice.previewUrl && (
                                 <button 
                                    onClick={() => handlePreview(voice.previewUrl, voice.id)}
                                    className={`flex items-center text-[9px] font-bold ${playingPreviewId === voice.id ? 'text-purple-400' : 'text-gray-300 hover:text-white'}`}
                                 >
                                     {playingPreviewId === voice.id ? <StopIcon className="w-2.5 h-2.5 mr-1" /> : <PlayIcon className="w-2.5 h-2.5 mr-1" />}
                                     {playingPreviewId === voice.id ? 'Stop' : 'Preview'}
                                 </button>
                             )}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
      <p className="text-[9px] text-gray-600 mt-2 text-center italic">You can also ask the AI to assist you with voice cloning directly in the Chat.</p>
    </div>
  );
};

export default VoiceLab;
