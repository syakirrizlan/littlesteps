# Deployment

LittleSteps is a static site. Vercel builds it from GitHub on every push to `main` and serves it over HTTPS with the headers in `vercel.json`. No environment variables, database or secrets.

**Monthly cost: RM 0** (Vercel Hobby, free `*.vercel.app` address). Optional custom domain: about RM 50–60 a year.

## First deployment (you do this; about 5 minutes)

1. Sign in at [vercel.com](https://vercel.com) with **Continue with GitHub**.
2. **Add New… → Project → Import** `syakirrizlan/littlesteps`. If it isn't listed, **Adjust GitHub App Permissions** and allow the repository.
3. Framework preset: **Next.js** (detected). Leave build settings as they are. Don't add environment variables.
4. Click **Deploy**.
5. Optional: **Settings → Deployment Protection** stays at its default. The app's address isn't secret, but it holds no data: anyone opening it sees only “Create your passcode”.

## Check the live deployment

Replace the address with yours:

```bash
URL=https://littlesteps.vercel.app
```

```bash
curl -sI "$URL/" | grep -iE "^HTTP|content-security-policy|x-frame-options|strict-transport|referrer-policy|x-robots-tag"
```

You should see `HTTP/2 200` and every header listed above.

```bash
curl -s "$URL/manifest.webmanifest" | head -c 200; echo
```

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "$URL/sw.js"
```

Then on your phone: open the address, install it to the Home Screen, create a passcode, record a test drop-off and pickup, make a backup, and check the backup file opened in a text editor shows no names. Erase it afterwards from **Settings → Erase this diary** before you start real use.

## Updates

Push to `main`. GitHub Actions runs every check (`.github/workflows/ci.yml`); Vercel deploys the new build. The installed app picks up the new version the next time it opens online. The records on the phone aren't touched by a deploy.

## Rollback

In Vercel: **Deployments → pick the last good one → ⋯ → Promote to Production**. Takes effect immediately. Data format changes are versioned (see `docs/data-model.md`), and an older app refuses data from a newer version rather than misreading it. So before rolling back over a release that bumped `DATA_VERSION`, restore a backup made with the older version.

## Logging and monitoring

There is intentionally no server logging, analytics or error reporting, because those would send information about your use off the phone. Vercel's dashboard shows deployment status and request counts for the static files only. Problems on the phone show as messages in the app (for example, “storage is full”).

## Self-hosting instead (optional)

`out/` after `npm run build` is plain files. Any HTTPS static host works (for example Caddy or nginx on Proxmox) if it sends the same headers as `vercel.json`. Run `npm start` to see them served locally by `scripts/serve-static.mjs`.
