
import { ClonedVoice } from '../types';

// A base64 encoded silent WAV file to use as a fallback/mock.
const silentAudioBase64 = "UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

const API_BASE = "https://api.elevenlabs.io/v1";

export const elevenLabsGenerate = async (text: string, apiKey: string, voiceId: string = "21m00Tcm4TlvDq8ikWAM"): Promise<string> => {
    if (!apiKey) {
        // Fallback Mock behavior if no key provided
        return new Promise((resolve) => {
            console.log(`Simulating ElevenLabs generation for text: "${text}"`);
            setTimeout(() => {
                const byteCharacters = atob(silentAudioBase64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(blob);
                resolve(audioUrl);
            }, 1500);
        });
    }

    // Real API Call
    try {
        const response = await fetch(`${API_BASE}/text-to-speech/${voiceId}`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'xi-api-key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                model_id: "eleven_monolingual_v1",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail?.message || 'ElevenLabs API Error');
        }

        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (error) {
        console.error("ElevenLabs Generation Error:", error);
        throw error;
    }
};

export const addVoice = async (name: string, description: string, files: File[], apiKey: string): Promise<ClonedVoice> => {
    if (!apiKey) {
        // Mock
        return new Promise(resolve => {
             setTimeout(() => {
                 resolve({
                     id: Date.now().toString(),
                     name: name,
                     description: description,
                     cloneDate: new Date().toISOString(),
                     category: 'cloned',
                     previewUrl: URL.createObjectURL(files[0]) // Just use the uploaded file as preview
                 });
             }, 2000);
        });
    }

    const formData = new FormData();
    formData.append('name', name);
    if (description) formData.append('description', description);
    // formData.append('labels', JSON.stringify({ "accent": "American" })); // Optional
    
    files.forEach(file => {
        formData.append('files', file);
    });

    try {
        const response = await fetch(`${API_BASE}/voices/add`, {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
            },
            body: formData
        });

        if (!response.ok) {
             const errorData = await response.json();
             throw new Error(errorData.detail?.message || 'Failed to add voice');
        }

        const data = await response.json();
        
        return {
            id: data.voice_id,
            name: name,
            description: description,
            cloneDate: new Date().toISOString(),
            category: 'cloned'
        };

    } catch (error) {
        console.error("ElevenLabs Add Voice Error:", error);
        throw error;
    }
};

export const getVoices = async (apiKey: string): Promise<ClonedVoice[]> => {
     if (!apiKey) return [];

     try {
        const response = await fetch(`${API_BASE}/voices`, {
            method: 'GET',
            headers: {
                'xi-api-key': apiKey,
            }
        });

        if (!response.ok) throw new Error('Failed to fetch voices');

        const data = await response.json();
        
        return data.voices.map((v: any) => ({
            id: v.voice_id,
            name: v.name,
            category: v.category,
            description: v.description,
            previewUrl: v.preview_url,
            cloneDate: new Date().toISOString() // API doesn't return creation date easily, mock for now
        }));

     } catch (error) {
         console.error("Error fetching voices:", error);
         return [];
     }
}
