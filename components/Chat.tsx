import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { sendMessageToAI, executeFunctionCall } from '../services/geminiService';
import { Content } from '@google/genai';

interface ChatProps {
  isDjActive: boolean;
}

const UI_HISTORY_KEY = 'villain_labz_ui_history';
const AI_HISTORY_KEY = 'villain_labz_ai_history';


const Chat: React.FC<ChatProps> = ({ isDjActive }) => {
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
      setMessages([{ sender: 'ai', text: "I'm your creative assistant. Ask me for lyric ideas, song structures, or anything else!" }]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(UI_HISTORY_KEY, JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to save UI history", e);
    }
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(aiHistory));
    } catch (e) {
      console.error("Failed to save AI history", e);
    }
  }, [aiHistory]);


  useEffect(() => {
    if (isDjActive) {
       const lastMessage = messages[messages.length - 1];
       if (!lastMessage || !lastMessage.text.startsWith("DJ is active.")) {
        setMessages(prev => [...prev, { sender: 'ai', text: "DJ is active. I can now write and execute code to generate audio. Try asking me to 'create a kick drum sound'."}]);
       }
    }
  }, [isDjActive, messages]);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (input.trim() === '' || isLoading) return;

    const userMessage: ChatMessage = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      // First call to the AI with the user's text
      let { response, newHistory } = await sendMessageToAI(currentInput, isDjActive, aiHistory);
      let functionCalls = response.functionCalls;
      setAiHistory(newHistory); // Update history after first call

      if (functionCalls && functionCalls.length > 0) {
        setMessages(prev => [...prev, { sender: 'ai', text: `DJ is writing code for: ${functionCalls[0].name}...` }]);
        
        // Execute the function and get the result
        const { toolResponse, executionResult } = await executeFunctionCall(functionCalls[0]);
        
        setMessages(prev => [...prev, { sender: 'ai', text: executionResult }]);

        // Send the tool response back to the AI to continue the conversation
        const finalResult = await sendMessageToAI(toolResponse, isDjActive, newHistory);
        response = finalResult.response;
        setAiHistory(finalResult.newHistory);
      }

      // The final response from the AI after the tool call (or the initial response if no tool call)
      const aiMessage: ChatMessage = { sender: 'ai', text: response.text };
      setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      console.error(error);
      const errorMessage: ChatMessage = { sender: 'ai', text: 'Sorry, I encountered an error. Please try again.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow-2xl animate-fade-in h-[85vh] flex flex-col">
      <h2 className="text-3xl font-bold text-purple-400 mb-4">AI Assistant {isDjActive && '(DJ Mode)'}</h2>
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
          placeholder="Ask for creative ideas..."
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