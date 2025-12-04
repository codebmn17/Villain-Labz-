import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AudioPlaylistItem, AppView, DrumPadConfig, AppController, ChatAttachment, AiModel, YouTubeResult } from '../types';
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
        console.error("Failed to play encoded audio", e);
    }
}

const Chat: React.FC<ChatProps> = ({ appController }) => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [aiHistory, setAiHistory] = useState<Content[]>([]);
  const [userInput, setUserInput] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { activeModel, customModelName, isAiVoiceEnabled, setIsAiVoiceEnabled } = appController;

  const aiName = activeModel === 'gemini' ? 'DJ Gemini' 
               : activeModel === 'openai' ? 'DJ OpenAI'
               : activeModel === 'claude' ? 'DJ Claude'
               : activeModel === 'ninja' ? 'DJ Ninja'
               : customModelName;

  useEffect(() => {
    try {
      const savedUiHistory = localStorage.getItem(UI_HISTORY_KEY);
      const savedAiHistory = localStorage.getItem(AI_HISTORY_KEY);
      if (savedUiHistory) setChatHistory(JSON.parse(savedUiHistory));
      if (savedAiHistory) setAiHistory(JSON.parse(savedAiHistory));
    } catch (e) { console.error("Failed to load chat history:", e); }
  }, []);

  useEffect(() => {
    localStorage.setItem(UI_HISTORY_KEY, JSON.stringify(chatHistory));
    localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(aiHistory));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, aiHistory]);

  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newAttachments: ChatAttachment[] = Array.from(files).map((file: File) => ({
        name: file.name,
        mimeType: file.type,
        isUploading: true,
        originalFile: file,
    }));
    
    setAttachments(prev => [...prev, ...newAttachments]);

    await Promise.all(newAttachments.map(async (attachment) => {
        try {
            if (attachment.originalFile!.size < MAX_BASE64_SIZE) {
              attachment.data = await fileToBase64(attachment.originalFile!);
            } else {
              attachment.fileUri = await uploadFileToGemini(attachment.originalFile!);
            }
            attachment.isUploading = false;
        } catch (e) {
            console.error("Upload failed", e);
            attachment.error = 'Upload failed';
            attachment.isUploading = false;
        }
    }));
    setAttachments(prev => [...prev]); // Trigger re-render to update status
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleSend = async () => {
    if (!userInput.trim() && attachments.length === 0) return;

    setIsLoading(true);
    const userMessage: ChatMessage = { sender: 'user', text: userInput, attachments };
    setChatHistory(prev => [...prev, userMessage]);
    
    const messageParts: Part[] = [{ text: userInput }];
    for (const attachment of attachments) {
      if (attachment.data) {
        messageParts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });
      } else if (attachment.fileUri) {
        messageParts.push({ fileData: { mimeType: attachment.mimeType, fileUri: attachment.fileUri } });
      }
    }
    
    setUserInput('');
    setAttachments([]);

    try {
      let result = await sendMessageToAI(messageParts, aiHistory, activeModel);
      let functionCalls: FunctionCall[] | undefined = result.response.functionCalls;
      let newHistory = result.newHistory;

      while (functionCalls) {
        const toolResponses: FunctionResponse[] = [];
        const toolCallMessages: ChatMessage[] = [];

        for (const call of functionCalls) {
            let responsePayload: any = { error: `Tool ${call.name} not implemented or failed.` };
            
            try {
                switch (call.name) {
                    // TOOL IMPLEMENTATIONS
                    case 'navigateTo':
                        appController.setCurrentView(call.args.view as AppView);
                        responsePayload = { success: true, view: call.args.view };
                        break;
                    case 'generateOriginalMusic': {
                        const { lyrics, style, bpm, voiceId } = call.args;
                        appController.setCurrentView(AppView.Studio); // Navigate to show progress
                        const audioUrl = await elevenLabsGenerate(lyrics as string, appController.elevenLabsKey, voiceId as string);
                        const newTrack = { id: Date.now().toString(), src: audioUrl, title: `Original - ${style}`, artist: 'Villain Labz' };
                        await saveTrackToDB(newTrack);
                        appController.setGeneratedTracks([newTrack, ...appController.generatedTracks]);
                        responsePayload = { success: true, trackId: newTrack.id };
                        break;
                    }
                    case 'generateCoverSong': {
                        const { originalTitle, originalArtist, style, voiceId, adaptLyrics } = call.args;
                        appController.setCurrentView(AppView.Studio);
                        const lyrics = adaptLyrics 
                            ? await researchAndAdaptSong(originalTitle as string, originalArtist as string, style as string)
                            : await findSongLyrics(originalTitle as string, originalArtist as string);
                        const audioUrl = await elevenLabsGenerate(lyrics, appController.elevenLabsKey, voiceId as string);
                        const newTrack = { id: Date.now().toString(), src: audioUrl, title: `${originalTitle} (Cover)`, artist: `${originalArtist} ft. AI` };
                        await saveTrackToDB(newTrack);
                        appController.setGeneratedTracks([newTrack, ...appController.generatedTracks]);
                        responsePayload = { success: true, trackId: newTrack.id };
                        break;
                    }
                     case 'cloneVoice': {
                        const audioAttachment = attachments.find(a => a.mimeType.startsWith('audio/'));
                        if (!audioAttachment?.originalFile) throw new Error("Audio file attachment is required to clone a voice.");
                        const { name, description } = call.args;
                        const newVoice = await addVoice(name as string, description as string, [audioAttachment.originalFile], appController.elevenLabsKey);
                        appController.setClonedVoices([newVoice, ...appController.clonedVoices]);
                        responsePayload = { success: true, voice: newVoice };
                        break;
                    }
                    case 'searchYouTube': {
                        const videos = await searchYouTubeVideos(call.args.query as string);
                        responsePayload = { videos };
                        break;
                    }
                    case 'analyzeYouTubeAudio': {
                        const analysis = await analyzeYouTubeAudio(call.args.youtubeUrl as string);
                        responsePayload = analysis;
                        break;
                    }
                    case 'analyzeBassCharacteristics': {
                        const { youtubeUrl, audioAttachmentName, textDescription } = call.args;
                        const audioAttachment = attachments.find(a => a.name === audioAttachmentName);
                        let audioPart: Part | undefined;
                        if (audioAttachment?.data) {
                           audioPart = { inlineData: { mimeType: audioAttachment.mimeType, data: audioAttachment.data } };
                        }
                        const analysis = await performBassAnalysis({ youtubeUrl: youtubeUrl as string, textDescription: textDescription as string, audioAttachment: audioPart });
                        responsePayload = analysis;
                        break;
                    }
                    case 'readSheetMusic': {
                        const imageAttachment = attachments.find(a => a.mimeType.startsWith('image/'));
                        if (!imageAttachment?.data) throw new Error("Image attachment of sheet music is required.");
                        const analysis = await analyzeSheetMusicImage({ inlineData: { mimeType: imageAttachment.mimeType, data: imageAttachment.data } });
                        responsePayload = analysis;
                        break;
                    }
                    case 'writeSheetMusic': {
                        const { prompt, width } = call.args;
                        const svg = await generateSheetMusicSVG(prompt as string, width as number || 500);
                        responsePayload = { success: true, svgContent: svg };
                        // Display SVG in a new message
                        toolCallMessages.push({ sender: 'ai', text: `Here is the sheet music for "${prompt}":`, svgContent: svg });
                        break;
                    }
                    case 'findAndReadSheetMusicOnline': {
                        const analysis = await findAndAnalyzeSheetMusic(call.args.query as string);
                        responsePayload = analysis;
                        break;
                    }
                    case 'listClonedVoices':
                        responsePayload = { voices: appController.clonedVoices };
                        break;
                    case 'listGeneratedTracks':
                        responsePayload = { tracks: appController.generatedTracks };
                        break;
                    case 'deleteGeneratedTrack':
                        await deleteTrackFromDB(call.args.trackId as string);
                        appController.setGeneratedTracks(appController.generatedTracks.filter(t => t.id !== call.args.trackId));
                        responsePayload = { success: true, trackId: call.args.trackId };
                        break;
                    case 'setElevenLabsApiKey': appController.setElevenLabsKey(call.args.apiKey as string); responsePayload = { success: true }; break;
                    case 'setOpenAIApiKey': appController.setOpenAIKey(call.args.apiKey as string); responsePayload = { success: true }; break;
                    case 'setClaudeApiKey': appController.setClaudeKey(call.args.apiKey as string); responsePayload = { success: true }; break;
                    case 'setNinjaApiKey': appController.setNinjaKey(call.args.apiKey as string); responsePayload = { success: true }; break;
                    case 'setDjMode': appController.setIsDjActive(call.args.isActive as boolean); responsePayload = { success: true, status: call.args.isActive }; break;
                    case 'executeJavaScript':
                        try {
                            const result = new Function('appController', 'window', 'document', call.args.code as string)(appController, window, document);
                            responsePayload = { success: true, result: result ? String(result) : 'OK' };
                        } catch (e: any) {
                            responsePayload = { success: false, error: e.message, stack: e.stack };
                        }
                        break;
                    case 'speak': {
                        const audioData = await generateSpeech(call.args.text as string, call.args.voiceName as string);
                        if (audioData) await playEncodedAudio(audioData);
                        responsePayload = { success: true };
                        break;
                    }
                    case 'configureDrumPad': {
                        const newPads = [...appController.drumPads];
                        const padIndex = newPads.findIndex(p => p.id === call.args.padId);
                        if (padIndex !== -1) {
                            newPads[padIndex] = { ...newPads[padIndex], ...call.args };
                            appController.setDrumPads(newPads);
                            responsePayload = { success: true, updatedPad: newPads[padIndex] };
                        } else {
                            throw new Error(`Pad with ID ${call.args.padId} not found.`);
                        }
                        break;
                    }
                     case 'setDrumMachineEffects': {
                        if (typeof call.args.reverbMix === 'number') appController.setReverbMix(call.args.reverbMix);
                        if (typeof call.args.reverbDecay === 'number') appController.setReverbDecay(call.args.reverbDecay);
                        responsePayload = { success: true };
                        break;
                    }
                    case 'generateSequencerPattern': {
                        const { grid, bpm } = await generateSequencerPatternFromPrompt(call.args.prompt as string, appController.drumPads);
                        appController.setSequencerGrid(grid);
                        appController.setBpm(bpm);
                        appController.setCurrentView(AppView.DrumMachine);
                        responsePayload = { success: true, message: `Generated a pattern and set BPM to ${bpm}. Navigating to Drum Machine.` };
                        break;
                    }
                }
            } catch (e: any) {
                responsePayload = { error: e.message };
            }

            toolResponses.push({
                name: call.name,
                response: responsePayload,
            });
        }
        
        if (toolCallMessages.length > 0) {
            setChatHistory(prev => [...prev, ...toolCallMessages]);
        }
        
        const toolResult = await sendMessageToAI(toolResponses, newHistory, activeModel);
        functionCalls = toolResult.response.functionCalls;
        newHistory = toolResult.newHistory;
        result = toolResult;
      }

      const aiResponseText = result.response.text;
      const aiMessage: ChatMessage = { sender: 'ai', text: aiResponseText || '' };
      setChatHistory(prev => [...prev, aiMessage]);
      setAiHistory(result.newHistory);

      // Grand Finale: Speak the response
      if (isAiVoiceEnabled && aiResponseText) {
          try {
              if (appController.elevenLabsKey) {
                  // Use high-quality ElevenLabs voice if available
                  const voiceId = appController.clonedVoices.length > 0 ? appController.clonedVoices[0].id : undefined;
                  const audioUrl = await elevenLabsGenerate(aiResponseText, appController.elevenLabsKey, voiceId);
                  const audio = new Audio(audioUrl);
                  audio.play();
              } else {
                  // Fallback to built-in TTS
                  const audioData = await generateSpeech(aiResponseText);
                  if (audioData) await playEncodedAudio(audioData);
              }
          } catch (speechError) {
              console.error("Failed to generate or play speech:", speechError);
          }
      }

    } catch (e) {
      console.error(e);
      const errorMessage: ChatMessage = { sender: 'ai', text: `An error occurred: ${e instanceof Error ? e.message : String(e)}` };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 rounded-xl shadow-2xl animate-fade-in">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <div>
            <h2 className="text-xl font-bold text-purple-400">{aiName}</h2>
            <p className="text-xs text-gray-400">Your creative AI partner. Type a message or attach a file.</p>
        </div>
        <button
            onClick={() => setIsAiVoiceEnabled(!isAiVoiceEnabled)}
            className="p-2 rounded-full hover:bg-gray-700 transition-colors"
            title={isAiVoiceEnabled ? "Disable AI Voice" : "Enable AI Voice"}
        >
            {isAiVoiceEnabled ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatHistory.map((msg, index) => (
          <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
            {msg.sender === 'ai' && <div className="w-8 h-8 rounded-full bg-purple-600 flex-shrink-0"></div>}
            <div className={`max-w-lg p-3 rounded-lg ${msg.sender === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
              <p className="whitespace-pre-wrap">{msg.text}</p>
              {msg.svgContent && <div dangerouslySetInnerHTML={{ __html: msg.svgContent }} className="mt-2 bg-white p-2 rounded" />}
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="mt-2 space-y-2">
                  {msg.attachments.map((att, i) => (
                    <div key={i} className="bg-purple-700/50 p-2 rounded-md text-sm">Attached: {att.name}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-700">
        {attachments.length > 0 && (
          <div className="mb-2 grid grid-cols-2 md:grid-cols-4 gap-2">
            {attachments.map((att, i) => (
              <div key={i} className="bg-gray-700 p-2 rounded-md text-xs relative overflow-hidden">
                <p className="text-white truncate">{att.name}</p>
                {att.isUploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div></div>}
                {att.error && <p className="text-red-400">{att.error}</p>}
                <button onClick={() => removeAttachment(i)} className="absolute top-1 right-1 text-gray-400 hover:text-white">×</button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center bg-gray-700 rounded-lg p-2">
          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-white">
            <PaperClipIcon />
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple className="hidden" />
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
            placeholder="Type your message..."
            className="flex-1 bg-transparent border-none text-white placeholder-gray-400 focus:ring-0"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};
export default Chat;