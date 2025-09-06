# UNCLE — Implementation Checklist

Theme
- [x] Force dark theme globally

WhatsApp Cloud Webhook
- [x] GET verify (hub.verify_token, hub.challenge)
- [x] POST receiver → call whatsapp.processMessage
- [x] Reply via Meta Graph API
- [ ] Env vars in Convex: WHATSAPP_VERIFY_TOKEN, WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID

Parser
- [x] Handle ₹/﷼, commas, decimals, and `k` notation
- [x] Infer IN/SA from symbol/keywords
- [ ] Arabic numerals and more locales
- [ ] Category dictionaries (groceries, utilities, etc.)
- [ ] AI fallback via OpenRouter for ambiguous texts

WhatsApp Commands
- [x] undo → delete last transaction for the sender
- [x] balance → show totals and net
- [ ] report → monthly summary with link
- [ ] lang → set preferred language

Daily Recap (Cron)
- [ ] Nightly summary for active WhatsApp sessions
- [ ] Send via WhatsApp API
- [ ] Opt-in/out flag per user/session

Dashboard
- [x] Export CSV (current country filter)
- [ ] Export PDF/Excel via Convex action + storage

Onboarding & Linking
- [ ] WhatsApp connect UX on Dashboard
- [ ] Save user phoneNumber and whatsappConnected
- [ ] Backfill: link phone-based transactions once user verifies

Reliability
- [ ] Enhanced logging and retry on send failures
- [ ] Rate limiting per phone
- [ ] Signature verification (if available)

Security
- [ ] Audit of exposed endpoints
- [ ] Permissions checks for report links
