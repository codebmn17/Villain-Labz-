
import React, { useState } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { AgentIcon } from './icons/AgentIcon';
import { OpenAIIcon } from './icons/OpenAIIcon';
import { ClaudeIcon } from './icons/ClaudeIcon';
import { NinjaIcon } from './icons/NinjaIcon';
import { AiModel } from '../types';

interface ModelManagerProps {
  activeModel: AiModel;
  setActiveModel: (model: AiModel) => void;
  elevenLabsKey: string;
  setElevenLabsKey: (key: string) => void;
  openAIKey: string;
  setOpenAIKey: (key: string) => void;
  claudeKey: string;
  setClaudeKey: (key: string) => void;
  ninjaKey: string;
  setNinjaKey: (key: string) => void;
  customModel: File | null;
  setCustomModel: (file: File | null) => void;
  isDjActive: boolean;
}

const ModelManager: React.FC<ModelManagerProps> = ({ 
  activeModel,
  setActiveModel,
  elevenLabsKey, 
  setElevenLabsKey,
  openAIKey,
  setOpenAIKey,
  claudeKey,
  setClaudeKey,
  ninjaKey,
  setNinjaKey,
  customModel, 
  setCustomModel,
  isDjActive,
}) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      // Simulate upload delay
      setTimeout(() => {
        setCustomModel(file);
        setIsUploading(false);
      }, 1500);
    }
  };
  
  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-2xl animate-fade-in space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-purple-400 mb-2">Model Manager</h2>
        <p className="text-gray-400">Configure active intelligence, external models and AI agents.</p>
      </div>

      {/* Active Model Selector */}
      <div className="p-4 bg-gray-700/50 rounded-lg border border-purple-500/30">
        <h3 className="text-xl font-semibold text-white mb-4">Active Intelligence Model</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <button 
                onClick={() => setActiveModel('gemini')}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${activeModel === 'gemini' ? 'border-purple-500 bg-purple-900/20' : 'border-gray-600 bg-gray-800 hover:bg-gray-700'}`}
            >
                <div className="bg-white rounded-full p-1 mb-2">
                     {/* Google G Logo / Gemini placeholder */}
                     <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-red-500"></div>
                </div>
                <span className={`font-bold ${activeModel === 'gemini' ? 'text-purple-300' : 'text-gray-400'}`}>Gemini 2.5</span>
                <span className="text-[10px] text-gray-500">Google</span>
            </button>

            <button 
                onClick={() => setActiveModel('openai')}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${activeModel === 'openai' ? 'border-green-500 bg-green-900/20' : 'border-gray-600 bg-gray-800 hover:bg-gray-700'}`}
            >
                <OpenAIIcon className={`h-8 w-8 mb-2 ${activeModel === 'openai' ? 'text-green-400' : 'text-gray-500'}`} />
                <span className={`font-bold ${activeModel === 'openai' ? 'text-green-300' : 'text-gray-400'}`}>GPT-4o</span>
                <span className="text-[10px] text-gray-500">OpenAI</span>
            </button>

            <button 
                onClick={() => setActiveModel('claude')}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${activeModel === 'claude' ? 'border-orange-500 bg-orange-900/20' : 'border-gray-600 bg-gray-800 hover:bg-gray-700'}`}
            >
                <ClaudeIcon className={`h-8 w-8 mb-2 ${activeModel === 'claude' ? 'text-orange-400' : 'text-gray-500'}`} />
                <span className={`font-bold ${activeModel === 'claude' ? 'text-orange-300' : 'text-gray-400'}`}>Claude 3.5</span>
                <span className="text-[10px] text-gray-500">Anthropic</span>
            </button>

            <button 
                onClick={() => setActiveModel('ninja')}
                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${activeModel === 'ninja' ? 'border-red-500 bg-red-900/20' : 'border-gray-600 bg-gray-800 hover:bg-gray-700'}`}
            >
                <NinjaIcon className={`h-8 w-8 mb-2 ${activeModel === 'ninja' ? 'text-red-400' : 'text-gray-500'}`} />
                <span className={`font-bold ${activeModel === 'ninja' ? 'text-red-300' : 'text-gray-400'}`}>Ninja v2</span>
                <span className="text-[10px] text-gray-500">Stealth</span>
            </button>
        </div>
      </div>

      <div className="p-4 bg-gray-700/50 rounded-lg">
        <div className="flex items-center mb-3">
            <AgentIcon className="h-8 w-8 text-purple-400 mr-3" />
            <h3 className="text-xl font-semibold text-purple-300">DJ Autonomous Agent</h3>
        </div>
        <p className="text-gray-400 mb-4 text-sm">The DJ agent gives the AI assistant autonomous coding abilities to programmatically create sounds and beats. You can activate it via the AI Chat.</p>
        <div className="bg-gray-800 p-3 rounded-lg flex items-center justify-between">
            <span className="font-medium text-gray-300">DJ Mode Status:</span>
            <span className={`font-bold px-3 py-1 rounded-full text-sm ${isDjActive ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                {isDjActive ? 'Active' : 'Inactive'}
            </span>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">To change the status, ask the AI Assistant, e.g., "activate DJ mode".</p>
      </div>

       <div className="p-4 bg-gray-700/50 rounded-lg">
        <div className="flex items-center mb-3">
            <OpenAIIcon />
            <h3 className="text-xl font-semibold text-purple-300">OpenAI Integration</h3>
        </div>
        <p className="text-gray-400 mb-4 text-sm">Use your OpenAI API key for advanced text generation and analysis features within the AI assistant.</p>
        <label htmlFor="openai-key" className="block text-sm font-medium text-gray-300 mb-2">OpenAI API Key</label>
        <input
          id="openai-key"
          type="password"
          value={openAIKey}
          onChange={(e) => setOpenAIKey(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
          placeholder="Enter your API key (sk-...)"
        />
      </div>

      <div className="p-4 bg-gray-700/50 rounded-lg">
        <div className="flex items-center mb-3">
            <ClaudeIcon />
            <h3 className="text-xl font-semibold text-purple-300">Claude (Anthropic)</h3>
        </div>
        <p className="text-gray-400 mb-4 text-sm">Connect your Claude API key for access to Anthropic's powerful conversational and creative text models.</p>
        <label htmlFor="claude-key" className="block text-sm font-medium text-gray-300 mb-2">Claude API Key</label>
        <input
          id="claude-key"
          type="password"
          value={claudeKey}
          onChange={(e) => setClaudeKey(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
          placeholder="Enter your API key"
        />
      </div>

      <div className="p-4 bg-gray-700/50 rounded-lg">
        <div className="flex items-center mb-3">
            <NinjaIcon />
            <h3 className="text-xl font-semibold text-purple-300">Ninja AI</h3>
        </div>
        <p className="text-gray-400 mb-4 text-sm">Integrate with the Ninja AI stealth model for specialized, high-speed audio processing tasks.</p>
        <label htmlFor="ninja-key" className="block text-sm font-medium text-gray-300 mb-2">Ninja AI API Key</label>
        <input
          id="ninja-key"
          type="password"
          value={ninjaKey}
          onChange={(e) => setNinjaKey(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
          placeholder="Enter your API key"
        />
      </div>

      <div className="p-4 bg-gray-700/50 rounded-lg">
        <h3 className="text-xl font-semibold text-purple-300 mb-3">ElevenLabs Integration</h3>
        <p className="text-gray-400 mb-4 text-sm">Use your ElevenLabs API key to generate high-quality voiceovers and vocals. Keys are stored in your browser and not sent to our servers.</p>
        <label htmlFor="eleven-key" className="block text-sm font-medium text-gray-300 mb-2">ElevenLabs API Key</label>
        <input
          id="eleven-key"
          type="password"
          value={elevenLabsKey}
          onChange={(e) => setElevenLabsKey(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition"
          placeholder="Enter your API key"
        />
      </div>

      <div className="p-4 bg-gray-700/50 rounded-lg">
        <h3 className="text-xl font-semibold text-purple-300 mb-3">Custom AI Model</h3>
        <p className="text-gray-400 mb-4 text-sm">Upload a compatible custom AI model file. This is an advanced feature and requires a specific model format.</p>
        
        {customModel && !isUploading && (
          <div className="bg-green-900/50 text-green-300 p-3 rounded-lg mb-4 text-center">
            <p className="font-semibold">Model loaded: {customModel.name}</p>
          </div>
        )}

        <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center flex flex-col items-center justify-center hover:border-purple-500 transition-colors relative">
          <UploadIcon />
          <p className="mt-4 text-gray-300">
            {isUploading ? "Uploading model..." : (customModel ? `${customModel.name} loaded` : "Upload your custom model file")}
          </p>
          <p className="text-xs text-gray-500 mt-1">Max file size: 3GB</p>
          <input 
            type="file" 
            onChange={handleFileChange}
            className="absolute w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
          />
        </div>
      </div>
    </div>
  );
};

export default ModelManager;
