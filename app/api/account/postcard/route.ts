import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth-user";
import { createServerClient } from "@/lib/supabase-server";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "לא מחובר/ת" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const orderId = formData?.get("orderId");
  const photo = formData?.get("photo");

  if (typeof orderId !== "string" || !(photo instanceof File)) {
    return NextResponse.json({ error: "חסרים פרטים" }, { status: 400 });
  }

  if (!photo.type.startsWith("image/")) {
    return NextResponse.json({ error: "יש להעלות קובץ תמונה" }, { status: 400 });
  }

  if (photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "התמונה גדולה מדי (מקסימום 8MB)" }, { status: 400 });
  }

  const supabase = createServerClient();

  // Ownership check — only the order's own creator can attach a photo to it.
  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, share_token, audio_url")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "הזמנה לא נמצאה" }, { status: 404 });
  }

  if (!order.audio_url) {
    return NextResponse.json({ error: "אין עדיין קובץ שיר להזמנה הזו" }, { status: 400 });
  }

  const extension = photo.type.split("/")[1] || "jpg";
  const path = `${user.id}/${orderId}.${extension}`;
  const bytes = new Uint8Array(await photo.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("postcard-photos")
    .upload(path, bytes, { contentType: photo.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: "שגיאה בהעלאת התמונה" }, { status: 500 });
  }

  const { data: publicUrlData } = supabase.storage.from("postcard-photos").getPublicUrl(path);
  const shareToken = order.share_token || randomUUID();

  const { error: updateError } = await supabase
    .from("orders")
    .update({ photo_url: publicUrlData.publicUrl, share_token: shareToken })
    .eq("id", orderId);

  if (updateError) {
    return NextResponse.json({ error: "שגיאה בשמירת הגלויה" }, { status: 500 });
  }

  return NextResponse.json({ shareToken, photoUrl: publicUrlData.publicUrl });
}
