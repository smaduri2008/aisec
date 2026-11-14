# AI Secretary Backend (Phases 0–2, Instagram-first, Gemini)

## Included in this version
- Node.js + Express backend
- Supabase/Postgres schema + seed
- Meta webhook verify + receive path (Instagram-first)
- Message deletion webhook stub
- DB-driven reply timer worker (`/jobs/check-timers`)
- AI reply generation via Gemini API with fallback message
- Health + privacy policy routes
- **Owner dashboard** at `/dashboard` — view every conversation, read the full
  thread, reply manually, mark conversations resolved, turn AI auto-replies
  on/off, and edit business hours/services/FAQ/reply delay — see below

## Environment
Copy `.env.example` to `.env` and fill values.

### Required
- `SUPABASE_URL`
- `SUPABASE_DB_URL`
- `SUPABASE_SERVICE_KEY`
- `META_PAGE_ACCESS_TOKEN`
- `META_WEBHOOK_VERIFY_TOKEN`
- `GEMINI_API_KEY`

### Optional defaults
- `REPLY_DELAY_MINUTES` defaults to `5`
- `GEMINI_MODEL` defaults to `gemini-2.5-flash`

### Dashboard auth (recommended before deploying anywhere public)
- `DASHBOARD_USERNAME`
- `DASHBOARD_PASSWORD`

If either is blank, `/dashboard` and its API run with no login — anyone with
the URL can read customer conversations and send messages as the business.
That's fine on localhost, not once it's deployed.

## Install & run
```bash
npm install
cp .env.example .env
npm run migrate
npm run seed
npm run dev
```

If you're updating from an older clone of this repo, re-run `npm run migrate`
even if you've migrated before — it now also adds the `ai_enabled` column to
`business_settings` (safe to re-run; uses `ADD COLUMN IF NOT EXISTS`).

## Owner dashboard
Visit `http://localhost:3000/dashboard` (or your deployed domain + `/dashboard`).

- **Left side** — every conversation as a message slip: who it's from, a
  preview, how long ago, and its status (awaiting you / AI replied / you
  replied / resolved). Updates automatically every few seconds.
- **Right side** — the full thread for whichever conversation you click,
  with a box to type and send a reply yourself. Sending a reply cancels
  that conversation's AI timer, same as replying directly on Instagram.
- **AI replies: on/off** toggle (top left) — pauses the AI auto-responder
  globally without touching your webhook or losing any messages; overdue
  conversations just wait for you until you turn it back on.
- **Check now** button — manually triggers the same logic as
  `/jobs/check-timers`, useful for testing locally without waiting for a
  real cron job to be running.
- **Front desk settings** (bottom left) — business name, hours, services,
  FAQ text fed to the AI, and the reply delay in minutes.

## Endpoints
- `GET /health`
- `GET /privacy-policy`
- `GET /webhooks/meta` (verification)
- `POST /webhooks/meta` (incoming messages)
- `POST /webhooks/meta/message-deletions` (stub)
- `POST /messages/send-owner` (manual owner send, cancels timer)
- `POST /jobs/check-timers` (cron worker trigger — unauthenticated, for Render Cron)
- `GET /dashboard` (owner dashboard UI — behind dashboard auth)
- `GET /api/conversations`, `GET /api/conversations/:id` (behind dashboard auth)
- `POST /api/conversations/:id/reply`, `POST /api/conversations/:id/resolve` (behind dashboard auth)
- `GET /api/settings`, `PUT /api/settings` (behind dashboard auth)
- `POST /api/check-timers` (same as `/jobs/check-timers`, but behind dashboard auth — used by the "Check now" button)

## Webhook local-dev validation (Instagram)
1. Start backend: `npm run dev`
2. Expose local port with ngrok and set callback URL to `https://<ngrok-host>/webhooks/meta`
3. Verify token in Meta dashboard matches `META_WEBHOOK_VERIFY_TOKEN`
4. Click Meta webhook **Test** for `messages`, then send an IG DM from a tester account
5. Confirm backend logs include:
   - `[meta-webhook] request_hit`
   - `[meta-webhook] payload_summary`
   - `[meta-webhook] processing_complete`
6. Confirm message rows are created in `messages` and conversation is set to `awaiting_owner`

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