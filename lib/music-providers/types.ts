import type { GeneratedVersion, OrderContent } from "@/lib/song-generation";

// Provider-agnostic seam so a future provider (e.g. Suno, for a
// stronger melody-preserving workflow) can be added without touching
// the order/revise/extra-version routes that call generateSong() —
// they only need a MusicGenerationProvider, not ElevenLabs specifics.
export interface MusicGenerationProvider {
  readonly id: string;

  // Whether this provider can steer generation using an uploaded audio
  // reference at all (ElevenLabs Music v2: yes, as style/production
  // guidance).
  supportsAudioReference(): boolean;

  // Whether the provider can preserve/reproduce a reference melody
  // rather than just being generally influenced by it. ElevenLabs
  // explicitly does not — a future Suno-based provider might.
  supportsMelodyPreservation(): boolean;

  uploadAudioReference(fileBytes: Buffer, contentType: string, fileName: string): Promise<{ songId: string }>;

  generateSong(order: OrderContent, songSeconds: number, versionLabel: string): Promise<GeneratedVersion>;
}
