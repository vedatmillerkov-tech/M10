# M10 API Worker

Cloudflare Worker backend foundation.

Endpoints:
- GET /health
- POST /api/order
- GET /api/payment/:order_id

The order endpoint returns the configured public USDT TRC20 receiving address and an exact package amount. Payment remains PENDING until an independent blockchain verification layer is connected.

## Critical rule
Never change an order to PAID from browser input or a customer button. Only server-side chain/provider verification may do that.

## Secrets
Do not place private keys, seed phrases, provider secrets or AI keys in this repository. Use Cloudflare secrets/environment variables.
