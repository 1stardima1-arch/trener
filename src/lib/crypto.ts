import crypto from "node:crypto";

// Encrypts OAuth tokens / API keys before they touch the database
// (DeviceConnection.accessTokenEnc/refreshTokenEnc/secretEnc) — a leaked DB
// dump should not hand out live Garmin/Polar/Athyx credentials in plaintext.
// AES-256-GCM, key from APP_ENCRYPTION_KEY (32 raw bytes, base64).

function getKey(): Buffer {
  const b64 = process.env.APP_ENCRYPTION_KEY;
  if (!b64) {
    throw new Error(
      "APP_ENCRYPTION_KEY не задан. Сгенерируй: openssl rand -base64 32 — и добавь в .env"
    );
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY должен декодироваться в ровно 32 байта (openssl rand -base64 32).");
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
