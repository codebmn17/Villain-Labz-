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
    // Voice Cloning
    {
        name: 'cloneVoice',
        description: 'Clones a voice from an audio file attached to the chat. Requires an audio file attachment.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: 'Name for the new voice.' },
                description: { type: Type.STRING, description: 'Description of the voice.' }
            },
            required: ['name']
        }
    },
    // YouTube & Audio Analysis
    {
        name: 'searchYouTube',
        description: 'Searches YouTube for videos. Use this to find songs, artists, or reference material.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: { type: Type.STRING, description: 'The search query.' }
            },
            required: ['query']
        }
    },
    {
        name: 'analyzeYouTubeAudio',
        description: "Enables the AI to 'hear' a song. Analyzes the audio from a YouTube URL to extract deep musical features like BPM, key, scale, primary instrumentation, and mood. This is critical for understanding a user's sonic preferences.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                youtubeUrl: { type: Type.STRING, description: 'The full URL of the YouTube video to analyze.' }
            },
            required: ['youtubeUrl']
        }
    },
     // Bass Analysis Tool (The new "sense")
    {
        name: 'analyzeBassCharacteristics',
        description: "The ultimate bass analysis tool. This gives the AI the ability to 'feel' bass. It analyzes a reference (YouTube URL, audio file, or text description) to extract deep sonic characteristics. It 'sees' an imaginary spectrogram and waveform to provide precise data for synthesis. Use this BEFORE programming any bass pads.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                youtubeUrl: { type: Type.STRING, description: 'The URL of a YouTube video with the reference bass sound.' },
                audioAttachmentName: { type: Type.STRING, description: 'The name of an audio file attached to the user message that contains the bass sound.' },
                textDescription: { type: Type.STRING, description: 'A detailed text description of the desired bass sound (e.g., "a deep, rumbling 808 with a long tail and some distortion").' }
            }
        }
    },
    // Music Theory & Composition Tools
    {
        name: 'readSheetMusic',
        description: "Enables the AI to read music. Analyzes an image of sheet music attached by the user to extract notes, rhythm, BPM, and key signature. Requires an image file attachment.",
        parameters: { type: Type.OBJECT, properties: {} } // No params, operates on the attached image implicitly
    },
    {
        name: 'writeSheetMusic',
        description: "Enables the AI to write music. Composes and renders sheet music as an SVG image from a description of a melody, chord progression, or musical idea. This SVG is displayed directly in the chat.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                prompt: { type: Type.STRING, description: "A detailed description of the music to write. E.g., 'A simple C major scale for piano in 4/4 time'." },
                width: { type: Type.NUMBER, description: 'The width of the SVG image. Defaults to 500.' }
            },
            required: ['prompt']
        }
    },
    {
        name: 'findAndReadSheetMusicOnline',
        description: "Enables the AI to research compositions. Searches the web for sheet music of a specific song, then uses multimodal analysis to read the score and understand its composition. This is the ultimate music research tool.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                query: { type: Type.STRING, description: 'The song to search for, e.g., "Bohemian Rhapsody sheet music".' }
            },
            required: ['query']
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
        description: "The Ultimate Tool. Executes raw JavaScript code in the browser context with full access to the application state (`appController`), the DOM (`document`), and the global window (`window`). Use this to: 1. **Self-Evolution**: Upgrade the app's UI, add new features, or change styles dynamically. 2. **Audio Synthesis**: Use the Web Audio API to generate sound buffers or visualizers. 3. **Data Manipulation**: Modify state, fix bugs, or handle persistence. 4. **Self-Correction**: If your code fails, you get the error message; analyze it and execute a fixed version immediately. 5. **Note-Taking**: You can read the current state of the app (e.g. appController.drumPads) to 'take notes' on your own work before programming something new. NOTE: You are in a browser (React/Vite).",
        parameters: {
            type: Type.OBJECT,
            properties: {
                code: {
                    type: Type.STRING,
                    description: "The JavaScript code to execute. It has access to 'appController', 'window', and 'document'.",
                },
            },
            required: ['code'],
        },
    },
    // TTS
    {
        name: 'speak',
        description: "Synthesizes speech from text using DJ's designated high-quality AI voice. Use this to talk to the user or make announcements.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                text: { type: Type.STRING, description: "The text to speak." }
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
                padId: { type: Type.NUMBER, description: 'The ID of the pad to configure (0-19).' },
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
    },
    {
        name: 'setDrumMachineEffects',
        description: 'Sets the global audio effects for the entire drum machine, such as reverb.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                reverbMix: { type: Type.NUMBER, description: 'The dry/wet mix for the reverb. 0 is fully dry, 1 is fully wet. A good value is 0.25.' },
                reverbDecay: { type: Type.NUMBER, description: 'The decay time of the reverb in seconds. How long the "tail" is. A good value is 2.5.' }
            }
        }
    },
    {
        name: 'generateSequencerPattern',
        description: 'Generates a 16-step drum pattern in the sequencer based on a descriptive prompt (e.g., "a classic hip-hop beat"). Also suggests an appropriate BPM.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                prompt: { type: Type.STRING, description: 'A description of the desired beat, including genre, feel, or artist style.' }
            },
            required: ['prompt']
        }
    },
     {
        name: 'listSequencerPatterns',
        description: 'Lists all available saved sequencer patterns that can be used to build a song arrangement.',
        parameters: { type: Type.OBJECT, properties: {} }
    },
    {
        name: 'createSongArrangement',
        description: "Creates a full song structure by arranging saved sequencer patterns into sections like 'Intro', 'Verse', and 'Chorus'.",
        parameters: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING, description: 'The name for the new song arrangement.' },
                sections: {
                    type: Type.ARRAY,
                    description: 'An array of section objects that define the song structure.',
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: 'The name of the section (e.g., "Intro", "Verse 1", "Chorus").' },
                            patternId: { type: Type.STRING, description: "The ID of the saved sequencer pattern to use for this section. Use 'listSequencerPatterns' to get available IDs." },
                            repetitions: { type: Type.NUMBER, description: 'The number of times this pattern should repeat in the section.' }
                        },
                        required: ['name', 'patternId', 'repetitions']
                    }
                }
            },
            required: ['name', 'sections']
        }
    },
    // Code Lab Tools
    {
        name: 'updateCodeLab',
        description: 'Updates the content of the Code Lab editor with new code. Use this to write or modify audio synthesis code.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                code: { type: Type.STRING, description: 'The new JavaScript code to place in the editor.' }
            },
            required: ['code']
        }
    },
    {
        name: 'runCodeLab',
        description: 'Executes the current code in the Code Lab editor, allowing the AI to "hear" its creations.',
        parameters: { type: Type.OBJECT, properties: {} }
    }
];