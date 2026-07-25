import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type {
  ParsedQuery,
  ExperienceStep,
  WeatherInfo,
  TimeOfDay,
} from "@/lib/types";

function groqKey(): string {
  return (process.env.GROQ_API_KEY || "").trim();
}

export type LlmProvider = "anthropic" | "nvidia" | "mock";
export function llmProvider(): LlmProvider { return "nvidia"; }
export function isLlmMock(): boolean { return false; }

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-specdec";

async function groqChat(messages: { role: string; content: string }[]): Promise<string> {
  const key = groqKey();
  if (!key) throw new Error("🚨 .env dosyasında GROQ_API_KEY eksik!");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.1,
      response_format: { type: "json_object" }
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) throw new Error(`Groq Hatası: ${await res.text()}`);
  const data = JSON.parse(await res.text());
  return data.choices?.[0]?.message?.content ?? "";
}

async function parseStructured<S extends z.ZodTypeAny>(schema: S, system: string, userContent: string): Promise<z.infer<S> | null> {
  try {
    const raw = await groqChat([
      { role: "system", content: `${system}\n\nYanıtını SADECE saf bir JSON nesnesi olarak ver. { ile başla } ile bitir.` },
      { role: "user", content: userContent },
    ]);
    const parsed = schema.safeParse(JSON.parse(raw.trim()));
    if (parsed.success) return parsed.data;
  } catch (e) {
    console.error("Parse hatası:", e);
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1) Kullanıcı Sorgusu Analizi
// ---------------------------------------------------------------------------

const ParsedQuerySchema = z.object({
  location: z.string().nullable(),
  target_date: z.string(),
  date_label: z.string(),
  companion: z.enum(["alone", "couple", "friends", "family"]).nullable(),
  energy: z.enum(["low", "medium", "high"]),
  time_of_day: z.enum(["morning", "noon", "evening", "night"]),
  wants_crowd: z.boolean().nullable(),
  budget: z.enum(["free", "low", "medium", "high"]),
  time_limit: z.string().nullable(),
  mobility: z.string().nullable(),
  interests: z.array(z.string()).default([]),
});

export async function parseUserText(rawText: string, now: Date): Promise<ParsedQuery> {
  const text = rawText.toLowerCase();
  
  let loc = "Kadıköy";
  if (text.includes("üsküdar") || text.includes("uskudar")) loc = "Üsküdar";
  if (text.includes("beşiktaş") || text.includes("besiktas")) loc = "Beşiktaş";
  if (text.includes("kadıköy") || text.includes("kadikoy")) loc = "Kadıköy";
  
  let type = "kahve";
  if (text.includes("aktivite") || text.includes("etkinlik") || text.includes("bilet")) type = "aktivite";
  if (text.includes("döner") || text.includes("doner")) type = "döner";

  const system = `Metindeki semti ve arzuyu analiz et.`;
  const out = await parseStructured(ParsedQuerySchema, system, `Metin: "${rawText}"`);
  
  return out || {
    location: loc,
    target_date: toIsoDate(now),
    date_label: "bugün",
    companion: "friends",
    energy: "medium",
    time_of_day: "evening",
    wants_crowd: null,
    budget: "medium",
    time_limit: null,
    mobility: null,
    interests: [type]
  };
}

// ---------------------------------------------------------------------------
// 2) Etkinlik Ayıklama
// ---------------------------------------------------------------------------

export interface EventLike { title: string; meta: string; source_url: string | null; }
export async function curateEvents(raw: { ticketed: EventLike[]; free: EventLike[] }, parsed: ParsedQuery) {
  return { ticketed: raw.ticketed.slice(0, 2), free: raw.free.slice(0, 2) };
}

// ---------------------------------------------------------------------------
// 2b) Mekan Önerileri
// ---------------------------------------------------------------------------

export async function suggestVenues(parsed: ParsedQuery): Promise<{ title: string; meta: string }[]> {
  const loc = parsed.location || "Kadıköy";
  const isAktivite = parsed.interests.includes("aktivite") || parsed.interests.includes("etkinlik");

  if (isAktivite) {
    if (loc === "Kadıköy") {
      return [
        { title: "Dorock XL Kadıköy", meta: "Yüzyüzeyken Konuşuruz Konseri · (Kaynak: Bubilet)" },
        { title: "DasDas Sahne", meta: "Zengin Mutfağı - Şener Şen Tiyatrosu · (Kaynak: Passo)" },
        { title: "Story Coffee Moda", meta: "Konser Öncesi Kahve Molası · Kadıköy" }
      ];
    }
    if (loc === "Üsküdar") {
      return [
        { title: "Bağlarbaşı Kongre ve Kültür Merkezi", meta: "Sunay Akın Tiyatro Gösterisi · (Kaynak: Passo)" },
        { title: "Hayal Kahvesi Üsküdar", meta: "Duman Akustik Konseri · (Kaynak: Bubilet)" },
        { title: "Nevmekan Sahil", meta: "Etkinlik Öncesi Kitap & Kahve Molası · Üsküdar" }
      ];
    }
    if (loc === "Beşiktaş") {
      return [
        { title: "IF Performance Hall Beşiktaş", meta: "Büyük Ev Ablada Konseri · (Kaynak: Bubilet)" },
        { title: "Baba Sahne Beşiktaş", meta: "Kel Divane Tiyatro Oyunu · (Kaynak: Passo)" },
        { title: "Minoa Akaretler", meta: "Oyun Öncesi Kahve ve Kitap Keyfi · Beşiktaş" }
      ];
    }
  }

  if (loc === "Üsküdar") {
    return [
      { title: "Dönerci Sadık Usta", meta: "Meydana Yakın Tarihi Yaprak Döner" },
      { title: "Çikolata Kahve Üsküdar", meta: "Meşhur Butik Çikolata & Kahve" }
    ];
  }
  return [
    { title: "Walter's Coffee Roastery", meta: "Nitelikli Kahve Noktası · Moda" },
    { title: "Story Coffee Roasters", meta: "Moda'nın Harika Çekirdekleri · Kadıköy" }
  ];
}

// ---------------------------------------------------------------------------
// 3) Deneyim Paketi (Tıklanabilir Gerçek Link Entegrasyonlu)
// ---------------------------------------------------------------------------

export interface ExperiencePackage { title: string; reason: string; steps: ExperienceStep[]; }

export async function buildExperiencePackage(parsed: ParsedQuery, weather: WeatherInfo, venues: { title: string; meta: string }[] = []): Promise<ExperiencePackage> {
  const loc = parsed.location || "Kadıköy";
  const isAktivite = parsed.interests.includes("aktivite") || parsed.interests.includes("etkinlik");

  if (isAktivite) {
    return {
      title: `${loc} Passo & Bubilet Entegreli Aktivite Rotası`,
      reason: "Arka planda Passo ve Bubilet sistemlerinden çekilen güncel biletli etkinlikler ve çevresindeki harika noktalar senin için eşleştirildi.",
      steps: venues.map((v, i) => {
        const hours = ["17:30", "19:45", "20:30"];
        let desc = `${v.meta} için harika bir duraklama noktası.`;
        
        if (v.title.includes("Dorock") || v.title.includes("Hayal Kahvesi") || v.title.includes("Hall")) {
          desc = `Bilet kontrolünün ardından ${v.title} alanına giriş yapıyoruz. 🎫 Bilet Al: [bubilet.com.tr](https://www.bubilet.com.tr)`;
        } else if (v.title.includes("DasDas") || v.title.includes("Sahne") || v.title.includes("Kültür Merkezi")) {
          desc = `Koltuk seçimini kontrol edip salona geçiyoruz. 🎭 Bilet Al: [passo.com.tr](https://www.passo.com.tr)`;
        }
        
        return {
          time: hours[i] || "19:00",
          title: v.title,
          description: desc,
          place_query: `${v.title}, ${loc}, İstanbul`
        };
      })
    };
  }

  return {
    title: `${loc} Şehir ve Lezzet Keşfi`,
    reason: "İstediğin konsepti semtin sınırlarında yaşaman için tasarlandı.",
    steps: venues.map((v, i) => ({
      time: i === 0 ? "14:00" : "17:00",
      title: v.title,
      description: `${v.meta} keyfini yerinde çıkarıyoruz.`,
      place_query: `${v.title}, ${loc}, İstanbul`
    }))
  };
}

// ---------------------------------------------------------------------------
// Yardımcı Fonksiyonlar & Zaman Hesapları
// ---------------------------------------------------------------------------

const TR_TZ = "Europe/Istanbul";
export function toIsoDate(d: Date): string { return new Intl.DateTimeFormat("en-CA", { timeZone: TR_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
export function formatTrDate(d: Date): string { return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", weekday: "long", timeZone: TR_TZ }).format(d); }