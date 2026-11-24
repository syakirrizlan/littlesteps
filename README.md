# LittleSteps

A private diary of your daughter's days at the babysitter's: when she was dropped off, when she was picked up, and what happened in between. It runs as an app on your phone, keeps every record encrypted on that phone behind your passcode, and sends nothing anywhere.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8) ![Tests](https://img.shields.io/badge/tests-53%20unit%20%2B%2024%20e2e-23835a)

Built the same way as the Finance Tracker: a Next.js app exported as plain files, hosted free on Vercel, installed from the browser.

## What it does

| Screen | What you do there |
|---|---|
| **Today** | One status card (not dropped off · at the babysitter's · picked up · needs a correction), big **Dropped off** and **Picked up** buttons, quick add for meals, naps, play and notes, and the day so far |
| **Days** | Month calendar, days and hours at the babysitter's, late drop-offs and early pickups, then each day's report |
| **Daily report** | Times and who did drop-off/pickup, meals, total nap, activities, health, medicine, incidents, notes, a written summary and the change history |
| **Settings** | Child, family, babysitters, usual times, medicine you authorise, auto-lock, passcode, backup and restore, spreadsheet export, erase |

Rules it enforces:

- Only one open visit: a second drop-off is blocked until the pickup is recorded.
- Pickup must come after drop-off, no times in the future, no overlapping visits, nothing over 24 hours.
- Times are Kuala Lumpur time whatever the phone's timezone. A visit that runs past midnight stays on the drop-off day.
- Late drop-off and early pickup are flagged against your usual times, with a grace period (15 minutes by default).
- Corrections and removals need a reason. The old value, new value, reason and time are kept in the day's change history. Nothing is ever hard-deleted.
- Medicine can only be recorded against an instruction you've authorised in Settings.

## Install on your phone

### One-time hosting on Vercel (free, about 5 minutes)

1. Go to [vercel.com/signup](https://vercel.com/signup) and choose **Continue with GitHub** (the same account as the Finance Tracker is fine).
2. Click **Add New… → Project**, find `littlesteps` and click **Import**. If it isn't listed, click **Adjust GitHub App Permissions** and allow this repository.
3. Leave every setting as it is and click **Deploy**. You get an address like `https://littlesteps.vercel.app` (or `littlesteps-xxxx.vercel.app`).

No environment variables are needed. Full steps and checks: [docs/deployment.md](docs/deployment.md).

### Add it to the Home Screen

Open the address in **Chrome (Android)** or **Safari (iPhone)**, not inside WhatsApp, Gmail or Facebook. Those apps' built-in browsers can't install apps.

Tap **Install** at the top of the first screen. It's also in the header and in Settings until the app is installed.

- **Android:** Chrome's own install prompt opens. If Chrome doesn't offer one (for example after you dismissed it), the button shows the steps: **⋮ → Install app**.
- **iPhone:** Safari has no install prompt, so the button shows the steps: **Share → Add to Home Screen → Add**. Always open it from the Home Screen icon. Safari may clear the data of websites you haven't visited for a while, but not of Home Screen apps.

The button disappears once you're using the installed app.

Then create your passcode and enter the names (child, you, the babysitter) and usual times.

## Keep a backup

Your records exist only on your phone. **Settings → Download backup** saves an encrypted `.littlesteps` file. Keep it in Google Drive, iCloud Drive or on your laptop. The app reminds you weekly.

To restore (new phone, cleared data, forgotten passcode): open the app, create a passcode, then tap **Restore from backup…** and enter the passcode you had when you made that backup. Details: [docs/backup-and-restore.md](docs/backup-and-restore.md).

## Privacy

- Everything you record is encrypted (AES-256-GCM, key from your passcode) in the phone's storage. Vercel only serves the app's files and never sees your records.
- No accounts, analytics, ads, tracking, AI, GPS or photos.
- The app may only talk to its own address (enforced by the Content-Security-Policy).
- There is no way to recover a forgotten passcode. That's what keeps the records private.

More: [docs/security.md](docs/security.md).

## Development

Needs [Node.js 22+](https://nodejs.org/).

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # unit tests (rules, time, vault, backup, export)
npm run build        # static export into out/
npm start            # serve out/ with the production security headers on :4173
npm run test:e2e     # browser tests at iPhone and Android sizes (needs a build)
npm run check        # everything above, the way CI runs it
```

| Command | What it does |
|---|---|
| `npm run lint` | ESLint (Next.js rules) |
| `npm run typecheck` | Route types + TypeScript |
| `npm run test:tz` | Time-related unit tests with the computer set to New York and Kiritimati (UTC+14) |
| `node scripts/make-icons.mjs` | Redraws the app icons |

### Project structure

```
src/
├── app/                 Next.js entry, manifest, theme (globals.css)
├── components/          screens (Today, Days, Day, Settings), sheets, lock screen, UI kit
└── lib/
    ├── care/            data model and rules: attendance, entries, report, setup,
    │                    schema checks and upgrades, CSV export, Kuala Lumpur time
    ├── security/        passcode vault, encryption, auto-lock (from the Finance Tracker)
    ├── hooks.ts         clock and screen routing
    ├── files.ts         saving backup and CSV files
    └── pwa.ts           install prompt and offline cache (from the Finance Tracker)
tests/
├── unit/                Vitest
├── e2e/                 Playwright
└── fixtures/            synthetic test data only
docs/                    architecture, data model, security, deployment, backup, limitations
scripts/                 local static server, icon generator
```

## Documentation

- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Security review and PDPA notes](docs/security.md)
- [Deployment](docs/deployment.md)
- [Backup and restore](docs/backup-and-restore.md)
- [Environment variables](docs/environment.md)
- [Testing](docs/testing.md)
- [Known limitations](docs/known-limitations.md)

Never commit real names, backups (`*.littlesteps`) or exports (`*.csv`). They are git-ignored, and test data is synthetic.
