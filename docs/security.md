# Security review

Scope: LittleSteps v0.1.0 as built in this repository. Reviewed 24 Nov 2026.

## What is protected

The diary holds a young child's name, daily routine, health notes, medicine and incidents, plus the names of family members and the babysitter. The main risks are someone else reading it (a borrowed or lost phone, a shared computer, a leaked backup) and losing it.

## Threat model and controls

| Threat | Control | Verified by |
|---|---|---|
| Someone opens the app on the phone | Passcode required on every open. Auto-lock after 5 minutes idle (1–60 or off). **Lock** button. Data is dropped from memory on lock. | e2e: lock button, auto-lock, reload requires passcode |
| Someone reads the browser's storage (dev tools, forensic copy) | One AES-256-GCM record. Key from PBKDF2-SHA256, 600,000 rounds, random 16-byte salt, fresh 12-byte IV per save. The key is non-extractable and lives only in memory. | unit: crypto, vault "stores only ciphertext"; e2e: localStorage has no names |
| Passcode guessing in the app | At least 8 characters, not digits only, common passcodes refused. After 5 wrong tries: 30 s wait, doubling to 15 min. | unit: passcode rules, lockout |
| Leaked backup file | Backups are the same sealed record (encrypted with the passcode in use when made). GCM detects tampering. | unit + e2e: backup contains no names, wrong passcode and tampering refused |
| Data sent to a third party | No server, analytics, AI, ads, fonts from CDNs, or GPS. CSP `connect-src 'self'`, `default-src 'self'`. Fonts are self-hosted at build time. | e2e: no requests leave the app's address; headers present |
| Code injection (XSS) | React escapes all text; no `innerHTML` or `eval`. CSP blocks other origins. User text is never put into HTML. | Code scan (no `dangerouslySetInnerHTML`, `innerHTML`, `eval`) |
| Clickjacking, framing | `frame-ancestors 'none'`, `X-Frame-Options: DENY` | e2e: headers |
| Spreadsheet formula injection via CSV | Cells starting with `= + - @` are prefixed with `'` | unit: CSV guarding |
| Malformed or hostile backup file | Size limit 20 MB, shape check, version check, decryption must succeed before anything changes, confirmation before replacing | unit: schema; e2e: non-backup refused |
| Data loss | Encrypted backup + restore (tested end to end), weekly reminder, storage-full message, `navigator.storage.persist()` request, no hard deletes | e2e: backup → erase → restore with a different passcode |
| Search engines indexing the address | `robots.txt` disallow, `X-Robots-Tag: noindex`, `<meta name="robots" content="noindex">` | headers |
| Supply chain | Dependencies are build-time only (no runtime third-party code). `npm audit`: 0 vulnerabilities on 24 Nov 2026. Versions pinned in `package-lock.json`. | `npm audit` |

### Handover requirements that don't apply (no server)

Server-side validation, database-level access rules, session management and API rate limiting were in the original brief for a multi-user server design. With a single-user, on-device app there is no server, no session and no API. Their purpose is met on the device instead: every write goes through validated rule functions, the vault is the access control, and the unlock lockout is the rate limit.

### Residual risks

- **Weak passcode:** a short passcode can be guessed offline by someone who copies the encrypted record. Use a phrase of 3+ words.
- **Unlocked phone:** while unlocked, anyone holding the phone can read the diary. Keep auto-lock on.
- **Malicious code update:** whoever controls the GitHub repository or Vercel project could ship code that reads the diary after you unlock. Keep 2-factor authentication on GitHub and Vercel.
- **`script-src 'unsafe-inline'`:** needed for Next.js static export. Acceptable because the app renders no untrusted HTML and allows no other script origins.
- **Forgotten passcode:** no recovery by design. Keep a backup and the passcode written down somewhere safe.

## Malaysian Personal Data Protection Act 2010 (PDPA)

This is a reading, not legal advice.

- The PDPA applies to personal data processed in commercial transactions. Section 45(1) exempts personal data processed by an individual only for personal, family or household affairs. A parent keeping a private diary of their own child's care, on their own phone, fits this exemption.
- LittleSteps sends nothing to anyone, so there is no data processor, no cross-border transfer, and no breach-notification duty under the 2024 amendments, which apply to data controllers.
- Good practice we follow anyway: collect the minimum (names only, no addresses, phone numbers, IC numbers, photos or location), keep it secure, let the parent export and erase everything.
- The babysitter appears by name. It's courteous to tell them you keep this diary.
- If LittleSteps ever became a service for other families, the PDPA would apply in full (notice and choice, security, retention, access, and the 2024 duties). The design would need a fresh review.
