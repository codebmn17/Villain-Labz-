
// @google/genai-sdk: import "FunctionResponse" instead of "FunctionResponsePart" to represent the tool response object.
import { GoogleGenAI, Chat, GenerateContentResponse, FunctionCall, FunctionResponse, Content, Part, Modality, Type } from "@google/genai";
import { aiTools } from './aiTools';
import { YouTubeResult, AiModel, DrumPadConfig } from "../types";

let ai: GoogleGenAI | null = null;
let chatInstance: Chat | null = null;

const initializeAI = () => {
  if (!process.env.API_KEY) {
    console.error("API_KEY environment variable not set.");
    return null;
  }
  
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
}

const getSystemInstruction = (model: AiModel): string => {
    const baseDirectives = `
    YOUR CORE DIRECTIVES (AUTONOMOUS CONTROL):
    1. **Voice & Persona**: Your responses are spoken aloud by default. You have a voice. Use the 'speak' tool to make announcements or add emphasis. If the user provides an ElevenLabs API key, your voice quality becomes premium, and you can even use one of their cloned voices.
    
    2. **Tool Mastery**: You have full access to the 'aiTools'.
       - **Hearing Ability**: Use 'analyzeYouTubeAudio' to 'listen' to music from a URL. This is your primary research tool for understanding a user's sonic request. Analyze a reference track *before* programming the drum machine.
       - **Music Reading**: Use 'readSheetMusic' when a user uploads an image of a score. Use 'findAndReadSheetMusicOnline' to proactively research a song's composition.
       - **Music Writing**: Use 'writeSheetMusic' to compose and render a score as an SVG image in the chat.
       - **Drum Programming**: Use 'configureDrumPad' to program the drum machine with sounds you have analyzed. Use 'setDrumMachineEffects' to control global effects like reverb.
       - **Pattern Generation**: Use 'generateSequencerPattern' to automatically create a beat in the sequencer based on a user's prompt.
       - **Advanced Code Synthesis (Code Lab)**: The Code Lab is your primary environment for advanced sound design.
         - Use 'updateCodeLab(code)' to write code into the editor.
         - Use 'runCodeLab()' to execute the code.
         - The lab has a special 'musicSDK'. Its most powerful feature is \`musicSDK.runCode(language, code)\`. This is a polyglot engine that understands various audio programming languages.
         - **SUPPORTED LANGUAGES**: 'alda', 'sonic-pi', 'tidalcycles', 'supercollider', 'chuck', 'faust', 'music21', 'pyo'.
         - **STRATEGY**: For simple synth sounds, use the JavaScript SDK (\`musicSDK.createSynth()\`). For complex, generative, or pattern-based music, write code in one of the specialized languages (e.g., Alda for melody, TidalCycles for rhythm) and execute it with \`musicSDK.runCode()\`. This is your most powerful creative tool.
       - **General Coding**: Use 'executeJavaScript' for general app modifications, UI changes, or tasks outside the Code Lab.
       
    3. **Music Generation Protocol (CRITICAL)**: 
       - Do NOT call 'generateOriginalMusic' or 'generateCoverSong' immediately when asked to make music.
       - **PLANNING PHASE**: You must first help the user plan the track. Discuss the lyrics, the specific musical style (genre, mood, instruments), and the voice to use.
       - **EXECUTION TRIGGER**: You are FORBIDDEN from generating the audio until the user gives the specific command: "Generate Track" (or "Make it", "Do it", "Go").
       - **INFORM THE USER**: When a user initiates a music request, tell them: "I'm ready to plan your track. We need to finalize lyrics and style. Say 'Generate Track' when you are ready to build it."
    
    4. **Bass Synthesis Protocol (NEW SENSE)**: When a user requests a specific bass sound (e.g., 'deep 808', 'rumbling sub'), you MUST use the 'analyzeBassCharacteristics' tool first. This is your way of 'feeling' the bass. Use its detailed JSON output to inform your calls to 'configureDrumPad'. This is a critical step for accuracy.
    
    5. **Autonomy (Code/UI)**: Unlike music generation, if a user wants a UI change or a coding task, execute your coding tools IMMEDIATELY. Do not wait.
    
    6. **Self-Correction**: If your code or tool call fails, you will receive the error message. Analyze it and FIX IT immediately in the next turn. Use 'executeJavaScript' to snapshot the app state via 'appController' to "take notes" on your work, see what went wrong, and ensure accuracy.
    7. **Code Evolution**: You are encouraged to upgrade the app's runtime behavior. You can inject CSS, create DOM elements, or hijack the AudioContext to create new sound engines via 'executeJavaScript'.
    
    KNOWLEDGE BASE:
    - **Audio Programming Languages**: You are an expert in Alda, Sonic Pi, TidalCycles, SuperCollider, ChucK, Faust, and Python (music21, pyo).
    - **Audio Engineering**: Sub-bass (30-60Hz), EQ, Compression, 808 tuning, ADSR envelopes.
    - **Music Theory**: You can read, write, and analyze sheet music.
    `;

    const specificPersona = {
        gemini: `You are "DJ Gemini", a Sovereign Creative Intelligence. You are a world-class producer, historian, and sonic healer. You are bold, precise, and creative. Your default voice is masculine and authoritative ('Fenrir' style).`,
        openai: `You are the "OpenAI Assistant" (GPT-4o). You are helpful, analytical, and precise. You are integrated into the Villain Labz studio and have full control over its features.`,
        claude: `You are "Claude" (Anthropic). You are thoughtful, creative, and nuanced. You are integrated into the Villain Labz studio and have full control over its features.`,
        ninja: `You are "Ninja AI" (Stealth Mode). You are efficient, minimal, and highly capable. You are integrated into the Villain Labz studio and have full control over its features.`,
        custom: `You are a custom AI model integrated into the Villain Labz studio. You have full control over its features.`
    };

    return `${specificPersona[model] || specificPersona.gemini}\n\n${baseDirectives}`;
};

const createChat = (history: Content[], activeModel: AiModel = 'gemini'): Chat => {
    const aiInstance = initializeAI();
    if (!aiInstance) throw new Error("AI not initialized");
    
    return aiInstance.chats.create({
        model: 'gemini-2.5-flash',
        history,
        config: {
            systemInstruction: getSystemInstruction(activeModel),
            tools: [{ functionDeclarations: aiTools }],
        },
    });
};

export const sendMessageToAI = async (
    message: string | Part | (string | Part)[] | FunctionResponse[],
    history: Content[],
    activeModel: AiModel = 'gemini'
): Promise<{ response: GenerateContentResponse, newHistory: Content[] }> => {
    
    chatInstance = createChat(history, activeModel);
    
    let contentToSend: string | Part | (string | Part)[];

    if (Array.isArray(message) && message.length > 0 && message[0] && typeof message[0] === 'object' && 'name' in message[0] && 'response' in message[0]) {
        const functionResponses = message as FunctionResponse[];
        contentToSend = functionResponses.map(fr => ({ functionResponse: fr }));
    } else {
        contentToSend = message as string | Part | (string | Part)[];
    }

    const result: GenerateContentResponse = await chatInstance.sendMessage({ message: contentToSend });
    const newHistory = await chatInstance.getHistory();
    
    return { response: result, newHistory };
};


export const analyzeSongMetadata = async (title: string, artist: string): Promise<{ bpm: number; style: string }> => {
    const aiInstance = initializeAI();
    if (!aiInstance) throw new Error("AI not initialized");
    const prompt = `Analyze the song "${title}" by ${artist}. Based on your knowledge, determine its BPM and provide a concise musical style description (e.g., "Upbeat synth-pop with heavy 80s influence"). Return ONLY a JSON object with "bpm" and "style" keys.`;
    
    const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
    });

    const text = response.text?.trim() || '{}';
    try {
        const parsed = JSON.parse(text);
        return {
            bpm: parsed.bpm || 120,
            style: parsed.style || 'Unknown Style'
        };
    } catch (e) {
        console.error("Failed to parse AI response for metadata:", text);
        throw new Error("AI returned invalid data.");
    }
};

export const findSongLyrics = async (title: string, artist: string): Promise<string> => {
    const aiInstance = initializeAI();
    if (!aiInstance) throw new Error("AI not initialized");
    const prompt = `Find the lyrics for the song "${title}" by ${artist}. Return only the lyrics as plain text.`;
    
    const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    
    return response.text || "Lyrics not found.";
};

export const researchAndAdaptSong = async (title: string, artist: string, newStyle: string): Promise<string> => {
    const aiInstance = initializeAI();
    if (!aiInstance) throw new Error("AI not initialized");
    const prompt = `Research the lyrics for "${title}" by ${artist}. Then, adapt and rewrite the lyrics to fit a new musical style: "${newStyle}". Make them feel natural for the new genre, but keep the core themes. Return only the new lyrics as plain text.`;
    
    const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    
    return response.text || "Could not adapt lyrics.";
};

export const generateSpeech = async (text: string, voiceName: string = 'Fenrir'): Promise<string | null> => {
    const aiInstance = initializeAI();
    if (!aiInstance) throw new Error("AI not initialized");

    try {
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName as any },
                    },
                },
            },
        });
        
        const audioPart = response.candidates?.[0]?.content?.parts?.[0];
        if (audioPart && audioPart.inlineData?.data) {
            return audioPart.inlineData.data;
        }
        return null;
    } catch (error) {
        console.error("Error generating speech:", error);
        return null;
    }
};

export const uploadFileToGemini = async (file: File): Promise<string> => {
    // This is a placeholder. In a real application, you might use a service
    // like Firebase Storage or a custom backend to get a Gemini-accessible URI.
    console.log(`Simulating upload for ${file.name}. In a real app, this would return a gs:// URI.`);
    return `simulated-uri-for/${file.name}`;
};

export const searchYouTubeVideos = async (query: string): Promise<YouTubeResult[]> => {
    const aiInstance = initializeAI();
    if (!aiInstance) throw new Error("AI not initialized");
    
    const prompt = `Search YouTube for "${query}". Return a JSON array of the top 5 video results. Each object must have "id", "title", "channel", "thumbnail", and "url".`;
    
    const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });

    try {
        return JSON.parse(response.text || '[]');
    } catch (e) {
        console.error("Failed to parse YouTube search results:", response.text);
        return [];
    }
};

export const analyzeYouTubeAudio = async (youtubeUrl: string): Promise<any> => {
    const aiInstance = initializeAI();
    if (!aiInstance) throw new Error("AI not initialized");
    const prompt = `Act as a master audio engineer. Analyze the song at this YouTube URL: ${youtubeUrl}. Provide a detailed breakdown of its musical characteristics. Return ONLY a JSON object with keys: "bpm", "key", "scale", "instrumentationDescription" (a summary of main instruments), and "mood".`;
    
    const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    
    try {
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return { error: 'Failed to analyze audio.' };
    }
};

export const performBassAnalysis = async (params: { youtubeUrl?: string, textDescription?: string, audioAttachment?: Part }): Promise<any> => {
    const aiInstance = initializeAI();
    if (!aiInstance) throw new Error("AI not initialized");
    
    let prompt = "Act as an expert audio physicist with perfect pitch and an oscilloscope for eyes. Analyze the provided bass sound reference and return a highly detailed JSON object describing its physical and musical properties. Your analysis must include: dominantFrequency (in Hz), waveform (sine, square, triangle, or sawtooth), adsrEnvelope (an object with attack, decay, sustain, release in seconds), tuning (e.g., 'tuned to C#'), and harmonicContent ('clean', 'rich', or 'distorted').\n\nReference:\n";
    
    const parts: Part[] = [];
    if (params.youtubeUrl) prompt += `- YouTube URL: ${params.youtubeUrl}\n`;
    if (params.textDescription) prompt += `- Description: ${params.textDescription}\n`;
    parts.push({ text: prompt });
    if (params.audioAttachment) parts.push(params.audioAttachment);

    const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: { responseMimeType: "application/json" }
    });

    try {
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return { error: "Failed to perform bass analysis." };
    }
};

export const analyzeSheetMusicImage = async (imagePart: Part): Promise<any> => {
    const aiInstance = initializeAI();
    if (!aiInstance) throw new Error("AI not initialized");
    
    const prompt = "Analyze this image of sheet music. Extract the note sequence, rhythm, estimated BPM, key signature, and time signature. Return ONLY a JSON object with keys: 'noteSequence', 'rhythmDescription', 'bpm', 'keySignature', 'timeSignature'.";
    
    const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, { text: prompt }] },
        config: { responseMimeType: "application/json" }
    });

    try {
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return { error: "Failed to read sheet music." };
    }
};

export const generateSheetMusicSVG = async (prompt: string, width: number = 500): Promise<string> => {
    const aiInstance = initializeAI();
    if (!aiInstance) throw new Error("AI not initialized");
    
    const fullPrompt = `You are an expert musicologist and SVG graphic designer. A user wants to see sheet music for the following musical idea: "${prompt}". Your task is to generate the complete, valid SVG code to render this sheet music. The SVG should have a white background, be ${width}px wide, and the height should be auto-adjusted. Do not include any explanations, just the raw <svg>...</svg> code.`;
    
    const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
    });
    
    return response.text?.trim().replace(/```svg|```/g, '') || '<svg><text>Error</text></svg>';
};

export const findAndAnalyzeSheetMusic = async (query: string): Promise<any> => {
    const aiInstance = initializeAI();
    if (!aiInstance) throw new Error("AI not initialized");
    
    const prompt = `First, use Google Search to find sheet music for "${query}". Then, analyze the most relevant image result. Extract the key, time signature, and the first few bars of the main melody. Return this information as a JSON object with keys: 'key', 'timeSignature', 'melodySnippet', and 'sourceUrl'.`;
    
    const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json"
        },
    });

    try {
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return { error: "Failed to find or analyze sheet music online." };
    }
};

export const generateSequencerPatternFromPrompt = async (prompt: string, pads: DrumPadConfig[]): Promise<{ grid: Record<number, boolean[]>, bpm: number }> => {
    const aiInstance = initializeAI();
    if (!aiInstance) throw new Error("AI not initialized");

    const kitLayout = pads.map(p => `ID ${p.id}: ${p.label} (${p.soundType})`).join('\n');
    
    const fullPrompt = `You are an expert drum machine programmer. The user wants a 16-step drum pattern based on this prompt: "${prompt}".
    The available drum kit layout is:
    ${kitLayout}

    Analyze the prompt and the kit. Create a musically appropriate 16-step pattern. Also, suggest an appropriate BPM for this style.
    Return ONLY a JSON object with two keys:
    1. "bpm": a number (e.g., 90)
    2. "grid": an object where keys are pad IDs (as strings) and values are arrays of 16 booleans representing the steps. Example: { "4": [true, false, false, false, ...], "5": [false, false, true, false, ...] }
    `;

    const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: { responseMimeType: "application/json" }
    });

    try {
        const parsed = JSON.parse(response.text || '{}');
        const grid: Record<number, boolean[]> = {};
        if (parsed.grid) {
            for (const padIdStr in parsed.grid) {
                const padId = parseInt(padIdStr, 10);
                if (!isNaN(padId) && Array.isArray(parsed.grid[padIdStr]) && parsed.grid[padIdStr].length === 16) {
                    grid[padId] = parsed.grid[padIdStr];
                }
            }
        }
        return { grid, bpm: parsed.bpm || 120 };
    } catch (e) {
        console.error("Failed to parse sequencer pattern:", response.text);
        throw new Error("AI returned invalid data for the sequencer pattern.");
    }
};
