# 09 — Hosting & build

> **Status:** rough sketch.

## Constraints

- **Static site only** — GitHub Pages.
- **Zero npm dependencies installed** — no `node_modules`, no supply-chain
  attack surface.
- **Spektrum loaded from CDN (unpkg)** at a pinned version.
- **No build step** — what's in the repo is what's served.

## Repo layout in the served form

GitHub Pages can serve from `/` or `/docs`. We'll use **`/` on a `gh-pages`
branch** (or `/` on `main`, decided at deploy time) so that `/docs` stays
free for our prose docs.

```text
/
├── index.html              ← entry
├── src/                    ← hand-written ES modules
├── tests/                  ← `node --test`, never served
├── docs/                   ← prose docs, not served (or served at /docs/)
├── package.json            ← scripts + metadata, no deps
└── README.md
```

The deployment is literally `git push` to the configured Pages branch.

## `index.html` sketch

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Dan's Dungeons</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="./src/ui/style.css">
</head>
<body>
  <main id="app"></main>

  <!-- Spektrum, pinned and SRI-hashed -->
  <script type="module"
          src="https://unpkg.com/spektrum@1.0.0/spektrum.min.js"
          integrity="sha384-..."
          crossorigin="anonymous"></script>

  <!-- Spektrum's history-persistence companion (only if we use it directly;
       see 06-persistence.md for the IndexedDB-first plan). -->
  <script type="module"
          src="https://unpkg.com/spektrum@1.0.0/companions/spektrum-persist.min.js"
          integrity="sha384-..."
          crossorigin="anonymous"></script>

  <!-- App boot -->
  <script type="module" src="./src/main.js"></script>
</body>
</html>
```

**Pinning rules:**

- Exact version. No `^`, no `~`, no `latest`.
- SRI hash (`integrity="sha384-..."`) so a compromised CDN can't swap the
  bytes. (Generate with `openssl dgst -sha384 -binary file | openssl base64
  -A`.)
- Document the version bump procedure: download the new file, regenerate
  the hash, commit the change. No automation that auto-bumps CDN URLs.

## `package.json` shape

```json
{
  "name": "dungeons-and-dans",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Text-based AI-driven D&D game, fully client-side.",
  "scripts": {
    "serve": "python3 -m http.server 8000",
    "test": "node --test tests/"
  },
  "dependencies": {},
  "devDependencies": {}
}
```

That's it. The `serve` script intentionally uses the system `python3` (or we
swap to `node --experimental-network-import` if it lands, or `npx
http-server` *without* installing — refused). We do not install anything.

> If we ever need a tiny dev-only HTTP server with proper Range support, we
> ship our own ~40-line `serve.mjs` rather than installing a dep.

## Tests without deps

`node --test` (stable since Node 20) gives us a real test runner with zero
dependencies. We test the deterministic stuff: dice, checks, combat, XP,
movesets, schema validation, persistence migrators.

The AI-touching layers get **smoke tests** that mock the network. We don't
unit-test prompt content directly; we test that given a mocked response
shape, the loop commits the right delta.

## CI / deploy

- **CI:** GitHub Actions running `node --test` on push. No install step
  (since there are no deps).
- **Deploy:** A workflow that copies `index.html`, `src/`, and any required
  assets to the Pages branch (or configures Pages to serve from `main`
  directly with a `.nojekyll` file). Either way, **no build**.

## Browser support

Modern evergreens only: Chrome/Edge/Safari/Firefox current minus 1. We use
ES modules, top-level await, `fetch`, `crypto.randomUUID`, IndexedDB,
streams. No transpilation, no polyfills, no compatibility shims.

## Domain & analytics

Default deployment is `https://<user>.github.io/dungeons-and-dans/`. No
analytics, no service worker for now (could add one later for offline UI).

## Security posture

- CSP `<meta>` tag locking script sources to `'self'` + `unpkg.com`
  (specifically the pinned path). Disallow inline scripts.
- `Permissions-Policy` restricting features we don't use.
- The player's API key is the only sensitive thing; we keep it in
  localStorage and only attach it to requests targeting the configured AI
  base URL. The key is never put in any other request, never logged.

## Open

- Service worker for offline shell? (Game itself needs the network for AI.)
- Optional self-hosted Spektrum copy (vendored at a pinned hash) for users
  who don't want any CDN call? Costs us a little repo size, gains us total
  CDN-independence — worth considering.
