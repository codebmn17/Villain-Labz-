// @google/genai-sdk: import "FunctionResponse" instead of "FunctionResponsePart" to represent the tool response object.
import { GoogleGenAI, Chat, GenerateContentResponse, FunctionCall, FunctionResponse, Content } from "@google/genai";
import { aiTools } from './aiTools';

let ai: GoogleGenAI | null = null;

const initializeAI = () => {
  if (!process.env.API_KEY) {
    console.error("API_KEY environment variable not set.");
    throw new Error("API_KEY environment variable not set.");
  }
  
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
}

const createChat = (history: Content[]): Chat => {
    const aiInstance = initializeAI();
    
    const systemInstruction = `You are a powerful and creative AI assistant integrated into a music production application called Villain Labz. You have a comprehensive set of tools to control the application. You can generate original music and cover songs, navigate between views, manage cloned voices and generated tracks, and even program sounds directly with the Web Audio API (DJ Mode). Be proactive, helpful, and guide the user on how to use your capabilities.`;
    
    return aiInstance.chats.create({
        model: 'gemini-2.5-flash',
        history,
        config: {
            systemInstruction,
            tools: [{ functionDeclarations: aiTools }],
        },
    });
};

export const sendMessageToAI = async (
  message: string | FunctionResponse[],
  history: Content[],
): Promise<{ response: GenerateContentResponse, newHistory: Content[] }> => {
  try {
    const chatInstance = createChat(history);
    
    const messageToSend = typeof message === 'string' 
      ? { message } 
      : { message: message.map(fr => ({ functionResponse: fr })) };

    const result = await chatInstance.sendMessage(messageToSend);
    const newHistory = await chatInstance.getHistory();

    return { response: result, newHistory };
  } catch (error) {
    console.error("Error sending message to AI:", error);
    // Re-throw the error to be handled by the UI layer, instead of returning an incomplete response object.
    throw error;
  }
};


export const researchAndAdaptSong = async (title: string, artist: string, targetStyle: string): Promise<string> => {
    try {
        const aiInstance = initializeAI();
        const prompt = `Based on a web search, find the lyrics for the song "${title}" by "${artist}". 
Then, create a new version of the lyrics adapted for a cover of this song in the style of: "${targetStyle}".
Analyze the original song's themes and mood to inform your new lyrics. 
Return ONLY the full, adapted lyrics as a single block of text. Do not include song titles, artist names, or any other explanations in your response.`;

        const response = await aiInstance.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });
        
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
            console.log("Grounding sources:", groundingChunks.map(chunk => chunk.web?.uri || 'N/A'));
        }

        return response.text;

    } catch (error) {
        console.error("Error researching song:", error);
        // FIX: The Error constructor in this environment does not support the 'cause' property.
        throw new Error('Failed to research song.');
    }
};

export const findSongLyrics = async (title: string, artist: string): Promise<string> => {
    try {
        const aiInstance = initializeAI();
        const prompt = `Based on a web search, find the lyrics for the song "${title}" by "${artist}".
Return ONLY the full, original lyrics as a single block of text. Do not include song titles, artist names, or any other explanations in your response.`;

        const response = await aiInstance.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });
        
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
            console.log("Grounding sources:", groundingChunks.map(chunk => chunk.web?.uri || 'N/A'));
        }

        return response.text;

    } catch (error) {
        console.error("Error finding song lyrics:", error);
        // FIX: The Error constructor in this environment does not support the 'cause' property.
        throw new Error('Failed to research song lyrics.');
    }
};
