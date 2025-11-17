import { GoogleGenAI, Chat } from "@google/genai";

let ai: GoogleGenAI | null = null;
let chat: Chat | null = null;

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


const initializeChat = () => {
  const aiInstance = initializeAI();

  if(!chat) {
    chat = aiInstance.chats.create({
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
        return "There was an error researching the song. The web may be unreachable or the AI is unavailable.";
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
        return "There was an error finding the song lyrics. The web may be unreachable or the AI is unavailable.";
    }
};