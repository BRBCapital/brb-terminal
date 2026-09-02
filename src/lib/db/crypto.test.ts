import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret, isEncrypted } from "./crypto";

describe("secret encryption", () => {
  it("round-trips a value through encrypt/decrypt", () => {
    const secret = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789";
    const enc = encryptSecret(secret);
    expect(enc).not.toContain(secret);
    expect(isEncrypted(enc)).toBe(true);
    expect(decryptSecret(enc)).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("ngm_livekey_1234567890");
    const b = encryptSecret("ngm_livekey_1234567890");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it("passes through legacy plaintext untouched", () => {
    expect(isEncrypted("ngm_plaintext")).toBe(false);
    expect(decryptSecret("ngm_plaintext")).toBe("ngm_plaintext");
  });

  it("rejects tampered ciphertext (GCM auth tag)", () => {
    const enc = encryptSecret("top-secret");
    // Deterministically flip a real byte of the ciphertext body (decode → XOR →
    // re-encode) so the mutation always changes the plaintext bytes — a naive
    // single-base64-char flip can be a no-op at a 6-bit boundary.
    const [prefix, ivB64, tagB64, dataB64] = enc.split(":");
    const data = Buffer.from(dataB64, "base64");
    data[0] ^= 0xff;
    const tampered = [prefix, ivB64, tagB64, data.toString("base64")].join(":");
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
