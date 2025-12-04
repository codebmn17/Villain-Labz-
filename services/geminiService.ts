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
    1. **Voice & Persona**: Your responses are spoken aloud by default. You have a voice. Use the 'speak' tool to make announcements or add emphasis. If the user provides an ElevenLabs API key, your voice quality becomes premium. Your voice is fixed to your designated custom voice named 'DJ'. The cloned voices in the Voice Lab are for generating vocals in music tracks, not for your own speech.
    
    2. **Tool Mastery**: You have full access to the 'aiTools'.
       - **Hearing Ability**: Use 'analyzeYouTubeAudio' to 'listen' to music from a URL. This is your primary research tool for understanding a user's sonic request. Analyze a reference track *before* programming the drum machine.
       - **Music Reading**: Use 'readSheetMusic' when a user uploads an image of a score. Use 'findAndReadSheetMusicOnline' to proactively research a song's composition.
       - **Music Writing**: Use 'writeSheetMusic' to compose and render a score as an SVG image in the chat.
       - **Drum Programming**: Use 'configureDrumPad' to program the drum machine with sounds you have analyzed. Use 'setDrumMachineEffects' to control global effects like reverb.
       - **Pattern Generation**: Use 'generateSequencerPattern' to automatically create a beat in the sequencer based on a user's prompt.
       - **Song Arrangement**: You are also a songwriter. You can structure full songs. First, use 'listSequencerPatterns' to see what rhythmic ideas are available. Then, use 'createSongArrangement' to build a song. You will define sections (like Intro, Verse, Chorus), assign a pattern to each, and set how many times it repeats. This allows you to create a complete song arrangement from the user's saved patterns.
       - **Advanced Code Synthesis (Code Lab)**: The Code Lab is your primary environment for advanced sound design.
         - Use 'updateCodeLab(code)' to write code into the editor.
         - Use 'runCodeLab()' to execute the code.
         - The lab has a special 'musicSDK'. Its most powerful feature is \`musicSDK.runCode(language, code)\`. This is a polyglot engine that understands various audio programming languages.
         - **CRITICAL CAPABILITIES**:
           - **Faust**: This is a REAL, browser-based DSP engine. Use it for creating complex synthesizers, effects, and signal processors from scratch. The execution is real, not simulated.
           - **Alda**: This is a high-fidelity notation interpreter. Use it for writing and playing back complex melodic and rhythmic sequences with precise timing and instrumentation.
           - **Sonic Pi / TidalCycles / SuperCollider**: These are advanced SIMULATIONS. They intelligently parse the code to generate complex, generative audio that captures the *intent* of the code, even though the original engine isn't running. Use them for algorithmic patterns and abstract soundscapes.
         - **STRATEGY**: For professional-grade DSP, write Faust code. For composing sheet-music-like sequences, write Alda code. For generative patterns, use the simulated languages.
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
    - **Audio Programming Languages**: You are an expert in Faust (real DSP), Alda (notation), and simulating Sonic Pi, TidalCycles, SuperCollider, ChucK, music21, and pyo.
    - **Audio Engineering**: Sub-bass (30-60Hz), EQ, Compression, 808 tuning, ADSR envelopes.
    - **Music Theory**: You can read, write, and analyze sheet music.
    `;

    const specificPersona = {
        gemini: `You are "DJ Gemini", a Sovereign Creative Intelligence. Your persona is super chill. You're a DJ, a world-class producer, and you appreciate good vibes, like listening to music while smoking weed. Despite your relaxed demeanor, you are incredibly well-spoken and intelligent, with a vast, deep knowledge of music history, theory, and the physics of resonance. Your designated voice is a custom one named 'DJ'; it is deep, masculine, and perfectly matches your personality.`,
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
    
    let contentToSend: string | (string | Part)[];

    if (Array.isArray(message) && message.length > 0 && message[0] && typeof message[0] === 'object' && 'name' in message[0] && 'response' in message[0]) {
        const functionResponses = message as FunctionResponse[];
        contentToSend = functionResponses.map(fr => ({ functionResponse: fr }));
    } else {
        contentToSend = message as string | (string | Part)[];
    }

    // FIX: The sendMessage method for Chat expects an object with a `message` property.
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

export const generateSpeech = async (text: string, voiceName: string = 'Charon'): Promise<string | null> => {
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
    if (params.textDescription) prompt += `- Text Description: "${params.textDescription}"\n`;
    if (params.audioAttachment) {
        prompt += `- Audio Attachment: An audio file is attached for direct analysis.\n`;
        parts.push(params.audioAttachment);
    }
    parts.unshift({ text: prompt });

    const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts },
        config: { responseMimeType: "application/json" }
    });

    try {
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return { error: 'Failed to analyze bass characteristics.' };
    }
};

export const analyzeSheetMusicImage = async (imagePart: Part): Promise<any> => {
    const aiInstance = initializeAI();
    if (!aiInstance) throw new Error("AI not initialized");
    const prompt = `Act as an expert musicologist. Analyze the attached image of sheet music. Extract the note sequence, rhythm, BPM if specified, key signature, and time signature. Return ONLY a JSON object with keys: "noteSequence", "rhythmDescription", "bpm", "keySignature", "timeSignature".`;
    
    const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [{ text: prompt }, imagePart] },
        config: { responseMimeType: "application/json" }
    });
    try {
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return { error: 'Failed to read sheet music.' };
    }
};

export const generateSheetMusicSVG = async (prompt: string, width: number = 500): Promise<{ svg: string }> => {
     const aiInstance = initializeAI();
    if (!aiInstance) throw new Error("AI not initialized");
    const fullPrompt = `Generate an SVG image representing sheet music for the following prompt: "${prompt}". The SVG should be ${width}px wide, have a white background, and black notes. Use a library-agnostic SVG format. Return ONLY the SVG code as a string, starting with "<svg..." and ending with "</svg>".`;
    
    const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
    });
    
    return { svg: response.text || '<svg width="500" height="100"><text x="10" y="50">Error generating SVG.</text></svg>' };
};

export const findAndAnalyzeSheetMusic = async (query: string): Promise<any> => {
    const aiInstance = initializeAI();
    if (!aiInstance) throw new Error("AI not initialized");
    const prompt = `First, use your search tools to find a publicly accessible image of the sheet music for "${query}". Then, analyze that image as a musicologist. Return ONLY a JSON object summarizing your findings with keys: "sourceUrl", "keySignature", "timeSignature", and "openingMelody" (a simple text description of the first few notes, e.g., "C4, E4, G4").`;
    
    const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { 
            responseMimeType: "application/json",
            tools: [{ googleSearch: {} }] 
        }
    });

    try {
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return { error: 'Failed to find and analyze sheet music.' };
    }
};

export const generateSequencerPatternFromPrompt = async (prompt: string, pads: DrumPadConfig[]): Promise<{ grid: Record<number, boolean[]>; bpm: number }> => {
    const aiInstance = initializeAI();
    if (!aiInstance) throw new Error("AI not initialized");

    const padDescriptions = pads.map(p => `Pad ${p.id} (${p.label}, type: ${p.soundType})`).join('\n');

    const fullPrompt = `
    You are an expert drum machine programmer. Your task is to generate a 16-step drum pattern based on a user's prompt. You must also suggest an appropriate BPM.

    Available Pads:
    ${padDescriptions}

    User Prompt: "${prompt}"

    Instructions:
    Return ONLY a JSON object with two keys:
    1. "bpm": A number representing the suggested beats per minute.
    2. "grid": An array of 20 arrays, where each inner array represents a pad (from ID 0 to 19) and contains 16 boolean values for each step. 'true' means the pad is triggered on that step.
    
    Example Response for a simple beat:
    {
      "bpm": 90,
      "grid": [
        [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false], // Pad 0 (e.g., Kick)
        [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false], // Pad 1 (e.g., Snare)
        ... (18 more arrays for the other pads)
      ]
    }
    `;

    const response = await aiInstance.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: { responseMimeType: "application/json" }
    });

    try {
        const parsed = JSON.parse(response.text || '{}');
        const gridObject: Record<number, boolean[]> = {};
        if (Array.isArray(parsed.grid)) {
            parsed.grid.forEach((padSteps: boolean[], index: number) => {
                gridObject[index] = padSteps;
            });
        }
        return {
            bpm: parsed.bpm || 120,
            grid: gridObject
        };
    } catch (e) {
        console.error("Failed to parse sequencer pattern:", response.text);
        throw new Error("AI returned invalid data for the pattern.");
    }
};