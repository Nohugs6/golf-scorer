# Golf Scorer — Realtime Rooms (GitHub Pages ready)

A modern, fun, multi-user golf scoring web app with Firebase Realtime Database.
- Game modes: **Stroke**, **Stableford**, **Skins**, **Wolf**
- **Current-hole Progress Panel** adapts to game type
- **How to Play** modal with quick rules
- Mobile-friendly, dark/light toggle, CSV export

## Quick Start
1. Create a Firebase project → Realtime Database → create DB (test mode is fine to try).
2. In Project settings → Your apps → Web app → copy the config JSON.
3. Deploy these files to GitHub Pages (instructions below).
4. Open your site → **Connect** → paste Firebase JSON → Save.
5. Create/Join a **Room Code** (optional PIN). Share code with your group.

## GitHub Pages Deployment
1. Create a repo (e.g., `golf-scorer`) on GitHub.
2. Upload `index.html`, `styles.css`, `app.js`, `README.md` to the repo root.
3. Repo → Settings → Pages → Branch: `main`, Folder: `/ (root)` → Save.
4. After a minute, your site is live at `https://<your-username>.github.io/golf-scorer/`.

## Optional Firebase Rules (simple example)
```
{
  "rules": {
    "rooms": {
      "$code": {
        ".read": "true",
        ".write": "true"
      }
    }
  }
}
```
Use stricter rules with PIN checks before wide sharing.

## Notes
- Wolf mode uses a simplified partner logic (auto-pairs wolf with best non-wolf score).
- Skins supports carry: ties add to the next hole's value.
- All data syncs per-room; no accounts required.

Enjoy your rounds! ⛳
