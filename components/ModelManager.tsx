import React, { useState } from 'react';
import { UploadIcon } from './icons/UploadIcon';
import { AgentIcon } from './icons/AgentIcon';

interface ModelManagerProps {
  elevenLabsKey: string;
  setElevenLabsKey: (key: string) => void;
  customModel: File | null;
  setCustomModel: (file: File | null) => void;
  isDjActive: boolean;
  setIsDjActive: (isActive: boolean) => void;
}

const ModelManager: React.FC<ModelManagerProps> = ({ 
  elevenLabsKey, 
  setElevenLabsKey, 
  customModel, 
  setCustomModel,
  isDjActive,
  setIsDjActive
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
        <p className="text-gray-400">Configure external models and AI agents to expand your creative toolkit.</p>
      </div>

      <div className="p-4 bg-gray-700/50 rounded-lg">
        <div className="flex items-center mb-3">
            <AgentIcon className="h-8 w-8 text-purple-400 mr-3" />
            <h3 className="text-xl font-semibold text-purple-300">DJ Autonomous Agent</h3>
        </div>
        <p className="text-gray-400 mb-4 text-sm">Activate DJ to give the AI assistant autonomous coding abilities. DJ can programmatically create sounds, beats, and effects using the Web Audio API, perfect for live generation and sound design.</p>
        <button
          onClick={() => setIsDjActive(!isDjActive)}
          className={`w-full font-bold py-2 px-4 rounded-lg transition-colors duration-300 ${isDjActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
        >
          {isDjActive ? 'Deactivate DJ' : 'Activate DJ'}
        </button>
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
