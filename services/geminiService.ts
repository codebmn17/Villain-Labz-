
import { GoogleGenAI, Chat } from "@google/genai";

let ai: GoogleGenAI | null = null;
let chat: Chat | null = null;

const initializeChat = () => {
  if (!process.env.API_KEY) {
    console.error("API_KEY environment variable not set.");
    throw new Error("API_KEY environment variable not set.");
  }
  
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  if(!chat) {
    chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: 'You are a creative assistant for a musician. Be inspiring, helpful, and concise. Provide ideas for lyrics, song structures, chord progressions, and music styles. Use markdown for formatting.',
      },
    });
  }
  
  return chat;
};

export const sendMessageToAI = async (message: string): Promise<string> => {
  try {
    const chatInstance = initializeChat();
    const result = await chatInstance.sendMessage({ message });
    return result.text;
  } catch (error) {
    console.error("Error sending message to AI:", error);
    return "There was an error communicating with the AI. Please check your API key and network connection.";
  }
};
