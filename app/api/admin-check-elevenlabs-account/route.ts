import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { isAdminUser } from "@/lib/is-admin";
import { elevenLabsApiKey } from "@/lib/song-generation";

// TEMPORARY diagnostic route — checks which ElevenLabs account/workspace
// the production ELEVENLABS_API_KEY actually belongs to, since the API
// keeps returning a payment_issue error even after the user paid an
// invoice in the browser. Admin-only. Delete after diagnosis.
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user || !isAdminUser(user)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const apiKey = elevenLabsApiKey();

  if (!apiKey) {
    return NextResponse.json({ error: "missing_elevenlabs_api_key" }, { status: 500 });
  }

  const userResponse = await fetch("https://api.elevenlabs.io/v1/user", {
    headers: { "xi-api-key": apiKey },
  });
  const userBody = await userResponse.text();

  const subResponse = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
    headers: { "xi-api-key": apiKey },
  });
  const subBody = await subResponse.text();

  return NextResponse.json({
    keyLastChars: apiKey.slice(-6),
    keyLength: apiKey.length,
    userStatus: userResponse.status,
    user: safeJson(userBody),
    subscriptionStatus: subResponse.status,
    subscription: safeJson(subBody),
  });
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 1000);
  }
}
