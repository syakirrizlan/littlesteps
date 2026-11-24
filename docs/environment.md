# Environment variables

**None.** LittleSteps has no server, database, API keys or third-party services, so there is nothing to configure in Vercel or in a `.env` file. `.env.example` exists only to say so.

| Variable | Used by | Purpose |
|---|---|---|
| `CI` | Playwright config | Set automatically by GitHub Actions: one retry, and always start a fresh local server |
| `PORT` | `scripts/serve-static.mjs` | Optional port for the local static server (default 4173) |
| `TZ` | `npm run test:tz` | Runs time tests with the computer set to other timezones |

If a future version adds a server (for example to let the babysitter record entries), its secrets must go in Vercel's encrypted environment variables, never in the repository. `.gitignore` already excludes `.env*`.
