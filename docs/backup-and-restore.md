# Backup and restore

The diary exists only on your phone. Backups are your only copy if the phone is lost, reset, or its browser data for LittleSteps is cleared.

## Make a backup

**Settings → Download backup.**

- File name: `littlesteps-backup-YYYY-MM-DD.littlesteps`.
- It's encrypted with **the passcode you have right now**. Without that passcode the file is unreadable.
- On Android it goes to Downloads. On iPhone the share sheet opens: choose **Save to Files** (iCloud Drive) or send it to your laptop.
- Keep at least two recent copies in different places (for example Google Drive and your laptop).
- The app shows a reminder on Today when your last backup is more than 7 days old.

**Export spreadsheet (CSV)** is not a backup. It's readable by anyone and can't be restored. Use it only for your own records.

## Restore

On a new phone, after clearing data, or after **Forgot passcode → Erase**:

1. Open LittleSteps and create a passcode (it can be a new one).
2. On the setup screen, tap **Restore from backup…** (or later: **Settings → Backup → Restore from backup…**).
3. Choose the `.littlesteps` file.
4. Enter **the passcode you had when you made that backup**.
5. Check the summary (date, number of visits and entries, child's name) and tap **Replace with backup**.

Restoring replaces everything currently in the app and keeps your current passcode. Your next backup is encrypted with the current passcode.

## How it was tested

The restore path is tested end to end on every CI run (`tests/e2e/backup.spec.ts`):

1. Record a day, download a backup, and check the file contains no names.
2. Erase everything.
3. Create a **different** passcode, restore the file using the **old** passcode (a wrong passcode is refused).
4. Check the restored day is correct, reload, and unlock with the **new** passcode.

Unit tests (`tests/unit/vault.test.ts`) also check tampered and non-LittleSteps files are refused.

## Format

```json
{ "app": "littlesteps", "kind": "backup", "createdAt": "2026-11-24T10:00:00.000Z",
  "record": { "v": 1, "kdf": "PBKDF2-SHA256", "iterations": 600000, "salt": "…", "iv": "…", "ct": "…", "z": "gzip" } }
```

`ct` is AES-256-GCM over the gzip-compressed diary JSON. Backups from older app versions are upgraded on restore (see `MIGRATIONS` in `src/lib/care/schema.ts`). Backups from newer versions are refused with a message to update the app.
