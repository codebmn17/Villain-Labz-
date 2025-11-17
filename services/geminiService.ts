import { GoogleGenAI, Chat, FunctionDeclaration, Type, GenerateContentResponse, FunctionCall, FunctionResponsePart } from "@google/genai";

let ai: GoogleGenAI | null = null;
let chat: Chat | null = null;
let currentChatIsDj = false;

// Tool definition for the AI
const generateWebAudioCode: FunctionDeclaration = {
    name: 'generateWebAudioCode',
    description: "Generates and executes JavaScript code using the Web Audio API to create a sound or beat. Call this function when the user asks to create a sound, program a beat, or generate an audio effect. The code should create an AudioContext, set up nodes (like Oscillator, Gain, etc.), connect them, and play a sound. The code must be self-contained and executable in a browser environment. It must not reference any external variables. The function should return a string describing the outcome (e.g., 'Kick drum sound played successfully').",
    parameters: {
        type: Type.OBJECT,
        properties: {
            code: {
                type: Type.STRING,
                description: "The JavaScript code to execute. For example: `const audioCtx = new (window.AudioContext || window.webkitAudioContext)(); const oscillator = audioCtx.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); oscillator.connect(audioCtx.destination); oscillator.start(); oscillator.stop(audioCtx.currentTime + 1); return 'Sine wave at 440Hz played for 1 second.';`",
            },
        },
        required: ['code'],
    },
};


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

const getChat = (isDjActive: boolean): Chat => {
    const aiInstance = initializeAI();
    
    // If the chat mode has changed, or chat doesn't exist, create a new one.
    if (!chat || currentChatIsDj !== isDjActive) {
        currentChatIsDj = isDjActive;
        const systemInstruction = isDjActive
            ? 'You are DJ, a creative and autonomous music AI. You can write and execute code to generate sounds and beats. When asked to create audio, use your `generateWebAudioCode` tool. Be concise and helpful.'
            : 'You are a creative assistant for a musician. Be inspiring, helpful, and concise. Provide ideas for lyrics, song structures, chord progressions, and music styles. Use markdown for formatting.';
        
        chat = aiInstance.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction,
                tools: isDjActive ? [{ functionDeclarations: [generateWebAudioCode] }] : undefined,
            },
        });
    }
    
    return chat;
};


export const sendMessageToAI = async (
  message: string | FunctionResponsePart,
  isDjActive: boolean,
): Promise<GenerateContentResponse> => {
  try {
    const chatInstance = getChat(isDjActive);

    // For a stateful chat, we just send the next part of the conversation.
    // The `chat` object manages the full history.
    // When sending a FunctionResponsePart, it must be in an array.
    const result = await chatInstance.sendMessage(typeof message === 'string' ? { message } : { message: [message] });

    return result;
  } catch (error) {
    console.error("Error sending message to AI:", error);
    // Fix: Re-throw the error to be handled by the UI layer, instead of returning an incomplete response object.
    throw error;
  }
};


export const executeFunctionCall = async (functionCall: FunctionCall): Promise<{toolResponse: FunctionResponsePart, executionResult: string}> => {
    const { name, args } = functionCall;
    let result: any;
    let executionResult = '';

    if (name === 'generateWebAudioCode') {
        try {
            // new Function() is safer than eval()
            // Fix: Ensure argument to new Function is a string to prevent type errors.
            const func = new Function(String(args.code));
            result = func();
            executionResult = `Code executed successfully. AI response: "${String(result)}"`;
        } catch (e) {
            console.error("Error executing generated code:", e);
            result = { error: (e as Error).message };
            executionResult = `Error executing code: ${(e as Error).message}`;
        }
    } else {
        result = { error: `Unknown function call: ${name}` };
        executionResult = `Error: Unknown function call: ${name}`;
    }

    // Fix: `FunctionResponsePart` must be an object with a `functionResponse` key.
    const toolResponse: FunctionResponsePart = {
        functionResponse: {
            name,
            response: { result },
        }
    };

    return {
        toolResponse,
        executionResult
    };
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