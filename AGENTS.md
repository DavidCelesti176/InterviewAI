<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- Install with `npm ci`. Start the app with `npm run dev -- --hostname 127.0.0.1 --port 3000`. Next.js 16's default hostname is `0.0.0.0`, and that hostname blocks the dev HMR websocket when the page is opened at `127.0.0.1`. The HTML still loads, but the page never hydrates and forms submit as a full reload. Binding `127.0.0.1` allows both `http://localhost:3000` and `http://127.0.0.1:3000`.
- `npm test` covers billing, interviews, progress, and stories and does not need API keys. Sign-in, live interviews, and Stripe need the variables in `.env.example`. Without them, the marketing and account pages still load, and signup or login reports that accounts are not configured.
- `npm run lint` currently fails on existing React hook and markup issues in the app. That failure is in the source, not the environment.
