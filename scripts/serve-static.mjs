// Serves the built app from out/ with the same security headers Vercel adds (from vercel.json),
// so local and end-to-end tests run under the production Content-Security-Policy.
// Usage: node scripts/serve-static.mjs [port]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve("out");
const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const config = JSON.parse(await readFile("vercel.json", "utf8"));
const rules = config.headers.map((h) => ({ re: new RegExp(`^${h.source.replace(/\(\.\*\)/g, "(.*)")}$`), headers: h.headers }));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8" };

async function resolveFile(pathname) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const candidates = [join(root, safe), join(root, safe, "index.html"), join(root, `${safe}.html`)];
  for (const c of candidates) {
    if (!c.startsWith(root)) continue;
    try {
      if ((await stat(c)).isFile()) return c;
    } catch {
      /* next */
    }
  }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  for (const r of rules) {
    if (!r.re.test(url.pathname)) continue;
    for (const h of r.headers) {
      if (h.key === "Strict-Transport-Security") continue; // plain http locally
      res.setHeader(h.key, h.key === "Content-Security-Policy" ? h.value.replace("; upgrade-insecure-requests", "") : h.value);
    }
  }
  const file = await resolveFile(url.pathname);
  if (!file) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(await readFile(join(root, "404.html")).catch(() => "Not found"));
  }
  if (!res.hasHeader("Content-Type")) res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
  res.end(await readFile(file));
}).listen(port, () => console.log(`LittleSteps at http://localhost:${port}`));
