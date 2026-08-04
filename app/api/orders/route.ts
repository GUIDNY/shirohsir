import { NextRequest, NextResponse } from "next/server";

type OrderPayload = {
  songType?: string;
  recipient?: string;
  occasion?: string;
  style?: string;
  mood?: string;
  vocalist?: string;
  story?: string;
  mustInclude?: string;
  avoid?: string;
  customerName?: string;
  email?: string;
  phone?: string;
  consent?: boolean;
};

const requiredFields: Array<keyof OrderPayload> = [
  "recipient",
  "occasion",
  "style",
  "mood",
  "vocalist",
  "story",
  "customerName",
  "email",
  "phone",
];

function text(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 1200) : "";
}

function buildMusicPrompt(order: OrderPayload) {
  const lines = [
    "Create an original Hebrew song for a paying customer.",
    `Song type: ${text(order.songType)}`,
    `Subject: ${text(order.recipient)}`,
    `Occasion or campaign goal: ${text(order.occasion)}`,
    `Music style: ${text(order.style)}`,
    `Mood: ${text(order.mood)}`,
    `Vocal direction: ${text(order.vocalist)}`,
    `Customer story: ${text(order.story)}`,
    `Must include: ${text(order.mustInclude) || "none"}`,
    `Avoid: ${text(order.avoid) || "none"}`,
    "Important: write original lyrics only. Do not imitate a named artist, existing song, protected voice, melody, or copyrighted lyrics.",
  ];

  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  const order = (await request.json()) as OrderPayload;
  const missing = requiredFields.filter((field) => !text(order[field]));

  if (missing.length > 0 || order.consent !== true) {
    return NextResponse.json(
      { error: "Missing required fields or rights confirmation", missing },
      { status: 400 },
    );
  }

  const prompt = buildMusicPrompt(order);
  const apiUrl = process.env.SUNO_API_URL;
  const apiKey = process.env.SUNO_API_KEY;
  const providerName = process.env.MUSIC_PROVIDER_NAME || "demo-adapter";

  if (!apiUrl || !apiKey) {
    return NextResponse.json({
      orderId: `demo_${Date.now()}`,
      provider: providerName,
      status: "queued_without_external_api",
      mode: "demo",
      promptPreview: prompt.slice(0, 420),
    });
  }

  const providerResponse = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      metadata: {
        source: "personal-song-order-site",
        customerName: text(order.customerName),
        email: text(order.email),
        phone: text(order.phone),
      },
    }),
  });

  if (!providerResponse.ok) {
    return NextResponse.json(
      { error: "Music provider request failed", providerStatus: providerResponse.status },
      { status: 502 },
    );
  }

  const providerData = await providerResponse.json();

  return NextResponse.json({
    orderId: providerData.id || providerData.taskId || `live_${Date.now()}`,
    provider: providerName,
    status: providerData.status || "submitted",
    mode: "live",
    promptPreview: prompt.slice(0, 420),
  });
}
