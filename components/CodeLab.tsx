
import React, { useEffect, useRef, useState } from 'react';
import { AppController, ChatMessage } from '../types';
import { sendMessageToAI } from '../services/geminiService';
import { Content } from '@google/genai';

interface CodeLabProps {
  appController: AppController;
}

const CodeLab: React.FC<CodeLabProps> = ({ appController }) => {
  const { codeLabContent, setCodeLabContent, runCodeLabTrigger, setRunCodeLabTrigger, activeModel } = appController;
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  // Terminal State
  const [terminalInput, setTerminalInput] = useState('');
  const [isTerminalLoading, setIsTerminalLoading] = useState(false);
  const [terminalAiHistory, setTerminalAiHistory] = useState<Content[]>([]);

  const initAudio = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      try {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.error("Web Audio API is not supported in this browser", e);
      }
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };
  
  useEffect(() => {
    if (runCodeLabTrigger > 0) {
      initAudio();
      
      const audioCtx = audioCtxRef.current;
      if (!audioCtx) {
        alert("Audio context could not be initialized.");
        return;
      }

      const musicSDK = {
        audioContext: audioCtx,
        createSynth: (waveform: OscillatorType = 'sine') => {
          return {
            playNote: (frequency: number, startTime: number = 0, duration: number = 0.5) => {
              if (audioCtx.state === 'suspended') audioCtx.resume();
              
              const osc = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              
              osc.type = waveform;
              osc.frequency.setValueAtTime(frequency, audioCtx.currentTime + startTime);
              
              gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
              gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + startTime + 0.01);
              gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + startTime + duration);
              
              osc.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              
              osc.start(audioCtx.currentTime + startTime);
              osc.stop(audioCtx.currentTime + startTime + duration);
            },
          };
        },
      };

      try {
        const F = new Function('musicSDK', 'appController', codeLabContent);
        F(musicSDK, appController);
      } catch (e) {
        console.error("Error executing Code Lab script:", e);
        alert(`Execution Error: ${e}`);
      }
    }
  }, [runCodeLabTrigger, codeLabContent, appController]);

  const handleRunCode = () => {
    setRunCodeLabTrigger(prev => prev + 1);
  };

  const handleTerminalSend = async () => {
      if (!terminalInput.trim()) return;

      setIsTerminalLoading(true);
      const prompt = `CONTEXT: The user is in the "Code Lab", a live JavaScript editor for music. The current code is:\n\n\`\`\`javascript\n${codeLabContent}\n\`\`\`\n\nUSER REQUEST: "${terminalInput}"\n\nTASK: Analyze the code and the request. Your primary goal is to fulfill the request by generating new code and using the 'updateCodeLab' tool. You may also use 'runCodeLab' to test it. You can also ask clarifying questions. Respond with tool calls or a message.`;

      try {
          let result = await sendMessageToAI(prompt, terminalAiHistory, activeModel);
          let functionCalls = result.response.functionCalls;
          
          if (functionCalls) {
              const call = functionCalls[0]; // Assume one call for simplicity in this context
              if (call.name === 'updateCodeLab') {
                  setCodeLabContent(call.args.code as string);
              } else if (call.name === 'runCodeLab') {
                  handleRunCode();
              }
          }
          setTerminalAiHistory(result.newHistory);
      } catch(e) {
          console.error("Terminal AI error:", e);
      } finally {
          setIsTerminalLoading(false);
          setTerminalInput('');
      }
  };
  
  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-2xl animate-fade-in h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-3xl font-bold text-cyan-400 mb-2">Code Lab</h2>
        <p className="text-gray-400">A live JavaScript environment for generative audio. Use the <code className="bg-gray-700 text-cyan-300 px-1 rounded">musicSDK</code> to create sounds and beats programmatically.</p>
      </div>
      
      <div className="flex-1 flex flex-col relative mb-4">
        <textarea
          value={codeLabContent}
          onChange={(e) => setCodeLabContent(e.target.value)}
          className="w-full flex-1 bg-gray-900 text-cyan-300 font-mono p-4 rounded-lg border border-gray-700 focus:ring-2 focus:ring-cyan-500 focus:outline-none resize-none"
          spellCheck="false"
          placeholder="Enter your JavaScript audio code here..."
        />
        <button
          onClick={handleRunCode}
          className="absolute bottom-4 right-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-lg"
        >
          RUN
        </button>
      </div>

       <div className="flex flex-col">
          <label className="text-sm font-bold text-gray-400 mb-2 font-mono">DJ Terminal &gt;</label>
          <div className="flex bg-gray-900 rounded-lg border border-gray-700 focus-within:ring-2 focus-within:ring-cyan-500">
              <input
                  type="text"
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isTerminalLoading && handleTerminalSend()}
                  placeholder="Chat with DJ about the code... (e.g., 'change synth to sawtooth')"
                  className="flex-1 bg-transparent p-3 text-white placeholder-gray-500 focus:outline-none"
                  disabled={isTerminalLoading}
              />
              <button
                  onClick={handleTerminalSend}
                  disabled={isTerminalLoading}
                  className="bg-gray-700 hover:bg-cyan-800/50 text-cyan-300 font-bold px-6 rounded-r-lg transition-colors disabled:opacity-50"
              >
                  {isTerminalLoading ? 'Thinking...' : 'Send'}
              </button>
          </div>
      </div>
    </div>
  );
};

export default CodeLab;
