import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AudioPlaylistItem, AppView } from '../types';
import { sendMessageToAI, findSongLyrics, researchAndAdaptSong } from '../services/geminiService';
import { elevenLabsGenerate } from '../services/elevenLabsService';
import { Content, FunctionResponse } from '@google/genai';
import { AppController } from '../App';

interface ChatProps {
  appController: AppController;
}

const UI_HISTORY_KEY = 'villain_labz_ui_history';
const AI_HISTORY_KEY = 'villain_labz_ai_history';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      addUIMessage('ai', "I'm your creative AI assistant. I can generate music, manage your tracks, and control the app. What should we create?");
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

  const addUIMessage = (sender: 'user' | 'ai', text: string) => {
    setMessages(prev => [...prev, { sender, text }]);
  };

  const handleSend = async () => {
    if (input.trim() === '' || isLoading) return;

    const currentInput = input;
    addUIMessage('user', currentInput);
    setInput('');
    setIsLoading(true);

    try {
      let { response, newHistory } = await sendMessageToAI(currentInput, aiHistory);
      setAiHistory(newHistory);

      while (response.functionCalls && response.functionCalls.length > 0) {
        const functionCalls = response.functionCalls;
        addUIMessage('ai', `Executing tools: ${functionCalls.map(fc => fc.name).join(', ')}...`);
        
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
                  artist = 'Villain Labz AI';
                }

                addUIMessage('ai', 'Generating vocals & instrumentals...');
                const audioUrl = await elevenLabsGenerate(lyricsToGenerate, appController.elevenLabsKey);
                
                const newTrack: AudioPlaylistItem = {
                  id: Date.now().toString(), src: audioUrl, title, artist,
                };
                appController.setGeneratedTracks([...appController.generatedTracks, newTrack]);
                result = { success: true, trackId: newTrack.id, title: newTrack.title };
                executionResultText = `Successfully generated track: "${newTrack.title}". You can find it in Storage.`;
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
                ? `Found ${voices.length} voices: ${voices.map(v => `"${v.name}" (ID: ${v.id})`).join(', ')}.`
                : 'No cloned voices found. Go to the Voice Lab to create one.';
              break;
            case 'listGeneratedTracks':
              const tracks = appController.generatedTracks;
              result = tracks.map(t => ({ id: t.id, title: t.title, artist: t.artist }));
              executionResultText = tracks.length > 0
                ? `Found ${tracks.length} tracks: ${tracks.map(t => `"${t.title}" (ID: ${t.id})`).join(', ')}.`
                : 'No tracks have been generated yet.';
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
              appController.setElevenLabsKey(args.apiKey as string);
              result = { success: true };
              executionResultText = `ElevenLabs API key has been set.`;
              break;
            case 'setOpenAIApiKey':
              appController.setOpenAIKey(args.apiKey as string);
              result = { success: true };
              executionResultText = `OpenAI API key has been set.`;
              break;
            case 'setClaudeApiKey':
              appController.setClaudeKey(args.apiKey as string);
              result = { success: true };
              executionResultText = `Claude API key has been set.`;
              break;
            case 'setNinjaApiKey':
              appController.setNinjaKey(args.apiKey as string);
              result = { success: true };
              executionResultText = `Ninja AI API key has been set.`;
              break;
            case 'setDjMode':
              const isActive = args.isActive as boolean;
              appController.setIsDjActive(isActive);
              result = { success: true, status: isActive };
              executionResultText = `DJ Mode is now ${isActive ? 'activated' : 'deactivated'}.`;
              break;
            case 'generateWebAudioCode':
               try {
                  const func = new Function(String(args.code));
                  result = func();
                  executionResultText = `DJ code executed. AI response: "${String(result)}"`;
              } catch (e) {
                  const errorMsg = e instanceof Error ? e.message : "Unknown code execution error";
                  result = { error: errorMsg };
                  executionResultText = `Error executing DJ code: ${errorMsg}`;
              }
              break;
            default:
              result = { error: `Unknown function call: ${name}` };
              executionResultText = `Error: The tool "${name}" is not recognized.`;
          }

          addUIMessage('ai', executionResultText);
          toolResponses.push({ name, response: { result } });
        }

        const finalResult = await sendMessageToAI(toolResponses, newHistory);
        response = finalResult.response;
        newHistory = finalResult.newHistory;
        setAiHistory(newHistory);
      }

      if (response.text) {
        addUIMessage('ai', response.text);
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
      <h2 className="text-3xl font-bold text-purple-400 mb-4">AI Assistant {appController.isDjActive && '(DJ Mode)'}</h2>
      <div className="flex-1 overflow-y-auto pr-4 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-lg px-3 py-2 rounded-xl ${msg.sender === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
              <p style={{whiteSpace: 'pre-wrap'}}>{msg.text}</p>
            </div>
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
      <div className="mt-6 flex">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Generate a synthwave track..."
          className="flex-1 bg-gray-700 border border-gray-600 rounded-l-lg p-2 text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-r-lg transition-all duration-300"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat;