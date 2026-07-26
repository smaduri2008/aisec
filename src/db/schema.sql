CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL, -- instagram | facebook
  platform_user_id TEXT NOT NULL UNIQUE,
  name TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_contact_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_owner', -- awaiting_owner | owner_handled | ai_handled | resolved
  reply_due_at TIMESTAMP NULL,
  last_message_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversations_due
  ON conversations (status, reply_due_at);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('client','ai','owner')),
  content TEXT NOT NULL,
  platform_message_id TEXT,
  sent_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_sent
  ON messages (conversation_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  requested_time TIMESTAMP,
  calendar_event_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' -- pending | confirmed | cancelled
);

CREATE TABLE IF NOT EXISTS business_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT,
  hours TEXT,
  services TEXT,
  faq_text TEXT,
  reply_delay_minutes INT NOT NULL DEFAULT 5
);