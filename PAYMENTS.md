# M10 Payment Architecture

## Rule
M10 never counts an order as revenue until a payment provider confirms successful payment.

## Web checkout
1. Customer selects a package.
2. M10 creates an order with status PENDING.
3. Customer is redirected to a supported payment provider.
4. Server verifies provider callback/webhook.
5. Only then order becomes PAID.
6. AI Factory runs.
7. Delivery is released.
8. Revenue, fees, cost, net profit and withdrawable balance are recorded.

## Planned rails
- Papara Business / Pay by Link or Checkout: card/Papara web payments, subject to merchant approval.
- Crypto: USDT payment rail to be added only through a verifiable payment flow; no private key or seed phrase is stored in this repository.
- Telegram: digital goods/services inside Telegram use Telegram Stars (XTR).

## Security
- Never commit wallet seed phrases, private keys, payment API keys, bot tokens or webhook secrets.
- Secrets belong in server-side environment variables.
- Client-side JavaScript must never decide that a payment succeeded.
- Payment amount, order ID and provider transaction ID must be verified server-side.
- Duplicate callbacks must be idempotent.

## Accounting states
PENDING -> PAID -> PROCESSING -> DELIVERED
                -> FAILED / REFUNDED

Dashboard financial metrics must be derived only from verified transactions.
