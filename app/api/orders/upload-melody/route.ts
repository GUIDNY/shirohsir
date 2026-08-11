import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { elevenLabsProvider } from "@/lib/music-providers/elevenlabs-provider";
import { AudioReferenceUploadError } from "@/lib/song-generation";

// Generous enough for ~30-60s of even uncompressed audio, small enough
// to bound abuse of the (paid, per-call) ElevenLabs upload endpoint.
const MAX_MELODY_BYTES = 20 * 1024 * 1024;

// Pre-flight step, separate from order submission — runs before any
// credits are spent, so a customer finds out about an unsupported file
// or a provider-side problem for free, not after paying. Never touches
// Supabase storage: the file is forwarded to ElevenLabs (the only place
// it's actually stored, by song_id) and dropped from memory here after.
export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "צריך להתחבר לפני העלאת מנגינה" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "חסר קובץ אודיו" }, { status: 400 });
  }

  if (!file.type.startsWith("audio/")) {
    return NextResponse.json({ error: "יש להעלות קובץ אודיו (MP3, WAV, M4A או הקלטה מהדפדפן)" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "קובץ האודיו ריק" }, { status: 400 });
  }

  if (file.size > MAX_MELODY_BYTES) {
    return NextResponse.json({ error: "קובץ האודיו גדול מדי (מקסימום 20MB)" }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const { songId } = await elevenLabsProvider.uploadAudioReference(bytes, file.type, file.name || "melody");

    return NextResponse.json({ songId });
  } catch (error) {
    if (error instanceof AudioReferenceUploadError) {
      console.error(`[MELODY_UPLOAD_FAILED] status=${error.providerStatus} message=${error.providerMessage}`);

      return NextResponse.json({ error: "לא הצלחנו להעלות את המנגינה כרגע — אפשר לנסות שוב." }, { status: 502 });
    }

    console.error("[MELODY_UPLOAD_FAILED] unexpected", error instanceof Error ? error.message : error);

    return NextResponse.json({ error: "שגיאה בהעלאת המנגינה" }, { status: 500 });
  }
}
