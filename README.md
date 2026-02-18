# Anki Review Companion

This web app connects to **AnkiWeb using your credentials**, downloads an export, and gives you:

- Randomized card order
- One-off / temporary custom study sessions

## Why this version

You mentioned you cannot install Anki on your work computer and prefer credential-based access. This app is built for that: it signs into AnkiWeb and syncs cards directly through automated browser export.

## Run locally

1. Install dependencies:

```bash
npm install
npx playwright install chromium
```

2. Start the app:

```bash
npm start
```

3. Open <http://localhost:4173>.

## Credential handling

- Credentials are sent only to your local server endpoint (`/api/sync`) for the login operation.
- Credentials are **not persisted** to disk by this app.
- Synced cards are kept in browser memory for your current session.

## Notes

- This uses UI automation against AnkiWeb and depends on AnkiWeb page structure.
- If AnkiWeb changes their export page, selectors in `server.js` may need updates.
- If direct sync fails for any reason, you can still use JSON import as a fallback.
- If you see `Unexpected token "<"` during sync, you are likely serving only static files. Run with `npm start` so `/api/sync` is available.
