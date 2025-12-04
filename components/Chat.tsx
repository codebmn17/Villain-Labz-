

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AudioPlaylistItem, AppView, DrumPadConfig, AppController, ChatAttachment, AiModel } from '../types';
import { sendMessageToAI, findSongLyrics, researchAndAdaptSong, generateSpeech, uploadFileToGemini, searchYouTubeVideos, analyzeYouTubeAudio, analyzeSheetMusicImage, generateSheetMusicSVG, findAndAnalyzeSheetMusic } from '../services/geminiService';
import { elevenLabsGenerate, addVoice } from '../services/elevenLabsService';
import { Content, FunctionResponse, Part } from '@google/genai';
import { PaperClipIcon } from './icons/PaperClipIcon';
import AudioPlayer from './AudioPlayer';

interface ChatProps {
  appController: AppController;
}

const UI_HISTORY_KEY = 'villain_labz_ui_history';
const AI_HISTORY_KEY = 'villain_labz_ai_history';
const MAX_BASE64_SIZE = 20 * 1024 * 1024; // 20MB limit for inline base64

// Helper to decode Gemini's PCM audio
async function playEncodedAudio(base64String: string) {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        const binaryString = atob(base64String);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const dataInt16 = new Int16Array(bytes.buffer);
        const buffer = audioContext.createBuffer(1, dataInt16.length, 24000);
        const channelData = buffer.getChannelData(0);
        for(let i=0; i<dataInt16.length; i++) {
            channelData[i] = dataInt16[i] / 32768.0;
        }
        
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
    } catch (e) {
        console.error("Error playing audio:", e);
    }
}

const getModelDisplayName = (model: AiModel) => {
    switch (model) {
        case 'openai': return 'OpenAI Assistant';
        case 'claude': return 'Claude';
        case 'ninja': return 'Ninja AI';
        case 'gemini': 
        default: return 'DJ Gemini';
    }
};

const getModelVersionName = (model: AiModel) => {
    switch (model) {
        case 'openai': return 'GPT-4o';
        case 'claude': return 'CLAUDE 3.5 SONNET';
        case 'ninja': return 'STEALTH v2';
        case 'gemini': 
        default: return 'GEMINI 2.5 FLASH';
    }
};

const getModelColor = (model: AiModel) => {
     switch (model) {
        case 'openai': return 'text-green-400';
        case 'claude': return 'text-orange-400';
        case 'ninja': return 'text-red-400';
        case 'gemini': 
        default: return 'text-purple-400';
    }
}

const Chat: React.FC<ChatProps> = ({ appController }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem(UI_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load UI history:", e);
      return [];
    }
  });

  const [aiHistory, setAiHistory] = useState<Content[]>(() => {
     try {
      const stored = localStorage.getItem(AI_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load AI history:", e);
      return [];
    }
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      addUIMessage('ai', "I am DJ Gemini. Your sovereign creative intelligence. I can build, destroy, and create. What is our mission?");
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(UI_HISTORY_KEY, JSON.stringify(messages));
    } catch (e) { console.error("Failed to save UI history", e); }
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(aiHistory));
    } catch (e) { console.error("Failed to save AI history", e); }
  }, [aiHistory]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const addUIMessage = (sender: 'user' | 'ai', text: string, msgAttachments: ChatAttachment[] = [], audioTrack?: AudioPlaylistItem, svgContent?: string) => {
    setMessages(prev => [...prev, { sender, text, attachments: msgAttachments, audioTrack, svgContent }]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      
      // 1. Add placeholders with isUploading=true
      // FIX: Explicitly type 'file' as File to help TypeScript inference.
      const newAttachments: ChatAttachment[] = files.map((file: File) => ({
          name: file.name,
          mimeType: file.type,
          isUploading: true,
          originalFile: file // Keep reference to match later
      }));
      
      setAttachments(prev => [...prev, ...newAttachments]);

      // 2. Process files concurrently
      const processedAttachments = await Promise.all(files.map(async (file: File) => {
        try {
            if (file.size > MAX_BASE64_SIZE) {
                // Large file logic (Resumable upload)
                try {
                    const uri = await uploadFileToGemini(file);
                    return {
                        name: file.name,
                        mimeType: file.type,
                        fileUri: uri,
                        isUploading: false,
                        originalFile: file
                    } as ChatAttachment;
                } catch (err) {
                    console.error("Failed to upload large file", err);
                    return {
                        name: file.name,
                        mimeType: file.type,
                        isUploading: false, 
                        error: "Upload failed",
                        originalFile: file
                    } as ChatAttachment;
                }
            } else {
                // Small file logic (Base64)
                return new Promise<ChatAttachment>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const res = reader.result as string;
                        if (!res) {
                            resolve({
                                name: file.name,
                                mimeType: file.type,
                                isUploading: false,
                                error: "Read failed",
                                originalFile: file
                            });
                            return;
                        }
                        const base64String = res.split(',')[1];
                        resolve({
                            name: file.name,
                            mimeType: file.type,
                            data: base64String,
                            isUploading: false,
                            originalFile: file
                        });
                    };
                    reader.onerror = () => resolve({
                        name: file.name,
                        mimeType: file.type,
                        isUploading: false,
                        error: "Read error",
                        originalFile: file
                    });
                    reader.readAsDataURL(file);
                });
            }
        } catch (e) {
             console.error("Unexpected error processing file", e);
             return {
                name: file.name,
                mimeType: file.type,
                isUploading: false,
                error: "Processing failed",
                originalFile: file
            } as ChatAttachment;
        }
      }));

      // 3. Update state: Replace pending items with processed results
      setAttachments(prev => {
          // We remove the pending items that correspond to the files we just processed
          const remaining = prev.filter(p => !files.some(f => f === p.originalFile) || !p.isUploading);
          return [...remaining, ...processedAttachments];
      });
    }
    // Clear input to allow selecting the same files again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (attachments.some(a => a.isUploading)) return;
    if ((input.trim() === '' && attachments.length === 0) || isLoading) return;

    const currentInput = input;
    const currentAttachments = [...attachments];
    
    addUIMessage('user', currentInput, currentAttachments);
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      let responseData;
      let generatedAudioTrack: AudioPlaylistItem | undefined;
      let generatedSvgContent: string | undefined;
      
      if (currentAttachments.length > 0) {
          const parts: Part[] = [];
          if (currentInput.trim()) {
              parts.push({ text: currentInput });
          }
          currentAttachments.forEach(att => {
              if (att.fileUri) {
                  parts.push({
                      fileData: {
                          mimeType: att.mimeType,
                          fileUri: att.fileUri
                      }
                  });
              } else if (att.data) {
                  parts.push({
                      inlineData: {
                          mimeType: att.mimeType,
                          data: att.data
                      }
                  });
              }
          });
          responseData = await sendMessageToAI(parts, aiHistory, appController.activeModel);
      } else {
          responseData = await sendMessageToAI(currentInput, aiHistory, appController.activeModel);
      }

      let { response, newHistory } = responseData;
      setAiHistory(newHistory);

      while (response.functionCalls && response.functionCalls.length > 0) {
        const functionCalls = response.functionCalls;
        
        const toolResponses: FunctionResponse[] = [];

        for (const funcCall of functionCalls) {
          const { name, args } = funcCall;
          let result: any;
          let executionResultText = '';

          switch (name) {
            case 'navigateTo':
              appController.setCurrentView(args.view as AppView);
              result = { success: true, view: args.view };
              executionResultText = `Navigated to ${args.view}.`;
              break;
            case 'cloneVoice':
                const audioAttachment = currentAttachments.find(a => a.mimeType.startsWith('audio/'));
                if (!audioAttachment || !audioAttachment.originalFile) {
                     result = { success: false, error: "No audio file attached. Please upload an audio sample to clone." };
                     executionResultText = "Failed: No audio file was attached to the request.";
                } else {
                     try {
                         addUIMessage('ai', `Cloning voice "${args.name}" from attached sample...`);
                         const newVoice = await addVoice(args.name as string, args.description as string || '', [audioAttachment.originalFile], appController.elevenLabsKey);
                         appController.setClonedVoices([newVoice, ...appController.clonedVoices]);
                         result = { success: true, voiceId: newVoice.id, voiceName: newVoice.name };
                         executionResultText = `Successfully cloned voice: "${newVoice.name}".`;
                     } catch (e: any) {
                         result = { success: false, error: e.message || "Unknown error cloning voice" };
                         executionResultText = `Error cloning voice: ${e.message}`;
                     }
                }
                break;
            case 'searchYouTube':
                try {
                    const videos = await searchYouTubeVideos(args.query as string);
                    result = { success: true, videos: videos.map(v => ({ title: v.title, channel: v.channel, url: v.url })) };
                    executionResultText = `Found ${videos.length} videos for "${args.query}".`;
                } catch(e) {
                    result = { success: false, error: "YouTube search failed" };
                    executionResultText = "Failed to search YouTube.";
                }
                break;
            case 'analyzeYouTubeAudio':
                try {
                    addUIMessage('ai', `Analyzing audio from the provided link...`);
                    const analysis = await analyzeYouTubeAudio(args.youtubeUrl as string);
                    result = { success: true, analysis };
                    executionResultText = `Successfully analyzed audio. Found BPM: ${analysis.bpm}, Key: ${analysis.key}. Ready for instructions.`;
                } catch (e) {
                    const errorMsg = e instanceof Error ? e.message : "Unknown analysis error";
                    result = { success: false, error: errorMsg };
                    executionResultText = `Failed to analyze audio: ${errorMsg}`;
                }
                break;
             case 'readSheetMusic':
                const imageAttachment = currentAttachments.find(a => a.mimeType.startsWith('image/'));
                if (!imageAttachment || (!imageAttachment.data && !imageAttachment.fileUri)) {
                    result = { success: false, error: "No image file attached for sheet music analysis." };
                } else {
                    addUIMessage('ai', 'Reading the attached sheet music...');
                    const part: Part = imageAttachment.data 
                        ? { inlineData: { mimeType: imageAttachment.mimeType, data: imageAttachment.data } }
                        : { fileData: { mimeType: imageAttachment.mimeType, fileUri: imageAttachment.fileUri! }};
                    try {
                        const analysis = await analyzeSheetMusicImage(part);
                        result = { success: true, analysis };
                        executionResultText = `Analyzed sheet music. Found key: ${analysis.keySignature}, time: ${analysis.timeSignature}.`;
                    } catch (e: any) {
                        result = { success: false, error: e.message };
                        executionResultText = `Failed to read sheet music: ${e.message}`;
                    }
                }
                break;
            case 'writeSheetMusic':
                try {
                    const svg = await generateSheetMusicSVG(args.prompt as string, (args.width as number) || 500);
                    generatedSvgContent = svg;
                    result = { success: true, svgRendered: true };
                    executionResultText = 'I have written the sheet music as requested.';
                } catch (e: any) {
                    result = { success: false, error: e.message };
                    executionResultText = `Failed to write sheet music: ${e.message}`;
                }
                break;
            case 'findAndReadSheetMusicOnline':
                 try {
                    addUIMessage('ai', `Searching online for sheet music for "${args.query}"...`);
                    const analysis = await findAndAnalyzeSheetMusic(args.query as string);
                    result = { success: true, analysis };
                    executionResultText = `Found and analyzed sheet music from ${analysis.sourceURL}. Key: ${analysis.keySignature}.`;
                } catch (e: any) {
                    result = { success: false, error: e.message };
                    executionResultText = `Failed to find or read sheet music: ${e.message}`;
                }
                break;
            case 'generateOriginalMusic':
            case 'generateCoverSong':
              try {
                let lyricsToGenerate: string;
                let title: string;
                let artist: string;
                
                if (name === 'generateCoverSong') {
                  const { originalTitle, originalArtist, style, adaptLyrics } = args as { originalTitle: string; originalArtist: string; style: string; adaptLyrics: boolean; };
                  title = originalTitle;
                  artist = originalArtist;
                  addUIMessage('ai', `Researching "${title}" by ${artist}...`);
                  lyricsToGenerate = adaptLyrics
                      ? await researchAndAdaptSong(title, artist, style)
                      : await findSongLyrics(title, artist);
                } else {
                  const originalArgs = args as { lyrics: string; style: string; };
                  lyricsToGenerate = originalArgs.lyrics;
                  title = `AI Original - ${originalArgs.style.substring(0, 20)}`;
                  artist = 'DJ Gemini AI';
                }

                addUIMessage('ai', 'Generating vocals & instrumentals...');
                const audioUrl = await elevenLabsGenerate(lyricsToGenerate, appController.elevenLabsKey, args.voiceId as string);
                
                const newTrack: AudioPlaylistItem = {
                  id: Date.now().toString(), src: audioUrl, title, artist,
                };
                appController.setGeneratedTracks([...appController.generatedTracks, newTrack]);
                generatedAudioTrack = newTrack; // Capture the track

                result = { success: true, trackId: newTrack.id, title: newTrack.title };
                executionResultText = `Successfully generated track: "${newTrack.title}".`;
              } catch (e) {
                const errorMsg = e instanceof Error ? e.message : "Unknown generation error";
                result = { success: false, error: errorMsg };
                executionResultText = `Failed to generate music: ${errorMsg}`;
              }
              break;
            case 'listClonedVoices':
              const voices = appController.clonedVoices;
              result = voices.map(v => ({ id: v.id, name: v.name }));
              executionResultText = voices.length > 0
                ? `Found ${voices.length} voices.`
                : 'No cloned voices found.';
              break;
            case 'listGeneratedTracks':
              const tracks = appController.generatedTracks;
              result = tracks.map(t => ({ id: t.id, title: t.title, artist: t.artist }));
              executionResultText = tracks.length > 0
                ? `Found ${tracks.length} tracks.`
                : 'No tracks found.';
              break;
            case 'deleteGeneratedTrack':
              const trackToDelete = appController.generatedTracks.find(t => t.id === args.trackId);
              if (trackToDelete) {
                appController.setGeneratedTracks(appController.generatedTracks.filter(t => t.id !== args.trackId));
                result = { success: true, trackId: args.trackId };
                executionResultText = `Deleted track "${trackToDelete.title}".`;
              } else {
                result = { success: false, error: "Track ID not found." };
                executionResultText = `Could not find a track with ID: ${args.trackId}.`;
              }
              break;
            case 'setElevenLabsApiKey':
            case 'setOpenAIApiKey':
            case 'setClaudeApiKey':
            case 'setNinjaApiKey':
               if(name === 'setElevenLabsApiKey') appController.setElevenLabsKey(args.apiKey as string);
               if(name === 'setOpenAIApiKey') appController.setOpenAIKey(args.apiKey as string);
               if(name === 'setClaudeApiKey') appController.setClaudeKey(args.apiKey as string);
               if(name === 'setNinjaApiKey') appController.setNinjaKey(args.apiKey as string);
              result = { success: true };
              executionResultText = `API Key updated successfully.`;
              break;
            case 'setDjMode':
              const isActive = args.isActive as boolean;
              appController.setIsDjActive(isActive);
              result = { success: true, status: isActive };
              executionResultText = `DJ Mode is now ${isActive ? 'activated' : 'deactivated'}.`;
              break;
            case 'executeJavaScript':
               try {
                  const code = String(args.code);
                  const func = new Function('appController', 'window', 'document', `
                      try {
                          ${code}
                      } catch(e) {
                          return "Error: " + e.message;
                      }
                  `);
                  const jsResult = func(appController, window, document);
                  
                  if (jsResult && typeof jsResult === 'string' && jsResult.startsWith("Error:")) {
                      result = { success: false, error: jsResult };
                      executionResultText = `Code execution failed: ${jsResult}. I will try to fix it.`;
                  } else {
                      result = { success: true, output: String(jsResult) };
                      executionResultText = `Code executed successfully.`;
                  }
              } catch (e) {
                  const errorMsg = e instanceof Error ? e.message : "Unknown code execution error";
                  result = { success: false, error: errorMsg };
                  executionResultText = `Error executing code: ${errorMsg}`;
              }
              break;
            case 'configureDrumPad':
               const padId = Number(args.padId);
               if (padId >= 0 && padId < 20) {
                   const newPads = [...appController.drumPads];
                   newPads[padId] = { ...newPads[padId], ...args } as DrumPadConfig;
                   appController.setDrumPads(newPads);
                   result = { success: true, pad: newPads[padId] };
                   executionResultText = `Pad ${padId} updated to "${newPads[padId].label}".`;
               } else {
                   result = { success: false, error: 'Invalid pad ID' };
                   executionResultText = 'Error: Pad ID out of range.';
               }
               break;
            case 'speak':
                try {
                    const text = args.text as string;
                    const voice = (args.voiceName as string) || 'Puck';
                    const audioData = await generateSpeech(text, voice);
                    if (audioData) {
                        playEncodedAudio(audioData);
                        result = { success: true };
                    } else {
                        result = { success: false, error: "No audio generated" };
                    }
                } catch (e) {
                    result = { success: false, error: "TTS Failed" };
                }
                break;
            default:
              result = { error: `Unknown function call: ${name}` };
              executionResultText = `Error: The tool "${name}" is not recognized.`;
          }

          toolResponses.push({ name, response: { result } });
        }

        const finalResult = await sendMessageToAI(toolResponses, newHistory, appController.activeModel);
        response = finalResult.response;
        newHistory = finalResult.newHistory;
        setAiHistory(newHistory);
      }

      if (response.text || generatedSvgContent) {
        addUIMessage('ai', response.text || '', [], generatedAudioTrack, generatedSvgContent);
      }

    } catch (error) {
      console.error(error);
      addUIMessage('ai', 'Sorry, I encountered an error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-2xl animate-fade-in h-[85vh] flex flex-col">
      <div className="flex items-center justify-between mb-4">
         <div>
             <h2 className={`text-3xl font-bold ${getModelColor(appController.activeModel)}`}>
                {getModelDisplayName(appController.activeModel)} {appController.isDjActive && appController.activeModel === 'gemini' && '(Sovereign Mode)'}
             </h2>
             <div className="text-xs text-gray-500 font-mono">{getModelVersionName(appController.activeModel)}</div>
         </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-4 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-lg px-3 py-2 rounded-xl ${msg.sender === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
              <p style={{whiteSpace: 'pre-wrap'}}>{msg.text}</p>
              {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                      {msg.attachments.map((att, i) => (
                          <div key={i} className="flex items-center bg-black/20 p-1 rounded text-xs">
                               <span className="truncate max-w-[200px]">{att.name}</span>
                               <span className="ml-2 opacity-70 text-[10px] uppercase">({att.mimeType.split('/')[1] || 'FILE'})</span>
                               {att.fileUri && <span className="ml-1 text-[10px] text-green-400">[CLOUD]</span>}
                               {att.error && <span className="ml-1 text-[10px] text-red-400">[FAILED]</span>}
                          </div>
                      ))}
                  </div>
              )}
               {msg.svgContent && (
                  <div className="mt-2 bg-white rounded-lg p-2" dangerouslySetInnerHTML={{ __html: msg.svgContent }} />
               )}
            </div>
            {msg.audioTrack && (
                <div className="mt-2 w-full max-w-lg">
                    <div className="bg-gray-900/80 p-2 rounded-lg border border-purple-500/30">
                         <p className="text-xs text-purple-300 mb-1 font-bold px-1">Generated Track</p>
                         <AudioPlayer playlist={[msg.audioTrack]} />
                    </div>
                </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-lg px-3 py-2 rounded-xl bg-gray-700 text-gray-200">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="mt-4">
        {/* Attachment Preview Area */}
        {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-900/50 rounded-lg">
                {attachments.map((att, index) => (
                    <div key={index} className={`flex items-center text-white text-xs px-2 py-1 rounded-full ${att.error ? 'bg-red-900/50 border border-red-500' : 'bg-gray-700'}`}>
                        {att.isUploading ? (
                           <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        ) : null}
                        <span className="truncate max-w-[150px]">{att.name}</span>
                        {att.fileUri && <span className="ml-1 text-[9px] bg-green-900 text-green-300 px-1 rounded">CLOUD</span>}
                        {att.error && <span className="ml-1 text-[9px] text-red-300 font-bold">ERROR</span>}
                        <button 
                            onClick={() => removeAttachment(index)}
                            className="ml-2 text-gray-400 hover:text-red-400 font-bold focus:outline-none"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
        )}
        
        <div className="flex items-end">
            <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 p-2 rounded-l-lg border border-r-0 border-gray-600 h-[42px] transition-colors"
                title="Attach file (Large files supported)"
                disabled={isLoading}
            >
                <PaperClipIcon />
            </button>
            <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Ask ${getModelDisplayName(appController.activeModel)}...`}
            className="flex-1 bg-gray-700 border border-gray-600 border-l-0 p-2 text-gray-100 focus:ring-0 focus:outline-none h-[42px] transition"
            disabled={isLoading}
            />
            <button
            onClick={handleSend}
            disabled={isLoading || attachments.some(a => a.isUploading)}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-r-lg transition-all duration-300 h-[42px] flex items-center"
            >
              {attachments.some(a => a.isUploading) ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Send'
              )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;