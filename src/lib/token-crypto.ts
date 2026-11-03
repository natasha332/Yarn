import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Scrambles Google's long-lived key before it is saved, and unscrambles it when Yarn needs it.
// The secret comes from GOOGLE_TOKEN_KEY (Netlify's environment settings), never from the code.
// AES-256-GCM: anyone who changes the saved text is caught, not just blocked from reading it.

const VERSION = "v1";

function keyFrom(secret: string | undefined): Buffer {
  if (!secret || secret.length < 32) {
    throw new Error("GOOGLE_TOKEN_KEY is missing or too short (use at least 32 characters).");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptToken(plain: string, secret = process.env.GOOGLE_TOKEN_KEY): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, body].map((p) => (typeof p === "string" ? p : p.toString("base64"))).join(".");
}

export function decryptToken(saved: string, secret = process.env.GOOGLE_TOKEN_KEY): string {
  const [version, iv, tag, body] = saved.split(".");
  if (version !== VERSION || !iv || !tag || !body) throw new Error("Unreadable saved Google key.");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
}
