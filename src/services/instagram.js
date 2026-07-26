import { config } from "../config.js";

const GRAPH_URL = "https://graph.facebook.com/v20.0";

export async function sendInstagramMessage({ recipientId, message }) {
  if (!config.meta.pageAccessToken) {
    throw new Error("META_PAGE_ACCESS_TOKEN missing");
  }

  const url = `${GRAPH_URL}/me/messages?access_token=${encodeURIComponent(
    config.meta.pageAccessToken
  )}`;

  const payload = {
    recipient: { id: recipientId },
    message: { text: message },
    messaging_type: "RESPONSE"
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Instagram send failed: ${res.status} ${JSON.stringify(data)}`);
  }

  return data;
}