import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt);

const KEY_LEN = 64;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LEN);
  return `${salt.toString("base64url")}.${derived.toString("base64url")}`;
}

export async function verifyPassword(password, stored) {
  if (!password || !stored) return false;

  const [saltB64, hashB64] = stored.split(".");
  if (!saltB64 || !hashB64) return false;

  try {
    const salt = Buffer.from(saltB64, "base64url");
    const expected = Buffer.from(hashB64, "base64url");
    const derived = await scrypt(password, salt, expected.length);

    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
