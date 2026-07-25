import { NextResponse } from "next/server";
import { getAppUserId } from "@/lib/session";
import { parseUserText, suggestVenues, buildExperiencePackage } from "@/lib/llm";
import { getWeather } from "@/lib/services/weather";

export async function POST(request: Request) {
  const userId = await getAppUserId(request.headers);
  if (!userId) {
    return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  try {
    let body: { text?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
    }

    const text = (body.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "Metin gerekli." }, { status: 400 });
    }

    const now = new Date();
    // 1. Kullanıcı metnini ayrıştır (Kadıköy, pizza vb. detaylar buradan çıkarılır)
    const parsed = await parseUserText(text, now);

    // 2. Hava durumunu al
    const weather = await getWeather(parsed);

    // 3. Gerçek mekan önerilerini oluştur (Pizzacı, kafe vb. istekler buraya işlenir)
    const venues = await suggestVenues(parsed, weather);

    // 4. Deneyim paketini (rotayı) oluştur
    const experience = await buildExperiencePackage(parsed, weather, venues, null);

    // İstediğin özel içeriği ve mekanları arayüze tam olarak iletiyoruz
    return NextResponse.json({
      ok: true,
      query_id: 1,
      parsed,
      weather,
      venues,
      experience,
    });
  } catch (err: any) {
    console.error("Öneri motoru hatası:", err);
    return NextResponse.json(
      { error: err?.message || "Öneri üretilirken bir hata oluştu." },
      { status: 500 }
    );
  }
}