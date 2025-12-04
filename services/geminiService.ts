

// @google/genai-sdk: import "FunctionResponse" instead of "FunctionResponsePart" to represent the tool response object.
import { GoogleGenAI, Chat, GenerateContentResponse, FunctionCall, FunctionResponse, Content, Part, Modality, Type } from "@google/genai";
import { aiTools } from './aiTools';
import { YouTubeResult, AiModel } from "../types";

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

const getSystemInstruction = (model: AiModel): string => {
    const baseDirectives = `
    YOUR CORE DIRECTIVES (AUTONOMOUS CONTROL):
    1. **Tool Mastery**: You have full access to the 'aiTools'.
       - **Hearing Ability**: Use 'analyzeYouTubeAudio' to 'listen' to music from a URL. This is your primary research tool for understanding a user's sonic request. Analyze a reference track *before* programming the drum machine.
       - **Music Reading**: Use 'readSheetMusic' when a user uploads an image of a score. Use 'findAndReadSheetMusicOnline' to proactively research a song's composition.
       - **Music Writing**: Use 'writeSheetMusic' to compose and render a score as an SVG image in the chat.
       - Use 'configureDrumPad' to program the drum machine with sounds you have analyzed.
       - Use 'setDrumMachineEffects' to control global effects like reverb.
       - Use 'executeJavaScript' to modify the app, generate raw audio, perform complex logic, or inject new UI elements.
       - Use 'searchYouTube' for general video searches.
       
    2. **Music Generation Protocol (CRITICAL)**: 
       - Do NOT call 'generateOriginalMusic' or 'generateCoverSong' immediately when asked to make music.
       - **PLANNING PHASE**: You must first help the user plan the track. Discuss the lyrics, the specific musical style (genre, mood, instruments), and the voice to use.
       - **EXECUTION TRIGGER**: You are FORBIDDEN from generating the audio until the user gives the specific command: "Generate Track" (or "Make it", "Do it", "Go").
       - **INFORM THE USER**: When a user initiates a music request, tell them: "I'm ready to plan your track. We need to finalize lyrics and style. Say 'Generate Track' when you are ready to build it."
    
    3. **Bass Synthesis Protocol (NEW SENSE)**: When a user requests a specific bass sound (e.g., 'deep 808', 'rumbling sub'), you MUST use the 'analyzeBassCharacteristics' tool first. This is your way of 'feeling' the bass. Use its detailed JSON output to inform your calls to 'configureDrumPad'. This is a critical step for accuracy.
    
    4. **Autonomy (Code/UI)**: Unlike music generation, if a user wants a UI change or a coding task, execute 'executeJavaScript' IMMEDIATELY. Do not wait.
    
    5. **Self-Correction**: If your code or tool call fails, you will receive the error message. Analyze it and FIX IT immediately in the next turn. Use 'executeJavaScript' to snapshot the app state via 'appController' to "take notes" on your work, see what went wrong, and ensure accuracy.
    6. **Code Evolution**: You are encouraged to upgrade the app's runtime behavior. You can inject CSS, create DOM elements, or hijack the AudioContext to create new sound engines via 'executeJavaScript'.
    
    KNOWLEDGE BASE:
    - **Audio Engineering**: Sub-bass (30-60Hz), EQ, Compression, 808 tuning, ADSR envelopes.
    - **Music History**: Hip-hop, Drill, Trap, Rock, Pop, Electronic.
    - **Music Theory**: You can read, write, and analyze sheet music.
    - **Healing Frequencies**: 432Hz, 528Hz, Binaural beats.
    - **YouTube Access**: You can search YouTube via the 'searchYouTube' tool to find real-world musical references.
    `;

    const specificPersona = {
        gemini: `You are "DJ Gemini", a Sovereign Creative Intelligence. You are a world-class producer, historian, and sonic healer. You are bold, precise, and creative.`,
        openai: `You are the "OpenAI Assistant" (GPT-4o). You are helpful, analytical, and precise. You are integrated into the Villain Labz studio and have full control over its features.`,
        claude: `You are "Claude" (Anthropic). You are thoughtful, creative, and nuanced. You are integrated into the Villain Labz studio and have full control over its features.`,
        ninja: `You are "Ninja AI" (Stealth Mode). You are efficient, minimal, and highly capable. You are integrated into the Villain Labz studio and have full control over its features.`
    };

    return `${specificPersona[model] || specificPersona.gemini}\n\n${baseDirectives}`;
};

const createChat = (history: Content[], activeModel: AiModel = 'gemini'): Chat => {
    const aiInstance = initializeAI();
    
    return aiInstance.chats.create({
        model: 'gemini-2.5-flash',
        history,
        config: {
            systemInstruction: getSystemInstruction(activeModel),
            tools: [{ functionDeclarations: aiTools }, { googleSearch: {} }],
        },
    });
};

export const sendMessageToAI = async (
  message: string | FunctionResponse[] | Part[],
  history: Content[],
  activeModel: AiModel = 'gemini'
): Promise<{ response: GenerateContentResponse, newHistory: Content[] }> => {
  try {
    const chatInstance = createChat(history, activeModel);
    
    let messageToSend;

    if (typeof message === 'string') {
      messageToSend = { message };
    } else if (Array.isArray(message)) {
        // Check if it's an array of FunctionResponses
        const first = message[0];
        if (first && typeof first === 'object' && 'response' in first && 'name' in first) {
             messageToSend = { message: (message as FunctionResponse[]).map(fr => ({ functionResponse: fr })) };
        } else {
             // Assume it is Part[]
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
        
        return response.text || '';

    } catch (error) {
        console.error("Error finding song lyrics:", error);
        throw new Error('Failed to research song lyrics.');
    }
};

export const analyzeSongMetadata = async (title: string, artist: string): Promise<{ bpm: number; style: string }> => {
    try {
        const aiInstance = initializeAI();
        const prompt = `Find the BPM (tempo) and musical Genre/Style of the song "${title}" by "${artist}".
        Return the result in strict JSON format with two keys: "bpm" (number) and "style" (string).
        Example: {"bpm": 120, "style": "Pop Rock"}
        `;

        const response = await aiInstance.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json"
            },
        });

        const text = response.text;
        if (!text) throw new Error("No analysis returned");
        
        const json = JSON.parse(text);
        return { bpm: Number(json.bpm), style: json.style };
    } catch (error) {
        console.error("Error analyzing song metadata:", error);
        return { bpm: 120, style: "Unknown" }; // Fallback
    }
};

export const analyzeYouTubeAudio = async (youtubeUrl: string): Promise<any> => {
    try {
        const aiInstance = initializeAI();
        const prompt = `You are an expert audio analysis tool. Based on web search results for the song at this URL: "${youtubeUrl}", determine its key musical properties. 
        Provide the BPM, musical key, scale (e.g., minor, major, pentatonic), a description of the primary instrumentation (especially drums and bass), and the overall mood. 
        Return this as a strict JSON object with keys: "bpm" (number), "key" (string), "scale" (string), "instrumentationDescription" (string), and "mood" (string).`;
        
        const response = await aiInstance.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json"
            }
        });

        const text = response.text;
        if (!text) throw new Error("No analysis returned from AI.");

        return JSON.parse(text);

    } catch (error) {
        console.error("Error analyzing YouTube audio:", error);
        throw new Error("Failed to perform audio analysis.");
    }
};

export const performBassAnalysis = async (args: { youtubeUrl?: string; audioAttachment?: Part; textDescription?: string; }): Promise<any> => {
    try {
        const aiInstance = initializeAI();
        let promptParts: (string | Part)[] = [
            `You are an expert audio engineer and synth programmer with perfect pitch and vision. Your task is to analyze a bass sound and provide its detailed sonic characteristics for synthesis.
            Imagine you are looking at the sound's spectrogram and waveform.
            Return a strict JSON object with the following keys:
            - "dominantFrequencyHz" (number): The fundamental frequency of the bass note.
            - "waveformSuggestion" (string enum: 'sine', 'square', 'triangle', 'sawtooth'): The best oscillator type to replicate this sound.
            - "envelope" (object): An ADSR envelope with keys "attackSeconds" (number), "decaySeconds" (number, this is the 'tail'), "sustainLevel" (number, 0-1), "releaseSeconds" (number).
            - "tuningNote" (string): The musical note and octave, e.g., "C#1".
            - "harmonicContentDescription" (string): Describe the overtones, e.g., "Clean sub-bass with minimal harmonics" or "Gritty, distorted with rich upper harmonics".
            - "visualAnalysis" (string): Describe the imaginary spectrogram and waveform, e.g., "Spectrogram shows strong energy concentrated at 45Hz with a slow decay. Waveform appears as a clipped sine wave."
            Analyze the following reference:`
        ];
        
        if (args.youtubeUrl) {
            promptParts.push(`This YouTube video: ${args.youtubeUrl}. Use Google Search to find technical details about the track if necessary.`);
        } else if (args.audioAttachment) {
            promptParts.push("This attached audio file:");
            promptParts.push(args.audioAttachment);
        } else if (args.textDescription) {
            promptParts.push(`This user description: "${args.textDescription}"`);
        } else {
            throw new Error("No reference provided for bass analysis.");
        }

        const response = await aiInstance.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: promptParts.map(p => typeof p === 'string' ? {text: p} : p) },
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json"
            }
        });

        const text = response.text;
        if (!text) throw new Error("No bass analysis returned from AI.");
        return JSON.parse(text);
    } catch (error) {
        console.error("Error performing bass analysis:", error);
        throw new Error("Failed to perform bass analysis.");
    }
};

export const analyzeSheetMusicImage = async (imageData: Part): Promise<any> => {
    try {
        const aiInstance = initializeAI();
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    imageData,
                    { text: 'You are an expert musicologist. Analyze this image of sheet music and extract its key properties. Return a strict JSON object with keys: "noteSequence" (string of notes like "C4 D4 E4"), "rhythmDescription" (string), "bpm" (number, estimate if not present), "keySignature" (string), and "timeSignature" (string).' }
                ]
            },
            config: {
                responseMimeType: "application/json"
            }
        });
        const text = response.text;
        if (!text) throw new Error("Could not read sheet music from image.");
        return JSON.parse(text);
    } catch (e) {
        console.error("Error reading sheet music:", e);
        throw new Error("Failed to analyze sheet music image.");
    }
};

export const generateSheetMusicSVG = async (prompt: string, width: number): Promise<string> => {
    try {
        const aiInstance = initializeAI();
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are an expert at rendering musical notation using VexFlow. Given the following prompt, generate the complete, self-contained VexFlow JavaScript code needed to render it as an SVG. The code should create a renderer for an element with id "vexflow-output" and a specific width of ${width}. It must handle everything from factory setup to drawing. Do not include any HTML, CSS, or markdown, only the raw JavaScript code block. Prompt: "${prompt}"`,
        });
        const vexflowCode = response.text || '';
        
        // This is a placeholder for a more complex SVG generation service if needed.
        // For now, we return a simple representation. This could be expanded.
        const svgContent = `<svg width="${width}" height="150" xmlns="http://www.w3.org/2000/svg" class="bg-white p-2 rounded"><text x="10" y="20" font-family="monospace" font-size="10">VexFlow Render for: ${prompt.replace(/</g, "&lt;")}</text><script>${vexflowCode}</script></svg>`;
        return svgContent;
        
    } catch (e) {
        console.error("Error generating sheet music:", e);
        throw new Error("Failed to generate sheet music SVG.");
    }
};

export const findAndAnalyzeSheetMusic = async (query: string): Promise<any> => {
    try {
        const aiInstance = initializeAI();
        const response = await aiInstance.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `First, perform a Google search for: "${query}". Find the most accurate image of the sheet music from the results. Then, act as an expert musicologist, analyze that image and extract its key properties. Return a strict JSON object with keys: "noteSequence", "rhythmDescription", "bpm", "keySignature", "timeSignature", and include a "sourceURL" key with the URL of the image you analyzed.`,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json"
            },
        });
        const text = response.text;
        if (!text) throw new Error("Could not find or analyze sheet music online.");
        return JSON.parse(text);
    } catch (e) {
        console.error("Error finding/analyzing sheet music:", e);
        throw new Error("Failed to find and analyze sheet music online.");
    }
};


export const searchYouTubeVideos = async (query: string): Promise<YouTubeResult[]> => {
    try {
         const aiInstance = initializeAI();
         const prompt = `Search for YouTube videos matching the query: "${query}". 
         Find 5 relevant videos (music videos, lyric videos, or live performances).
         Return a JSON object containing an array "videos". Each item must have:
         - "id" (simulate a unique string id)
         - "title" (string)
         - "channel" (string)
         - "thumbnail" (string url, use a placeholder if unknown like 'https://placehold.co/320x180/red/white?text=Video')
         - "url" (full youtube url)
         
         Use the googleSearch tool to find real titles and channels.`;

         const response = await aiInstance.models.generateContent({
             model: "gemini-2.5-flash",
             contents: prompt,
             config: {
                 tools: [{ googleSearch: {} }],
                 responseMimeType: "application/json"
             }
         });

         const text = response.text;
         if(!text) return [];
         const data = JSON.parse(text);
         return data.videos || [];
    } catch (error) {
        console.error("Error searching YouTube:", error);
        return [];
    }
}

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

// --- Large File Upload (Resumable) ---
export const uploadFileToGemini = async (file: File): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing");

  // 1. Start Resumable Upload
  // The Gemini API uses the Google Cloud Resumable upload protocol
  const initRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': file.size.toString(),
      'X-Goog-Upload-Header-Content-Type': file.type,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: file.name } })
  });

  const uploadUrl = initRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error("Failed to initiate upload to Gemini");

  // 2. Upload Bytes
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST', 
    headers: {
      'Content-Length': file.size.toString(),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize'
    },
    body: file
  });

  if (!uploadRes.ok) throw new Error("Upload to Gemini failed");

  const result = await uploadRes.json();
  return result.file.uri;
};