# DiffLens API

Visual comparison API for web pages.

## Setup

```bash
npm install
npx playwright install chromium
```

## Run

```bash
node server.js
```

Runs on http://localhost:3000

## Endpoints

### POST /compare

```json
{
  "url1": "https://example.com",
  "url2": "https://example.org",
  "threshold": 0.1
}
```

Returns mismatch percentage and base64 encoded images (screenshots + diff).

### GET /health

Returns `{ "status": "ok" }`

## Standalone

Edit urls in engine.js and run:

```bash
node engine.js
```

Saves screenshot1.png, screenshot2.png, and diff.png to disk.
