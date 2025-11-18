
import { FunctionDeclaration, Type } from "@google/genai";
import { AppView } from "../types";

export const aiTools: FunctionDeclaration[] = [
    // Navigation
    {
        name: 'navigateTo',
        description: 'Navigate to a different screen or view within the application.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                view: {
                    type: Type.STRING,
                    description: 'The view to navigate to.',
                    enum: Object.values(AppView)
                }
            },
            required: ['view']
        }
    },
    // Music Generation
    {
        name: 'generateOriginalMusic',
        description: 'Generates a new, original piece of music based on provided lyrics, style, and a cloned voice.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                lyrics: { type: Type.STRING, description: 'The lyrics for the song.' },
                style: { type: Type.STRING, description: 'A detailed description of the musical style, genre, and mood. E.g., "Dark Synthwave with heavy bass".' },
                bpm: { type: Type.NUMBER, description: 'The beats per minute for the song, between 60 and 180.' },
                voiceId: { type: Type.STRING, description: 'The ID of the cloned voice to use for the vocals. Use listClonedVoices to get available IDs.' }
            },
            required: ['lyrics', 'style', 'bpm', 'voiceId']
        }
    },
    {
        name: 'generateCoverSong',
        description: 'Generates a cover of an existing song in a new style using a cloned voice.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                originalTitle: { type: Type.STRING, description: 'The title of the original song.' },
                originalArtist: { type: Type.STRING, description: 'The artist of the original song.' },
                style: { type: Type.STRING, description: 'The new musical style for the cover version.' },
                voiceId: { type: Type.STRING, description: 'The ID of the cloned voice to use for the vocals. Use listClonedVoices to get available IDs.' },
                adaptLyrics: { type: Type.BOOLEAN, description: 'Whether the AI should adapt the lyrics to fit the new style. Defaults to true.' }
            },
            required: ['originalTitle', 'originalArtist', 'style', 'voiceId']
        }
    },
    // State Querying
    {
        name: 'listClonedVoices',
        description: 'Lists all available cloned voices in the Voice Lab library.',
        parameters: { type: Type.OBJECT, properties: {} }
    },
    {
        name: 'listGeneratedTracks',
        description: 'Lists all music tracks that have been generated in the current session.',
        parameters: { type: Type.OBJECT, properties: {} }
    },
    // State Mutation
    {
        name: 'deleteGeneratedTrack',
        description: 'Deletes a generated music track from the storage by its ID.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                trackId: { type: Type.STRING, description: 'The ID of the track to delete. Use listGeneratedTracks to get available IDs.' }
            },
            required: ['trackId']
        }
    },
    {
        name: 'setElevenLabsApiKey',
        description: 'Sets the API key for the ElevenLabs service for high-quality voice generation.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                apiKey: { type: Type.STRING, description: 'The ElevenLabs API key.' }
            },
            required: ['apiKey']
        }
    },
     {
        name: 'setOpenAIApiKey',
        description: 'Sets the API key for OpenAI services.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                apiKey: { type: Type.STRING, description: 'The OpenAI API key.' }
            },
            required: ['apiKey']
        }
    },
    {
        name: 'setClaudeApiKey',
        description: 'Sets the API key for Claude (Anthropic) services.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                apiKey: { type: Type.STRING, description: 'The Claude API key.' }
            },
            required: ['apiKey']
        }
    },
    {
        name: 'setNinjaApiKey',
        description: 'Sets the API key for the Ninja AI service.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                apiKey: { type: Type.STRING, description: 'The Ninja AI API key.' }
            },
            required: ['apiKey']
        }
    },
    {
        name: 'setDjMode',
        description: 'Activates or deactivates the DJ Autonomous Agent, which can generate audio programmatically.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                isActive: { type: Type.BOOLEAN, description: 'Set to true to activate, false to deactivate.' }
            },
            required: ['isActive']
        }
    },
    // Code Execution & Self Improvement
    {
        name: 'executeJavaScript',
        description: "Executes raw JavaScript code in the browser context. Use this to: 1. Generate audio using Web Audio API. 2. Manipulate the DOM/UI. 3. Perform complex calculations. 4. 'Upgrade' the app by injecting new behavior. access 'appController' to modify state. If the code fails, you will receive the error message; use it to debug and correct your code.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                code: {
                    type: Type.STRING,
                    description: "The JavaScript code to execute. It has access to 'appController', 'window', and 'document'. Return a string result if needed.",
                },
            },
            required: ['code'],
        },
    },
    // TTS
    {
        name: 'speak',
        description: "Synthesizes speech from text using a high-quality AI voice. Use this to talk to the user, announce events, or just be 'Villain'.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                text: { type: Type.STRING, description: "The text to speak." },
                voiceName: { type: Type.STRING, enum: ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'], description: "The voice persona to use. Defaults to 'Puck' (Villain's default)." }
            },
            required: ['text']
        }
    },
    // Drum Machine Tool
    {
        name: 'configureDrumPad',
        description: 'Configures a specific pad on the Drum Machine with a new sound, label, or color. Use this to program the drum machine.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                padId: { type: Type.NUMBER, description: 'The ID of the pad to configure (0-15).' },
                label: { type: Type.STRING, description: 'A short label for the pad (e.g., "Kick", "Snare", "Laser").' },
                soundType: { type: Type.STRING, enum: ['kick', 'snare', 'hihat', 'bass', 'fx', 'synth'], description: 'The type of sound to synthesize.' },
                baseFrequency: { type: Type.NUMBER, description: 'The base frequency in Hz.' },
                waveform: { type: Type.STRING, enum: ['sine', 'square', 'sawtooth', 'triangle'], description: 'The oscillator waveform.' },
                color: { type: Type.STRING, description: 'Tailwind CSS background color class (e.g., "bg-red-500", "bg-blue-600").' },
                pitchDecay: { type: Type.NUMBER, description: 'Pitch decay time in seconds.' },
                volumeDecay: { type: Type.NUMBER, description: 'Volume decay time in seconds.' },
                noise: { type: Type.BOOLEAN, description: 'Whether to mix in noise.' },
                distortion: { type: Type.BOOLEAN, description: 'Whether to add distortion.' }
            },
            required: ['padId']
        }
    }
];
