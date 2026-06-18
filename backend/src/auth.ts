// Password hashing using Node's built-in scrypt (no external dependency).
// Stored format: "<saltHex>:<derivedKeyHex>".

import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 64
const SALT_BYTES = 16

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES).toString('hex')
  const derived = scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `${salt}:${derived}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(':')
  if (!salt || !key) return false
  const derived = scryptSync(password, salt, KEY_LENGTH)
  const keyBuf = Buffer.from(key, 'hex')
  if (keyBuf.length !== derived.length) return false
  return timingSafeEqual(keyBuf, derived)
}
