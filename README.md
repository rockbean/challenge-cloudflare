# challenge-cloudflare

A small **Cloudflare Pages** + **Pages Functions** demo showing a three-state Turnstile challenge flow:

`challenge` → user solves a Turnstile widget → `passed` (a "通过" button appears)
→ user clicks it → `confirmed` (large **pass** text).

State is persisted in an HTTPOnly, HMAC-signed session cookie. The frontend fetches the public Turnstile site key from `/api/config` on init — Pages serves the static HTML directly with no per-request Worker in the path.

中文说明：本项目演示 Cloudflare **Pages** + **Pages Functions** + **GitHub 自动部署** 的三步 Turnstile 状态机。静态资源由 Pages 直接托管，Functions 提供 4 个 API 端点；推送到 GitHub 即自动部署。

## Architecture

```
.
├── public/                        # served as static assets by Cloudflare Pages
│   ├── index.html                 # SPA — three <section> views
│   ├── style.css                  # minimal single-accent theme
│   ├── client.js                  # state machine + dynamic config fetch + Turnstile render
│   └── _headers                   # CSP + standard security headers (Pages convention)
├── functions/                     # Pages Functions — auto-bundled by Cloudflare
│   └── api/
│       ├── config.ts              # GET — public Turnstile site key (cached 5 min)
│       ├── state.ts               # GET — derive {challenge|passed|confirmed} from cookie
│       ├── verify.ts              # POST — call Turnstile siteverify → set signed cookie
│       └── confirm.ts             # POST — require passed=true → mark confirmed
├── src/                           # pure logic, no Workers/Functions runtime deps
│   ├── http.ts                    # parseCookies, jsonResponse, isSecureRequest
│   ├── session.ts                 # HMAC-signed cookie helpers (Web Crypto)
│   └── turnstile.ts               # siteverify wrapper
├── tests/                         # vitest unit tests
│   ├── http.test.ts
│   ├── session.test.ts
│   └── turnstile.test.ts
├── wrangler.jsonc                 # Pages-compatible config (pages_build_output_dir)
├── tsconfig.json                  # strict mode, includes src/ + functions/ + tests/
├── vitest.config.ts
├── .dev.vars                      # local secrets (gitignored)
├── .dev.vars.example
└── package.json
```

## Local development

```bash
npm install
npm run dev
# → http://localhost:8788/
```

`wrangler pages dev` reads `wrangler.jsonc` for `pages_build_output_dir` and serves both
`public/` (static) and `functions/` (TypeScript → esbuild bundle) on **port 8788** (not
the 8787 that `wrangler dev` used previously — this is a Pages default).

The project ships with Cloudflare's documented **Turnstile test keys** in
`wrangler.jsonc` + `.dev.vars`:

| Where       | Key (test) |
| ----------- | ------------------------------------------ |
| Site key    | `1x00000000000000000000AA` (always passes) |
| Secret key  | `1x0000000000000000000000000000000AA` (always passes) |

With this pair, any token value (including `XXXX.DUMMY.TOKEN.XXXX`) is accepted. The
site key drives the frontend widget; the secret key is checked server-side.

`.dev.vars` is already populated with a local dev secret and the test Turnstile secret
so `wrangler pages dev` works end-to-end with no extra config.

## Tests + typecheck

```bash
npm run typecheck
npm test
```

`npm run typecheck` is the **build command** used in CI and by the Cloudflare Pages
build pipeline — failing typecheck fails the deploy.

## Deploy to Cloudflare Pages via GitHub (primary)

1. **Push the repo to GitHub.**
2. In the Cloudflare dashboard: **Workers & Pages → Create application → Pages → Connect to Git**.
   Select the repo.
3. **Project settings**:
   - Project name: `challenge-cloudflare` (or whatever)
   - Production branch: `main`
   - **Build command**: `npm run typecheck`
   - **Build output directory**: `public`
   - **Root directory**: leave empty (project root)
   - **Environment variables** (non-secret, "Environment variables" section):
     - `TURNSTILE_SITE_KEY` = your real Turnstile site key (e.g. `0x4AAAAAAA...`)
   - **Secrets and variables** (encrypted):
     - `TURNSTILE_SECRET` = your real Turnstile secret key
     - `SESSION_SECRET` = a long random string (`openssl rand -hex 32`)
4. Click **Save and Deploy**. Cloudflare will:
   - Run `npm install`
   - Run `npm run typecheck` (must pass)
   - Upload `public/` as static assets
   - Auto-bundle and deploy `functions/` as Pages Functions
5. Optional: attach a **Custom domain** after the first deploy.
6. Every push to `main` auto-redeploys. Preview deployments are created for PRs automatically.

## Manual deploy (fallback)

If you can't connect GitHub, deploy directly with the Wrangler CLI:

```bash
npm install
wrangler login
wrangler pages deploy ./public --project-name=challenge-cloudflare
```

You still need to set the env vars and secrets in the Cloudflare dashboard afterwards.

## Get real Turnstile keys

1. Visit <https://dash.cloudflare.com/?to=/:account/turnstile>
2. Click **Add a site**
3. Choose **Managed** (default visible widget) or **Non-interactive** (invisible) challenge type
4. Copy the **Site Key** (public) and **Secret Key** (server-only)

The site key is exposed via `/api/config`; the secret is used by `functions/api/verify.ts`
to call the `siteverify` endpoint. The test keys always succeed and exist only to make
local development friction-free.

## How the session works

| Route             | Method | Behavior                                                                    |
| ----------------- | ------ | --------------------------------------------------------------------------- |
| `/api/config`     | GET    | `{siteKey}` — public, cached at the edge for 5 min                          |
| `/api/state`      | GET    | `{state: "challenge" \| "passed" \| "confirmed"}` derived from cookie       |
| `/api/verify`     | POST   | `{token}` → calls Turnstile `siteverify` → sets signed cookie → `passed`    |
| `/api/confirm`    | POST   | Validates cookie (must be `passed`) → re-signs with `confirmed: true`      |
| everything else   | GET    | Served directly from `public/` by Pages (HTML/CSS/JS)                       |

The session cookie `cf_session` is `<base64url(payload)>.<base64url(HMAC-SHA256)>`,
`HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`. The `Secure` flag is added automatically
when the request URL is `https:` (production); it's omitted on `wrangler pages dev` so
cookies work on plain HTTP. Expired or tampered cookies are treated as `challenge`.

## Security notes

- `public/_headers` sets a strict CSP that allows only `self` + `challenges.cloudflare.com`
  for scripts, frames, and connections (Turnstile widget + verify API). It also includes
  `'unsafe-inline'` in `script-src` and `style-src` because the Turnstile widget injects
  inline code/styles — this is required, not optional.
- The session cookie is `HttpOnly` to prevent XSS-based session theft.
- The site key is a public identifier by design; that's why `/api/config` can be cached at
  the edge and has no auth.
- The `TURNSTILE_SECRET` and `SESSION_SECRET` are **never** committed to the repo — they
  live in the Cloudflare Pages dashboard as encrypted secrets.

## Troubleshooting

- **Build failed: tsc errors** — run `npm run typecheck` locally and fix the errors before
  pushing. The Pages build runs the same command.
- **Turnstile says invalid site key** — verify the `TURNSTILE_SITE_KEY` env var in the
  dashboard matches the site key for the deployed domain. A site key for `localhost` is
  not valid on production.
- **Turnstile says invalid secret** — verify the `TURNSTILE_SECRET` secret in the
  dashboard. It's checked by `functions/api/verify.ts` via `siteverify`.
- **Cookie not set** — Pages Functions require HTTPS in production, where the `Secure`
  flag is set automatically. On `wrangler pages dev` (HTTP) the `Secure` flag is omitted
  intentionally so the cookie is accepted by the browser.
- **Functions not detected** — confirm the `functions/` directory is at the project
  **root**, not inside `public/`. Pages scans `./functions/` by convention.
- **CSP blocks the Turnstile widget** — the `_headers` CSP must whitelist
  `https://challenges.cloudflare.com` in `script-src`, `frame-src`, and `connect-src`.
  Don't tighten these without testing the widget still loads.
