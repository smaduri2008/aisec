import dotenv from "dotenv";
dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || "development",

  meta: {
    appId: process.env.META_APP_ID || "",
    appSecret: process.env.META_APP_SECRET || "",
    pageAccessToken: process.env.META_PAGE_ACCESS_TOKEN || "",
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || "",
    igBusinessAccountId: process.env.IG_BUSINESS_ACCOUNT_ID || ""
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || ""
  },

  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",

  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceKey: required("SUPABASE_SERVICE_KEY"),
  replyDelayMinutes: Number(process.env.REPLY_DELAY_MINUTES || 5)
};