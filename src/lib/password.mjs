import { randomBytes, scrypt as callbackScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(callbackScrypt);
const COST = 32768;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 32;
const MAX_MEMORY = 64 * 1024 * 1024;
const DUMMY_SALT = Buffer.alloc(16);
const DUMMY_HASH = Buffer.alloc(KEY_LENGTH);

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: MAX_MEMORY,
  });
  return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLELIZATION}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password, encodedHash) {
  const parts = typeof encodedHash === "string" ? encodedHash.split("$") : [];
  const validFormat =
    parts.length === 6 &&
    parts[0] === "scrypt" &&
    parts[1] === String(COST) &&
    parts[2] === String(BLOCK_SIZE) &&
    parts[3] === String(PARALLELIZATION) &&
    /^[a-f0-9]{32}$/i.test(parts[4] ?? "") &&
    /^[a-f0-9]{64}$/i.test(parts[5] ?? "");
  const salt = validFormat ? Buffer.from(parts[4], "hex") : DUMMY_SALT;
  const expected = validFormat ? Buffer.from(parts[5], "hex") : DUMMY_HASH;
  const derived = await scrypt(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
    maxmem: MAX_MEMORY,
  });
  return validFormat && timingSafeEqual(derived, expected);
}
