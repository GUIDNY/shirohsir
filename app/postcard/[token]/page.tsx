import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import { MusicNote } from "../../icons";

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

const songTypeLabels: Record<string, string> = {
  gift: "שיר מתנה",
  business: "שיר לעסק",
  graduation: "מסיבת סיום",
};

async function getPostcard(token: string) {
  const supabase = createServerClient();
  const { data: order } = await supabase
    .from("orders")
    .select("recipient, occasion, song_type, prompt_preview, audio_url, photo_url, created_at")
    .eq("share_token", token)
    .maybeSingle();

  if (!order || !order.audio_url) {
    return null;
  }

  const { data: signed } = await supabase.storage
    .from("songs")
    .createSignedUrl(order.audio_url, SIGNED_URL_TTL_SECONDS);

  return { ...order, audioSignedUrl: signed?.signedUrl ?? null };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const postcard = await getPostcard(token);

  if (!postcard) {
    return { title: "גלויה לא נמצאה" };
  }

  const title = `שיר בשביל ${postcard.recipient} | מנגינה אישית`;
  const description = `גלויה מוזיקלית ל${postcard.recipient} — ${postcard.occasion}`;
  const url = `/postcard/${token}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      images: postcard.photo_url ? [{ url: postcard.photo_url }] : [{ url: "/og.png" }],
    },
  };
}

export default async function PostcardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const postcard = await getPostcard(token);

  if (!postcard) {
    notFound();
  }

  return (
    <main className="postcard-page" dir="rtl">
      <div className="postcard-card">
        {postcard.photo_url && (
          <div className="postcard-photo">
            <Image alt={`תמונה של ${postcard.recipient}`} fill sizes="(max-width: 640px) 100vw, 560px" src={postcard.photo_url} />
          </div>
        )}

        <div className="postcard-body">
          <span className="postcard-eyebrow">
            <MusicNote size={14} />
            {songTypeLabels[postcard.song_type] || postcard.song_type}
          </span>
          <h1>שיר בשביל {postcard.recipient}</h1>
          <p className="postcard-occasion">{postcard.occasion}</p>

          {postcard.audioSignedUrl ? (
            <audio controls src={postcard.audioSignedUrl} className="postcard-audio">
              הדפדפן שלך לא תומך בנגן אודיו.
            </audio>
          ) : (
            <p className="postcard-missing-audio">קובץ השיר לא זמין כרגע.</p>
          )}

          <p className="postcard-lyrics">{postcard.prompt_preview}</p>
        </div>
      </div>

      <Link className="postcard-cta" href="/">
        רוצים ליצור שיר כזה גם לכם? מנגינה אישית
      </Link>
    </main>
  );
}
