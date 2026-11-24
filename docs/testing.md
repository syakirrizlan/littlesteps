# Testing

`npm run check` runs everything, the same way CI does: lint → types → unit tests → unit tests under other timezones → build → end-to-end tests.

**Last full run: 24 Nov 2026, all passing.** 53 unit tests, 2 × 23 timezone runs, 24 end-to-end tests (12 scenarios × iPhone 13 and Pixel 7 sizes). `npm audit`: 0 vulnerabilities.

## Layers

| Layer | Tool | Where | What it proves |
|---|---|---|---|
| Rules | Vitest | `tests/unit/attendance`, `entries`, `report`, `setup` via fixtures | Every rule with a fixed clock |
| Time | Vitest + `TZ` | `tests/unit/time` (+ `npm run test:tz`) | KL dates and times are right whatever the computer's timezone (New York UTC−5, Kiritimati UTC+14) |
| Encryption and vault | Vitest + happy-dom | `tests/unit/crypto`, `vault` | Ciphertext only, wrong passcode, tampering, lockout, passcode change, backup and restore |
| Data checks and export | Vitest | `tests/unit/schema-export`, `size` | Bad data refused; CSV correct and formula-safe; a busy year stays under 0.5 MB |
| App in a browser | Playwright (Chromium) | `tests/e2e/*` | Real screens at phone sizes, with the production build and security headers, the phone set to New York, and a controlled clock |

## Coverage of the brief

| Brief item | Test |
|---|---|
| Normal drop-off and pickup | unit `records a normal day…`; e2e `a full day…` |
| Duplicate drop-off | unit `blocks a duplicate drop-off`; e2e button disabled while she's at the babysitter's |
| Pickup without drop-off | unit `blocks a pickup with no drop-off`; e2e button disabled |
| Midnight boundary | unit `keeps a visit that runs past midnight…`, `files an after-midnight entry…`, nap across midnight |
| Timezone correctness | unit `agrees with the platform's own Asia/Kuala_Lumpur rules…` + `test:tz`; e2e phone in New York shows KL times |
| Attendance correction | unit `corrections` block; e2e `late drop-off is flagged, and a correction needs a reason…`, `forgotten pickup…` |
| Access to own records only | single user: unit `stores only ciphertext`; e2e lock button, auto-lock, wrong passcode, reload locks |
| Unauthorised access / direct access attempts | no API exists; e2e `the app makes no requests to other websites`, header checks; unit lockout after 5 wrong tries |
| Meal creation | unit `records a meal and milk in ml`; e2e lunch |
| Sleep duration | unit `calculates duration…`; e2e nap 1h 30m |
| Activity submission | unit `records each kind` |
| Medicine safety | unit + e2e: only authorised, active instructions |
| Daily report | unit `brings the day together`; e2e day screen + written summary |
| Monthly overview | unit `counts days, hours, late and early days`; e2e Days screen |
| Mobile responsiveness | e2e `noHorizontalScroll` on Today, Days, Day and Settings at both sizes; manual screenshots in light and dark |
| Form validation | unit validation tests; e2e reason required, weak passcode refused |
| Session expiry | e2e `auto-lock after the chosen idle time` |
| Error handling | e2e: no console errors under the production CSP; non-backup and wrong-passcode files refused |
| Storage failure | vault shows “storage is full…” if a save fails (not automated: browsers can't be made to fill storage reliably in tests) |
| Backup restoration | e2e `backup, erase, restore on a 'new phone' with a different passcode` |
| Offline | e2e `opens offline once installed` |

## Not covered by automation

- Real Safari/WebKit on iPhone (only Chromium is installed in this environment). Do the manual check in `docs/deployment.md` on your iPhone after deploying.
- The installed Home Screen app itself (install prompts can't be automated); covered by the manual check.
