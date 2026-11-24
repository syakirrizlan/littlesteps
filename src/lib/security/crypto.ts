/**
 * Passcode-based encryption using the browser's built-in Web Crypto API.
 * PBKDF2-SHA256 (600,000 iterations) turns the passcode into an AES-256-GCM key.
 * GCM authenticates the data, so a wrong passcode or tampered file fails to open.
 * Pure functions (no storage) so they can be unit tested.
 * LittleSteps addition: the JSON is gzip-compressed before encryption (marked z: "gzip"),
 * which keeps years of diary entries well inside the browser's storage allowance.
 */

export const PBKDF2_ITERATIONS = 600_000;

export interface SealedRecord {
  v: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  ct: string; // base64 ciphertext (includes GCM tag)
  z?: "gzip"; // plaintext was gzip-compressed before encryption
}

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** Derives a non-extractable AES-GCM key from a passcode. */
export async function deriveKey(passcode: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passcode.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

const canCompress = () => typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

export async function seal(value: unknown, key: CryptoKey, salt: Uint8Array, iterations = PBKDF2_ITERATIONS): Promise<SealedRecord> {
  const iv = randomBytes(12);
  const json = enc.encode(JSON.stringify(value));
  const zip = canCompress();
  const plain = zip ? await pipe(json, new CompressionStream("gzip")) : json;
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, plain as BufferSource));
  const record: SealedRecord = { v: 1, kdf: "PBKDF2-SHA256", iterations, salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) };
  if (zip) record.z = "gzip";
  return record;
}

/** Throws if the key is wrong or the record was tampered with. */
export async function open<T>(record: SealedRecord, key: CryptoKey): Promise<T> {
  const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(record.iv) as BufferSource }, key, fromB64(record.ct) as BufferSource));
  const json = record.z === "gzip" ? await pipe(pt, new DecompressionStream("gzip")) : pt;
  return JSON.parse(dec.decode(json)) as T;
}

export function isSealedRecord(v: unknown): v is SealedRecord {
  const r = v as SealedRecord;
  return (
    !!r && r.v === 1 && r.kdf === "PBKDF2-SHA256" && Number.isInteger(r.iterations) && r.iterations >= 100_000 &&
    typeof r.salt === "string" && typeof r.iv === "string" && typeof r.ct === "string" && (r.z === undefined || r.z === "gzip")
  );
}

export const saltOf = (record: SealedRecord) => fromB64(record.salt);

/** Rough strength guide shown while creating a passcode. */
export function passcodeStrength(p: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (p.length < 6) return { score: 0, label: "Too short" };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  const words = p.trim().split(/\s+/).length;
  if (p.length >= 14 || (p.length >= 10 && kinds >= 3) || words >= 3) return { score: 3, label: "Strong" };
  if (p.length >= 8 && kinds >= 2) return { score: 2, label: "Good" };
  return { score: 1, label: "Weak" };
}
