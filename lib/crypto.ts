import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB, OWASP recommendation
  timeCost: 2,
  parallelism: 1,
};

function getKeyMaterial(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("APP_ENCRYPTION_KEY is not defined");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must be 32 bytes base64-encoded");
  }
  return key;
}

// Derive purpose-specific subkeys from the master key.
let encKeyCache: Buffer | undefined;
let macKeyCache: Buffer | undefined;

function encryptionKey(): Buffer {
  if (!encKeyCache) {
    encKeyCache = createHash("sha256")
      .update(Buffer.concat([getKeyMaterial(), Buffer.from("pii-enc-v1")]))
      .digest();
  }
  return encKeyCache;
}

function macKey(): Buffer {
  if (!macKeyCache) {
    macKeyCache = createHash("sha256")
      .update(Buffer.concat([getKeyMaterial(), Buffer.from("lookup-mac-v1")]))
      .digest();
  }
  return macKeyCache;
}

// ── Passwords (argon2id) ─────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return argon2Hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await argon2Verify(hash, plain);
  } catch {
    return false;
  }
}

// ── PII encryption at rest (AES-256-GCM) ─────────────────

export function encryptPii(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((b) => b.toString("base64")).join(".");
}

export function decryptPii(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid encrypted payload");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Decrypt that never throws: returns null for missing, tampered or
 * anonymized ("[apagado]") values. Use for display paths; use decryptPii
 * where validity is a hard requirement.
 */
export function decryptPiiSafe(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    return decryptPii(payload);
  } catch {
    return null;
  }
}

// Deterministic lookup hash for exact-match queries on encrypted fields.
export function piiLookupHash(value: string): string {
  return createHmac("sha256", macKey())
    .update(value.trim().toLowerCase())
    .digest("hex");
}

// Normalize phone numbers for stable hashing across formats.
export function normalizePhone(phone: string): string {
  // "912 345 678", "+351 912 345 678", "912345678", "351912345678" and
  // "(+351) 912-345-678" all normalize identically. Leading zeros and
  // separators are stripped so format variations cannot create new
  // identities and bypass the abuse-prevention limits (Phase 14).
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00351")) digits = digits.slice(5);
  else if (digits.startsWith("351")) digits = digits.slice(3);
  digits = digits.replace(/^0+/, "");
  return digits;
}

// ── Tokens & hashes ──────────────────────────────────────

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
