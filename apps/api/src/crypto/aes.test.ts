import { randomBytes } from "crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./aes";

const key = randomBytes(32);

describe("aes-256-gcm", () => {
  it("round-trips plaintext", () => {
    const secret = "access-sandbox-abc123";
    expect(decrypt(key, encrypt(key, secret))).toBe(secret);
  });

  it("produces a fresh IV each time (different ciphertext for same input)", () => {
    expect(encrypt(key, "same")).not.toBe(encrypt(key, "same"));
  });

  it("fails authentication when the ciphertext is tampered with", () => {
    const payload = encrypt(key, "tamper-me");
    const [iv, tag, data] = payload.split(".");
    const flipped = data[0] === "A" ? "B" : "A";
    const tampered = [iv, tag, flipped + data.slice(1)].join(".");
    expect(() => decrypt(key, tampered)).toThrow();
  });

  it("rejects a malformed payload", () => {
    expect(() => decrypt(key, "not-valid")).toThrow();
  });
});
