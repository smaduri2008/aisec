# AI Secretary Backend (Phases 0–2, Instagram-first, Gemini)

## Included in this version
- Node.js + Express backend
- Supabase/Postgres schema + seed
- Meta webhook verify + receive path (Instagram-first)
- Message deletion webhook stub
- DB-driven reply timer worker (`/jobs/check-timers`)
- AI reply generation via Gemini API with fallback message
- Health + privacy policy routes

## Environment
Copy `.env.example` to `.env` and fill values.

### Required
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `META_PAGE_ACCESS_TOKEN`
- `META_WEBHOOK_VERIFY_TOKEN`
- `GEMINI_API_KEY`

### Optional defaults
- `REPLY_DELAY_MINUTES` defaults to `5`
- `GEMINI_MODEL` defaults to `gemini-2.5-flash`

## Install & run
```bash
npm install
cp .env.example .env
npm run migrate
npm run seed
npm run dev
```

## Endpoints
- `GET /health`
- `GET /privacy-policy`
- `GET /webhooks/meta` (verification)
- `POST /webhooks/meta` (incoming messages)
- `POST /webhooks/meta/message-deletions` (stub)
- `POST /messages/send-owner` (manual owner send, cancels timer)
- `POST /jobs/check-timers` (cron worker trigger)

## Cron setup (Render)
Create a cron that POSTs:
`https://<your-backend-domain>/jobs/check-timers`
every minute.

## Free-tier note
This stack can be $0/month at low usage:
- Gemini API free tier (subject to usage/rate limits)
- Supabase free tier
- Render free tier

If you exceed limits, charges or throttling may apply.