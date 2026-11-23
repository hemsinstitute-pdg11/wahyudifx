# WahyudiFX — Kota Trader 3D

A read-only educational 3D market-data visualization. It does not connect to a broker, accept orders, or execute transactions.

## Market data
Configured Twelve Data symbols: XAU/USD, EUR/USD, GBP/USD, USD/JPY, BTC/USD, ETH/USD, XAG/USD. Each subscribed symbol consumes one WebSocket credit (seven credits total), subject to the account's plan and symbol entitlements. Gold/silver commodity stream availability must be checked for the selected plan.

The Node.js server keeps the provider API key private, maintains one upstream WebSocket connection per server process, and broadcasts approved price events to browser sessions.

## Licensing gate
**Live public display is disabled by default.** Do not set `TWELVE_DATA_PUBLIC_DISPLAY_APPROVED=true` until Twelve Data confirms in writing that the selected plan and market entitlements permit public display/redistribution of all requested instruments on this website, including exchange-specific requirements.

Individual plans may be limited to personal/internal use. A public website may require a business plan and/or separate market-data permissions. Commodity coverage and licensing can differ by product. Confirm current terms directly with Twelve Data. Keep the visible "Data provided by Twelve Data" attribution when public display is authorized.

## Environment variables
- `TWELVE_DATA_API_KEY`: private key from Twelve Data.
- `TWELVE_DATA_PUBLIC_DISPLAY_APPROVED`: leave false until written approval is received.

Never put the API key in browser JavaScript, `index.html`, a committed `.env` file, or public build logs.

## Run locally
1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in the key if available; dotenv loads this file locally.
4. Keep the public-display approval flag false until licensed.
5. Run `npm start` and open `http://localhost:3000`.

Health endpoint: `/health`. Browser WebSocket endpoint: `/market-stream`.

## Deploy
This requires a Node.js host with persistent WebSocket support; GitHub Pages alone cannot run the proxy. A Render blueprint is included in `render.yaml`. Configure environment variables in the hosting dashboard. Do not enable public display until approval is confirmed.

## Data semantics
- Ticker and billboard values come only from provider price events.
- The "tick" percentage compares the latest event with the immediately previous event received in this browser session; it is not a daily change.
- Missing prices remain "MENUNGGU DATA"; no placeholder prices are fabricated.
- Bull/Bear buttons trigger visual teaching scenarios only and never modify market prices.
- No broker integration, account balance, order routing, or trade execution is included.
