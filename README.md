# Anki Review Companion

A lightweight website for reviewing Anki-style cards with two gaps filled:

- Randomized review order
- One-off (temporary) custom study sets

## What it does

- Loads cards from JSON export (`front`, `back`, `deck`, `tags`, `id` fields)
- Lets you filter by deck/tag and optionally cap max card count
- Creates an ephemeral session (no permanent rescheduling changes)
- Supports **Again** (re-queues card) and **Good** (moves on)

## Run locally

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Note on Anki login

This implementation does **not** require your login credentials. It is designed around importing exported card JSON so your password stays private.

If you later want direct sync with your Anki collection, the usual secure approach is:

1. Run a local connector (e.g., AnkiConnect) on your own machine.
2. Have this web app talk to the local API.
3. Avoid sharing credentials directly with any hosted service.
