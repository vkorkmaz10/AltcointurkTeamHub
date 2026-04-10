import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Generate a reply for a team member based on their .skill profile
 */
export async function generateReply({
  displayName,
  xHandle,
  skillContent,
  tweetAuthor,
  tweetContent,
}: {
  displayName: string;
  xHandle: string;
  skillContent: string;
  tweetAuthor: string;
  tweetContent: string;
}): Promise<string> {
  const systemPrompt = `Sen ${displayName} (${xHandle})'sın.

## Karakter Analizin:
${skillContent}

## Kurallar:
- Maksimum 280 karakter
- Asla bot gibi görünme
- Doğal ve samimi ol
- Tweet içeriğiyle ilgili değer katan bir yorum yap
- Emoji kullanımını karakterine göre ayarla
- Türkçe yaz
- Sadece yanıt metnini döndür, başka bir şey yazma`;

  const userPrompt = `Takım arkadaşın ${tweetAuthor} şu tweeti attı:
"${tweetContent}"

Bu tweet'e, senin karakterine uygun, samimi ve etkileşimi artıracak bir cevap yaz.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.8,
      maxOutputTokens: 100,
    },
  });

  const text = response.text?.trim() || "";

  // Ensure it's within 280 chars
  if (text.length > 280) {
    return text.substring(0, 277) + "...";
  }

  return text;
}

/**
 * Generate a .skill profile based on user preferences
 */
export async function generateSkillProfile({
  description,
  style,
  expertise,
  bannedWords,
}: {
  description: string;
  style: string[];
  expertise: string[];
  bannedWords: string[];
}): Promise<string> {
  const prompt = `Bir kripto/finans topluluğu üyesi için .skill (karakter profili) oluştur.

Kullanıcının kendini tanımlaması: "${description}"
Konuşma tarzı tercihleri: ${style.join(", ")}
Uzmanlık alanları: ${expertise.join(", ")}
Yasaklı kelimeler: ${bannedWords.length > 0 ? bannedWords.join(", ") : "Yok"}

Bu bilgilere dayanarak, bu kişinin sosyal medya kişiliğini detaylı olarak tanımlayan bir .skill system prompt yaz.
Prompt, AI'ın bu kişi gibi davranmasını sağlayacak şekilde olmalı.
Sadece .skill içeriğini yaz, başka açıklama ekleme.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      temperature: 0.7,
      maxOutputTokens: 500,
    },
  });

  return response.text?.trim() || "";
}
