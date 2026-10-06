# M10 Security Policy

Never commit secrets to this repository.

## Never store in client code
- Wallet seed phrase or private key
- Payment API keys
- Webhook signing secrets
- Telegram bot tokens
- AI provider secret keys

## Payment trust boundary
The browser may request checkout, but only a server-side verified provider callback may mark an order PAID. All callbacks must be authenticated and idempotent.

## Incident rule
If a secret is exposed, rotate/revoke it immediately; deleting it from a later commit is not sufficient.
