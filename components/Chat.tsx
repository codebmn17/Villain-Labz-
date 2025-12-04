import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AudioPlaylistItem, AppView, DrumPadConfig, AppController, ChatAttachment, AiModel, YouTubeResult, SongArrangement, SequencerPattern } from '../types';
import { sendMessageToAI, findSongLyrics, researchAndAdaptSong, generateSpeech, uploadFileToGemini, searchYouTubeVideos, analyzeYouTubeAudio, analyzeSheetMusicImage, generateSheetMusicSVG, findAndAnalyzeSheetMusic, performBassAnalysis, generateSequencerPatternFromPrompt } from '../services/geminiService';
import { elevenLabsGenerate, addVoice } from '../services/elevenLabsService';
import { Content, FunctionResponse, Part, FunctionCall } from '@google/genai';
import { PaperClipIcon } from './icons/PaperClipIcon';
import AudioPlayer from './AudioPlayer';
import { saveTrackToDB, deleteTrackFromDB } from '../services/storageService';
import { SpeakerOnIcon } from './icons/SpeakerOnIcon';
import { SpeakerOffIcon } from './icons/SpeakerOffIcon';

interface ChatProps {
  appController: AppController;
}

const UI_HISTORY_KEY = 'villain_labz_ui_history';
const AI_HISTORY_KEY = 'villain_labz_ai_history';
const MAX_BASE64_SIZE = 20 * 1024 * 1024; // 20MB limit for inline base64

// Helper to decode Gemini's PCM audio
async function playEncodedAudio(base64String: string) {
    if (!base64String || typeof base64String !== 'string' || base64String.length < 100) {
        console.warn("Invalid or empty audio data received from AI, skipping playback.");
        return;
    }
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        const binaryString = atob(base64String);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const dataInt16 = new Int16Array(bytes.buffer);
        const frameCount = dataInt16.length;
        const buffer = audioContext.createBuffer(1, frameCount, 24000);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i] / 32768.0;
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
    } catch (e) {
        console.error("Failed to decode and play audio:", e);
    }
}


const Chat: React.FC<ChatProps> = ({ appController }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(UI_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  
  // FIX: useRef does not take a lazy initializer. The value is initialized directly.
  const aiHistory = useRef<Content[]>(
    JSON.parse(localStorage.getItem(AI_HISTORY_KEY) || '[]')
  );
  const chatEndRef = useRef<HTMLDivElement>(null);

  const {
    setCurrentView, setElevenLabsKey, setOpenAIKey, setClaudeKey, setNinjaKey, setIsDjActive, setClonedVoices,
    clonedVoices, isDjActive, setGeneratedTracks, generatedTracks,
    drumPads, setDrumPads, activeModel, isAiVoiceEnabled, setIsAiVoiceEnabled,
    setCodeLabContent, setRunCodeLabTrigger, setReverbMix, setReverbDecay,
    setBpm, setSequencerGrid, savedPatterns, savedArrangements, setSavedArrangements,
  } = appController;


  useEffect(() => {
    localStorage.setItem(UI_HISTORY_KEY, JSON.stringify(messages));
    localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(aiHistory.current));
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files).map((file: File) => ({
        name: file.name,
        mimeType: file.type,
        isUploading: true,
        originalFile: file,
      }));
      setAttachments(prev => [...prev, ...newFiles]);

      newFiles.forEach(async (attachment, index) => {
        const file = attachment.originalFile;
        if (!file) return;

        try {
            if (file.size < MAX_BASE64_SIZE) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    setAttachments(prev => prev.map(a => a === attachment ? { ...a, data: base64, isUploading: false } : a));
                };
                reader.readAsDataURL(file);
            } else {
                // For large files, get a URI. In a real app, this would be an actual upload.
                const uri = await uploadFileToGemini(file);
                setAttachments(prev => prev.map(a => a === attachment ? { ...a, fileUri: uri, isUploading: false } : a));
            }
        } catch (error) {
            console.error("File processing error:", error);
            setAttachments(prev => prev.map(a => a === attachment ? { ...a, error: 'Upload failed', isUploading: false } : a));
        }
      });
    }
  };

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;

    const userMessage: ChatMessage = {
      sender: 'user',
      text: input,
      attachments: attachments.filter(a => !a.isUploading && !a.error),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    const parts: Part[] = [{ text: input }];
    userMessage.attachments?.forEach(att => {
        if (att.data) {
            parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } });
        } else if (att.fileUri) {
            parts.push({ fileData: { mimeType: att.mimeType, fileUri: att.fileUri } });
        }
    });

    try {
        let result = await sendMessageToAI(parts, aiHistory.current, activeModel);
        aiHistory.current = result.newHistory;
        let response = result.response;
        
        let functionCalls: FunctionCall[] | undefined = response.functionCalls;
        
        while (functionCalls && functionCalls.length > 0) {
            const toolResponses: FunctionResponse[] = [];

            for (const call of functionCalls) {
                let toolResult: any = { error: `Tool ${call.name} not found or failed.` };
                const args = call.args;
                
                try {
                    switch (call.name) {
                        case 'navigateTo': 
                            setCurrentView(args.view as AppView);
                            toolResult = { success: true, message: `Navigated to ${args.view}.` };
                            break;
                        case 'cloneVoice': {
                            const audioAttachment = userMessage.attachments?.[0];
                            if (audioAttachment?.originalFile) {
                                const newVoice = await addVoice(args.name as string, args.description as string, [audioAttachment.originalFile], appController.elevenLabsKey);
                                setClonedVoices([...clonedVoices, newVoice]);
                                toolResult = { success: true, voiceId: newVoice.id, message: `Voice "${newVoice.name}" cloned.` };
                            } else {
                                toolResult = { error: "Audio file attachment is required to clone a voice." };
                            }
                            break;
                        }
                        case 'listClonedVoices':
                            toolResult = clonedVoices.map(({ id, name, description }) => ({ id, name, description }));
                            break;
                        case 'listGeneratedTracks':
                            toolResult = generatedTracks.map(({ id, title, artist }) => ({ id, title, artist }));
                            break;
                        case 'deleteGeneratedTrack': {
                            await deleteTrackFromDB(args.trackId as string);
                            setGeneratedTracks(generatedTracks.filter(t => t.id !== args.trackId));
                            toolResult = { success: true, message: `Track ${args.trackId} deleted.` };
                            break;
                        }
                        case 'setElevenLabsApiKey': setElevenLabsKey(args.apiKey as string); toolResult = { success: true }; break;
                        case 'setOpenAIApiKey': setOpenAIKey(args.apiKey as string); toolResult = { success: true }; break;
                        case 'setClaudeApiKey': setClaudeKey(args.apiKey as string); toolResult = { success: true }; break;
                        case 'setNinjaApiKey': setNinjaKey(args.apiKey as string); toolResult = { success: true }; break;
                        case 'setDjMode': setIsDjActive(args.isActive as boolean); toolResult = { success: true, status: args.isActive ? 'activated' : 'deactivated' }; break;
                        case 'speak': {
                            const audioBase64 = await generateSpeech(args.text as string, args.voiceName as string);
                            if (audioBase64) {
                                playEncodedAudio(audioBase64);
                                toolResult = { success: true, message: "Speech synthesized and played." };
                            } else {
                                toolResult = { error: "Failed to synthesize speech." };
                            }
                            break;
                        }
                        case 'executeJavaScript':
                           try {
                                const F = new Function('appController', 'window', 'document', args.code as string);
                                const result = F(appController, window, document);
                                toolResult = { success: true, result: JSON.stringify(result) || 'Code executed.' };
                           } catch (e: any) {
                               toolResult = { error: e.message };
                           }
                           break;
                        case 'configureDrumPad': {
                            const { padId, ...config } = args;
                            const newPads = drumPads.map(p => p.id === padId ? { ...p, ...config } as DrumPadConfig : p);
                            setDrumPads(newPads);
                            toolResult = { success: true, message: `Pad ${padId} configured.` };
                            break;
                        }
                        case 'setDrumMachineEffects': {
                            if (typeof args.reverbMix === 'number') setReverbMix(args.reverbMix as number);
                            if (typeof args.reverbDecay === 'number') setReverbDecay(args.reverbDecay as number);
                            toolResult = { success: true, message: 'Drum machine effects updated.' };
                            break;
                        }
                        case 'searchYouTube':
                            toolResult = await searchYouTubeVideos(args.query as string);
                            break;
                        case 'analyzeYouTubeAudio':
                            toolResult = await analyzeYouTubeAudio(args.youtubeUrl as string);
                            break;
                        case 'analyzeBassCharacteristics': {
                            const audioAttachment = attachments.find(a => a.name === args.audioAttachmentName);
                            const audioPart = audioAttachment?.data ? { inlineData: { mimeType: audioAttachment.mimeType, data: audioAttachment.data } } : undefined;
                            toolResult = await performBassAnalysis({
                                youtubeUrl: args.youtubeUrl as string,
                                textDescription: args.textDescription as string,
                                audioAttachment: audioPart,
                            });
                            break;
                        }
                        case 'readSheetMusic': {
                            const imageAttachment = attachments.find(a => a.mimeType.startsWith('image/'));
                            if (imageAttachment?.data) {
                                toolResult = await analyzeSheetMusicImage({ inlineData: { mimeType: imageAttachment.mimeType, data: imageAttachment.data } });
                            } else {
                                toolResult = { error: 'An image attachment is required.' };
                            }
                            break;
                        }
                        case 'writeSheetMusic':
                            toolResult = await generateSheetMusicSVG(args.prompt as string, args.width as number);
                            break;
                        case 'findAndReadSheetMusicOnline':
                            toolResult = await findAndAnalyzeSheetMusic(args.query as string);
                            break;
                        case 'updateCodeLab':
                            setCodeLabContent(args.code as string);
                            toolResult = { success: true, message: 'Code lab updated.' };
                            break;
                        case 'runCodeLab':
                            setRunCodeLabTrigger(prev => prev + 1);
                            toolResult = { success: true, message: 'Code lab execution triggered.' };
                            break;
                        case 'generateSequencerPattern': {
                            const pattern = await generateSequencerPatternFromPrompt(args.prompt as string, drumPads);
                            setSequencerGrid(pattern.grid);
                            setBpm(pattern.bpm);
                            toolResult = { success: true, message: `Sequencer pattern generated at ${pattern.bpm} BPM.` };
                            break;
                        }
                        case 'listSequencerPatterns':
                            toolResult = savedPatterns.map(p => ({ id: p.id, name: p.name, bpm: p.bpm }));
                            break;
                        case 'createSongArrangement': {
                            const newArrangement: SongArrangement = {
                                id: Date.now().toString(),
                                name: args.name as string,
                                sections: args.sections as any[],
                            };
                            const updatedArrangements = [...savedArrangements, newArrangement];
                            setSavedArrangements(updatedArrangements);
                             localStorage.setItem('villain_song_arrangements', JSON.stringify(updatedArrangements));
                            toolResult = { success: true, message: `Song arrangement '${newArrangement.name}' created.` };
                            break;
                        }

                    }
                } catch (e: any) {
                    console.error(`Error executing tool ${call.name}:`, e);
                    toolResult = { error: e.message || 'An unknown error occurred.' };
                }

                toolResponses.push({
                    name: call.name,
                    response: { result: JSON.stringify(toolResult) }
                });
            }
            
            result = await sendMessageToAI(toolResponses, aiHistory.current, activeModel);
            aiHistory.current = result.newHistory;
            response = result.response;
            functionCalls = response.functionCalls;
        }

        const aiText = response.text || "I'm not sure how to respond to that.";
        const aiMessage: ChatMessage = { sender: 'ai', text: aiText };

        // Check for special content types in the final response
        if (response.candidates && response.candidates[0].content.parts.length > 1) {
            const lastPart = response.candidates[0].content.parts[response.candidates[0].content.parts.length-1];
            // This is a simple heuristic; might need refinement
            if (typeof lastPart.text === 'string' && lastPart.text.trim().startsWith('<svg')) {
                 aiMessage.svgContent = lastPart.text.trim();
            }
        }
        
        setMessages(prev => [...prev, aiMessage]);
        
        if (isAiVoiceEnabled) {
            const audioBase64 = await generateSpeech(aiText);
            if (audioBase64) playEncodedAudio(audioBase64);
        }

    } catch (error) {
        console.error('Error sending message to AI:', error);
        setMessages(prev => [...prev, { sender: 'ai', text: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 p-2 sm:p-4 rounded-xl shadow-2xl animate-fade-in h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-purple-400">
          DJ {
            activeModel === 'gemini' ? 'Gemini' :
            activeModel === 'openai' ? 'OpenAI' :
            activeModel === 'claude' ? 'Claude' :
            activeModel === 'ninja' ? 'Ninja' :
            appController.customModelName
          }
        </h2>
        <button 
          onClick={() => setIsAiVoiceEnabled(!isAiVoiceEnabled)}
          className="p-2 rounded-full hover:bg-gray-700 transition-colors"
          title={isAiVoiceEnabled ? "Mute AI Voice" : "Unmute AI Voice"}
        >
            {isAiVoiceEnabled ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-2xl max-w-sm sm:max-w-md md:max-w-lg ${msg.sender === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
              <p className="whitespace-pre-wrap">{msg.text}</p>
              {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 border-t border-white/20 pt-2">
                    {msg.attachments.map((att, i) => (
                        <div key={i} className="text-xs text-purple-200/80">{att.name}</div>
                    ))}
                  </div>
              )}
               {msg.svgContent && (
                    <div className="mt-2 p-2 bg-white rounded-lg" dangerouslySetInnerHTML={{ __html: msg.svgContent }} />
                )}
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                <div className="p-3 rounded-2xl bg-gray-700 text-gray-200 flex items-center space-x-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-0"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-200"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse delay-400"></div>
                </div>
            </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="mt-4">
        {attachments.length > 0 && (
          <div className="p-2 bg-gray-700/50 rounded-lg mb-2 flex flex-wrap gap-2">
            {attachments.map((att, i) => (
              <div key={i} className="bg-gray-800 px-2 py-1 rounded-md text-xs flex items-center">
                <span className="text-purple-300 truncate max-w-xs">{att.name}</span>
                {att.isUploading && <div className="ml-2 w-3 h-3 border-2 border-purple-300 border-t-transparent rounded-full animate-spin"></div>}
                {att.error && <span className="ml-2 text-red-400">Error</span>}
                <button onClick={() => setAttachments(prev => prev.filter(a => a !== att))} className="ml-2 text-gray-500 hover:text-red-400">&times;</button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center bg-gray-700 rounded-xl p-2">
          <label htmlFor="file-upload" className="p-2 text-gray-400 hover:text-purple-400 cursor-pointer">
            <PaperClipIcon />
            <input id="file-upload" type="file" multiple className="hidden" onChange={handleFileUpload} />
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
            placeholder="Ask DJ anything..."
            className="flex-1 bg-transparent border-none text-white placeholder-gray-400 focus:ring-0"
            disabled={isLoading}
          />
          <button onClick={handleSend} disabled={isLoading} className="bg-purple-600 text-white font-bold py-2 px-5 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50">
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};
export default Chat;