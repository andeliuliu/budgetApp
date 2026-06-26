import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM authenticated encryption for at-rest secrets (Plaid access
 * tokens). Pure functions — no framework deps — so they're trivially testable.
 *
 * Serialized form: "<iv>.<authTag>.<ciphertext>", each base64.
 */
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

export function encrypt(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

export function decrypt(key: Buffer, payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed ciphertext payload");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
