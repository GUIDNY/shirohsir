import { createSongVersion, uploadAudioReference } from "@/lib/song-generation";
import type { MusicGenerationProvider } from "./types";

// Thin adapter over the existing ElevenLabs functions in
// song-generation.ts — see types.ts for why this seam exists. Nothing
// about ElevenLabs' actual request/response handling lives here; that
// stays in song-generation.ts so this file doesn't duplicate it.
export const elevenLabsProvider: MusicGenerationProvider = {
  id: "elevenlabs",

  supportsAudioReference: () => true,

  // ElevenLabs Music v2's Audio Reference influences sound/production/
  // tempo/mood only — it does not copy or replay the reference audio
  // into the output, so this is intentionally false.
  supportsMelodyPreservation: () => false,

  uploadAudioReference: (fileBytes, contentType, fileName) => uploadAudioReference(fileBytes, contentType, fileName),

  generateSong: (order, songSeconds, versionLabel) => createSongVersion(order, songSeconds, versionLabel),
};
