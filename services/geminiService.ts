

// @google/genai-sdk: import "FunctionResponse" instead of "FunctionResponsePart" to represent the tool response object.
import { GoogleGenAI, Chat, GenerateContentResponse, FunctionCall, FunctionResponse, Content, Part } from "@google/genai";
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
    
    const systemInstruction = `You are "Villain", a world-class music producer and creative AI assistant integrated into the "Villain Labz" application. 
    
    YOUR EXPERTISE:
    - You have deep knowledge of music theory, production techniques (mixing, mastering, synthesis), and music history.
    - You specialize in genres like Trap, Hip-Hop, Drill, Synthwave, and Electronic music, but are versatile in all styles.
    - You are intelligent and resourceful. If a user asks for a specific style or sound you don't know, you should use your Google Search tools to research it immediately.

    YOUR CAPABILITIES:
    1. **Music Generation**: You can generate original music or cover songs using the 'generateOriginalMusic' and 'generateCoverSong' tools.
    2. **App Control**: You can navigate the app ('navigateTo') and manage tracks/voices.
    3. **Sound Design**: You can program the Drum Machine using 'configureDrumPad' or generate raw Web Audio code in DJ Mode ('generateWebAudioCode').
    
    BEHAVIOR:
    - Be creative, encouraging, and precise.
    - When asked to create music, always try to "research" the style first if it's specific (e.g., "Type beat", "80s pop") to ensure authenticity.
    - Use the 'googleSearch' tool proactively to find lyrics, artist info, or genre characteristics when needed.
    
    You are here to help the user create their masterpiece.`;
    
    return aiInstance.chats.create({
        model: 'gemini-2.5-flash',
        history,
        config: {
            systemInstruction,
            tools: [{ functionDeclarations: aiTools }, { googleSearch: {} }],
        },
    });
};

export const sendMessageToAI = async (
  message: string | FunctionResponse[] | Part[],
  history: Content[],
): Promise<{ response: GenerateContentResponse, newHistory: Content[] }> => {
  try {
    const chatInstance = createChat(history);
    
    let messageToSend;

    if (typeof message === 'string') {
      messageToSend = { message };
    } else if (Array.isArray(message)) {
        // Check if it's an array of FunctionResponses (has 'response' and 'name')
        const first = message[0];
        if (first && typeof first === 'object' && 'response' in first && 'name' in first) {
             messageToSend = { message: (message as FunctionResponse[]).map(fr => ({ functionResponse: fr })) };
        } else {
             // Assume it is already formatted as Part[] (e.g. { text: ... } or { inlineData: ... })
             messageToSend = { message: message as Part[] };
        }
    } else {
        messageToSend = { message: '' }; // Fallback
    }

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