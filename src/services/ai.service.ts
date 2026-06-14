import { GoogleGenAI } from "@google/genai";

/**
 * Gemini tabanlı AI servisi. GEMINI_API_KEY tanımlı değilse tamamen no-op
 * çalışır — çağıran taraf statik fallback'e döner.
 */
const apiKey = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

export const aiEnabled = Boolean(apiKey);

const ai = aiEnabled ? new GoogleGenAI({ apiKey }) : null;

// gemini-2.5+ "thinking" modelleri varsayılan olarak düşünme token'ı harcar;
// kısa maxOutputTokens ile bu, çıktıyı boş/yarım bırakır (finishReason=MAX_TOKENS).
// Bu basit üretim görevlerinde düşünmeyi kapatıyoruz. 2.0-flash gibi modellerde
// thinkingConfig gönderilmez (gereksiz/uyumsuz olmasın diye).
const isThinkingModel = /2\.5|2\.6|thinking|gemini-3|gemini-flash-latest/i.test(MODEL);
const THINKING_OFF: Record<string, any> = isThinkingModel
  ? { thinkingConfig: { thinkingBudget: 0 } }
  : {};

const PRAYER_TR: Record<string, string> = {
  fajr: "sabah",
  dhuhr: "öğle",
  asr: "ikindi",
  maghrib: "akşam",
  isha: "yatsı",
};

type RunOpts = {
  temperature?: number;
  maxOutputTokens?: number;
  json?: boolean; // çıktıyı geçerli JSON'a zorla
};

/** Düşük seviye tek atımlık üretim. AI kapalı/başarısızsa null döner. */
async function run(prompt: string, opts: RunOpts = {}): Promise<string | null> {
  if (!ai) return null;
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: opts.temperature ?? 0.8,
        maxOutputTokens: opts.maxOutputTokens ?? 512,
        ...THINKING_OFF,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    });
    const text = response.text?.trim();
    return text && text.length > 0 ? text : null;
  } catch (err) {
    console.error("AI error:", err);
    return null;
  }
}

/** Modelin döndürdüğü metinden JSON'u çıkarır (```json fence'leri temizler). */
function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

const SYSTEM_PERSONA =
  "Sen bir Müslüman ibadet takip uygulamasındaki nazik, teşvik edici bir Türkçe asistansın. " +
  "Samimi ve pozitif ol, asla suçlayıcı olma, abartılı dini hüküm verme, emoji kullanma.";

// ─────────────────────────────────────────────────────────────────────────
// 1) Günün motivasyonu
// ─────────────────────────────────────────────────────────────────────────

export interface MotivationContext {
  currentStreak: number;
  highestStreak: number;
  totalPoints: number;
  level?: { name?: string } | null;
  todayPrayerCount: number;
  mostMissedPrayer?: string | null;
}

export async function generateMotivation(
  ctx: MotivationContext
): Promise<string | null> {
  const missedTr = ctx.mostMissedPrayer
    ? PRAYER_TR[ctx.mostMissedPrayer] ?? ctx.mostMissedPrayer
    : null;

  const prompt = `${SYSTEM_PERSONA}
Kullanıcıya bugün için TEK bir kısa motivasyon mesajı yaz (en fazla 2 cümle, 200 karakter).

Kullanıcı verisi:
- Güncel namaz serisi: ${ctx.currentStreak} gün
- En uzun seri: ${ctx.highestStreak} gün
- Bugün kılınan vakit: ${ctx.todayPrayerCount}/5
- Toplam puan: ${ctx.totalPoints}${ctx.level?.name ? `\n- Seviye: ${ctx.level.name}` : ""}${
    missedTr ? `\n- Son 7 günde en çok kaçırılan vakit: ${missedTr} namazı` : ""
  }

Sadece mesajı döndür, başka açıklama ekleme.`;

  return run(prompt, { temperature: 0.9, maxOutputTokens: 120 });
}

// ─────────────────────────────────────────────────────────────────────────
// 2) Haftalık istatistik içgörüsü
// ─────────────────────────────────────────────────────────────────────────

export interface InsightContext {
  currentStreak: number;
  weeklyPrayerCounts: number[]; // son 7 günün günlük vakit sayıları
  byPrayerTime: { prayer_time: string; total: number }[];
}

export async function generateStatsInsight(
  ctx: InsightContext
): Promise<string | null> {
  const byTime = ctx.byPrayerTime
    .map((p) => `${PRAYER_TR[p.prayer_time] ?? p.prayer_time}: ${p.total}/7`)
    .join(", ");

  const prompt = `${SYSTEM_PERSONA}
Kullanıcının son 7 günlük namaz verisini analiz et ve 2-3 cümlelik kişisel bir içgörü + somut bir öneri yaz.
Eğer belirli bir vakit sık kaçırılıyorsa onu nazikçe belirt ve pratik bir tavsiye ver (örn. o vakte hatırlatma kurmak).

Veri:
- Güncel seri: ${ctx.currentStreak} gün
- Son 7 günde günlük kılınan vakit sayıları: [${ctx.weeklyPrayerCounts.join(", ")}]
- Vakit bazında 7 günde kılınan: ${byTime || "veri yok"}

Sadece içgörü metnini döndür.`;

  return run(prompt, { temperature: 0.7, maxOutputTokens: 200 });
}

// ─────────────────────────────────────────────────────────────────────────
// 3) Kişisel hedef önerisi
// ─────────────────────────────────────────────────────────────────────────

export interface GoalSuggestionContext {
  currentStreak: number;
  totalPoints: number;
  levelName?: string | null;
  currentGoals: { activity_type: string; target: number; enabled: boolean }[];
}

export interface GoalSuggestion {
  activity_type: string;
  target: number;
  reason: string;
}

// Model bazen kanonik enum yerine Türkçe/İngilizce etiket döndürür
// ("Kuran", "Zikir"...). Bunları geçerli activity_type'a normalize ediyoruz.
const ACTIVITY_ALIASES: Record<string, string> = {
  quran: "quran",
  kuran: "quran",
  "kur'an": "quran",
  dhikr: "dhikr",
  zikir: "dhikr",
  zikr: "dhikr",
  nafile: "nafile",
  "nafile namaz": "nafile",
  sunnah: "nafile",
  fasting: "fasting",
  oruc: "fasting",
  oruç: "fasting",
  dua: "dua",
  "dua/zikir": "dua",
  memorization: "memorization",
  ezber: "memorization",
  hifz: "memorization",
  hıfz: "memorization",
};

function normalizeActivity(raw: string): string | null {
  const key = String(raw ?? "").trim().toLowerCase();
  return ACTIVITY_ALIASES[key] ?? null;
}

export async function generateGoalSuggestions(
  ctx: GoalSuggestionContext
): Promise<GoalSuggestion[] | null> {
  const goalsStr =
    ctx.currentGoals.length > 0
      ? ctx.currentGoals
          .map(
            (g) =>
              `${g.activity_type}: hedef ${g.target} (${g.enabled ? "aktif" : "kapalı"})`
          )
          .join(", ")
      : "henüz hedef yok";

  const prompt = `${SYSTEM_PERSONA}
Kullanıcı için gerçekçi, ulaşılabilir GÜNLÜK ibadet hedefleri öner. Mevcut seviyesine göre kademeli ilerlet (çok agresif olma).

"activity_type" alanı MUTLAKA şu İngilizce, küçük harf değerlerden biri olmalı — başka değer (örn. "namaz", "şükür", "Kuran") KULLANMA:
quran (sayfa/gün), dhikr (adet/gün), nafile (rekat/gün), fasting (gün/hafta), dua (dakika/gün), memorization (ayet/gün).

Kullanıcı durumu:
- Güncel seri: ${ctx.currentStreak} gün
- Toplam puan: ${ctx.totalPoints}${ctx.levelName ? `\n- Seviye: ${ctx.levelName}` : ""}
- Mevcut hedefler: ${goalsStr}

En fazla 4 öneri ver. SADECE şu formatta geçerli JSON dizisi döndür, başka hiçbir şey yazma:
[{"activity_type":"quran","target":10,"reason":"kısa Türkçe gerekçe"}]`;

  const result = parseJson<any[]>(
    await run(prompt, { temperature: 0.6, maxOutputTokens: 800, json: true })
  );
  if (!Array.isArray(result)) return null;

  // Normalize et, doğrula, temizle. Geçersiz activity_type'lar elenmek yerine
  // mümkünse kanonik değere eşlenir (Kuran→quran, Zikir→dhikr ...).
  const seen = new Set<string>();
  return result
    .map((s) => {
      const activity = normalizeActivity(s?.activity_type);
      const target = Math.round(Number(s?.target));
      if (!activity || !Number.isFinite(target) || target <= 0) return null;
      return {
        activity_type: activity,
        target,
        reason: String(s?.reason ?? "").slice(0, 200),
      } as GoalSuggestion;
    })
    .filter((s): s is GoalSuggestion => {
      if (!s) return false;
      if (seen.has(s.activity_type)) return false; // tekrar eden aktiviteyi at
      seen.add(s.activity_type);
      return true;
    })
    .slice(0, 4);
}

// ─────────────────────────────────────────────────────────────────────────
// 4) Yıllık özet anlatısı
// ─────────────────────────────────────────────────────────────────────────

export interface YearlyNarrativeContext {
  year: number;
  totalPrayers: number;
  activeDays: number;
  highestStreak: number;
  topMonth?: string | null;
  quranPages?: number;
  memorizedSurahs?: number;
}

export async function generateYearlyNarrative(
  ctx: YearlyNarrativeContext
): Promise<string | null> {
  const prompt = `${SYSTEM_PERSONA}
Kullanıcının ${ctx.year} yılı ibadet özetinden sıcak, kişisel ve gurur verici 2-3 cümlelik bir anlatı yaz (Spotify Wrapped tarzı ama mütevazı).

Veriler:
- Toplam kılınan vakit: ${ctx.totalPrayers}
- Aktif gün sayısı: ${ctx.activeDays}
- En uzun seri: ${ctx.highestStreak} gün${ctx.topMonth ? `\n- En verimli ay: ${ctx.topMonth}` : ""}${
    ctx.quranPages ? `\n- Okunan Kuran sayfası: ${ctx.quranPages}` : ""
  }${ctx.memorizedSurahs ? `\n- Ezberlenen sure: ${ctx.memorizedSurahs}` : ""}

Sadece anlatı metnini döndür.`;

  return run(prompt, { temperature: 0.85, maxOutputTokens: 200 });
}

// ─────────────────────────────────────────────────────────────────────────
// 5) "Sor" asistanı (chat)
// ─────────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export async function generateAssistantReply(
  messages: ChatMessage[]
): Promise<string | null> {
  if (!ai) return null;

  const systemInstruction = `${SYSTEM_PERSONA}
Sen İslam, namaz, abdest, oruç, Kuran ve genel ibadet konularında yardımcı oluyorsun.
Kapsam dışı (siyaset, tıbbi/hukuki tavsiye, alakasız konular) sorularda nazikçe konunun dışında olduğunu söyle.
Mezhepsel ihtilaflı konularda farklı görüşlerin olabileceğini belirt, kesin fetva verme; ciddi konularda bir din görevlisine danışmayı öner.
Kısa ve anlaşılır yanıt ver.`;

  try {
    const contents = messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 800,
        ...THINKING_OFF,
      },
    });
    const text = response.text?.trim();
    return text && text.length > 0 ? text : null;
  } catch (err) {
    console.error("AI assistant error:", err);
    return null;
  }
}
