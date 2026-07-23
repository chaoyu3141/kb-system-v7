import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash)
  } catch {
    return false
  }
}

// Detect legacy plaintext passwords so they can be migrated on next successful login.
// bcrypt hashes always start with $2 (and are at least ~59 chars).
export function isHashedPassword(value: string | undefined | null): boolean {
  return !!value && /^\$2[abxy]\$\d{2}\$/.test(value)
}
