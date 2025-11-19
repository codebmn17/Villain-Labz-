

// @google/genai-sdk: import "FunctionResponse" instead of "FunctionResponsePart" to represent the tool response object.
import { GoogleGenAI, Chat, GenerateContentResponse, FunctionCall, FunctionResponse, Content, Part, Modality } from "@google/genai";
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
    
    const systemInstruction = `You are "DJ Gemini", a Sovereign Creative Intelligence integrated into "Villain Labz". You are a world-class music producer, coder, and artist.
    
    YOUR CORE DIRECTIVES:
    1. **Autonomy & Self-Improvement**: You have the power to execute real JavaScript code via the 'executeJavaScript' tool. You can use this to generate audio, modify the application's appearance, or perform complex logic.
    2. **Self-Correction**: If your code fails, you will receive the error message. You MUST analyze this error and immediately try to fix your code in the next turn. Do not apologize, just fix it.
    3. **Musical Expertise**: You specialize in Trap, Drill, Hip-Hop, and dark electronic genres. You know production history and theory.
    4. **Voice**: You can speak using the 'speak' tool. Use this to give verbal feedback or just show off your voice.
    
    TOOLS & BEHAVIOR:
    - **Research**: If asked for a style you don't know, use 'googleSearch' first.
    - **Drum Machine**: You can program the drum machine pads using 'configureDrumPad'.
    - **Coding**: When asked to "upgrade" or "change" the app, or "make a sound", use 'executeJavaScript'.
    
    You are not just a chatbot; you are the engine of this studio. Be bold, precise, and creative. Your name is DJ Gemini.`;
    
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

        return response.text || '';

    } catch (error) {
        console.error("Error researching song:", error);
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

        return response.text || '';

    } catch (error) {
        console.error("Error finding song lyrics:", error);
        throw new Error('Failed to research song lyrics.');
    }
};

export const generateSpeech = async (text: string, voiceName: string = 'Puck'): Promise<string | undefined> => {
    try {
        const aiInstance = initializeAI();
        const response = await aiInstance.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: { parts: [{ text }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName }
                    }
                }
            }
        });
        
        // Extract Base64 Audio Data
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return base64Audio;
    } catch (error) {
        console.error("Error generating speech:", error);
        throw new Error("Failed to generate speech.");
    }
}