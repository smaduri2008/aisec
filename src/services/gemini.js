import { config } from "../config.js";

export async function generateReply({ businessSettings, clientName, history }) {
  if (!config.geminiApiKey) throw new Error("GEMINI_API_KEY missing");

  const systemPrompt = `
You are an assistant for ${businessSettings.business_name || "a business"}.
Business hours: ${businessSettings.hours || "Not specified"}.
Services: ${businessSettings.services || "Not specified"}.
FAQ/context: ${businessSettings.faq_text || "None"}.
Style: brief, friendly, professional.
If uncertain, ask a clarifying question and offer human follow-up.
Do not invent prices/policies if unknown.
`.trim();

  const messagesText = history
    .map((m) => `${m.sender.toUpperCase()}: ${m.content}`)
    .join("\n");

  const userPrompt = `Client name: ${clientName || "Unknown"}

Conversation:
${messagesText}

Write the next reply as the business.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    config.geminiModel
  )}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.geminiApiKey
    },
    body: JSON.stringify({
      systemInstruction: {
        role: "system",
        parts: [{ text: systemPrompt }]
      },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 220
      }
    })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Gemini error ${res.status}: ${JSON.stringify(data)}`);
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("").trim() || "";

  if (!text) throw new Error("Gemini returned empty response");
  return text;
}