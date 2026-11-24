# Known limitations

| Limitation | Effect | What to do |
|---|---|---|
| **One phone** | Records aren't visible on your laptop or your spouse's phone. | Move them with a backup file. Sync would need a server (see "Not included"). |
| **Browser data can be cleared** | Clearing LittleSteps' site data, resetting the phone or uninstalling the browser deletes the diary. | Back up weekly (the app reminds you). On iPhone, always open it from the Home Screen icon. |
| **No passcode recovery** | A forgotten passcode means the diary on the phone can't be opened. | Write it down somewhere safe. Restore your latest backup with the passcode you had when you made it. |
| **Storage allowance** | Browsers allow about 5 MB per site. A busy year uses about 0.26 MB, so roughly 15+ years. | Settings shows how much is used. A "storage full" message appears if a save fails. |
| **Times are entered by you** | The record is only as accurate as when you tap or what the babysitter tells you. | Corrections are allowed with a reason and kept in history. |
| **Malaysia time is fixed at UTC+8** | Correct since 1982. If the offset ever changed, times would need a code update. | Covered by a test that compares with the platform's `Asia/Kuala_Lumpur` rules. |
| **One child** | The model has a single child. | Adding siblings needs a data model change (`DATA_VERSION` 2). |
| **Unlocking takes a moment** | 600,000 PBKDF2 rounds make guessing slow, and also make unlock take a short moment on older phones. | Intentional. |
| **iPhone backups use the share sheet** | iOS Home Screen apps can't download files directly. | Choose "Save to Files". |
| **Native date/time pickers vary** | iPhone and Android show different pickers. | Behaviour is the same. Tested at both screen sizes in Chromium. Not yet tested on a real iPhone (Safari) or a real Android device. |

## Not included (by decision)

- Babysitter accounts and input, shared viewing, notifications: these need a server and a data processor.
- Photos: left out to keep backups small and the data minimal.
- GPS or automatic check-in.
- AI features: the brief rules out third-party AI processing of child records.

## Not yet verified

- A live Vercel deployment (needs your Vercel account; steps in `docs/deployment.md`).
- Behaviour on a real iPhone in Safari (WebKit). Automated tests run in Chromium at iPhone and Pixel sizes.
