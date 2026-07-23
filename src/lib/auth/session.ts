import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { randomBytes } from 'crypto'

export const SESSION_COOKIE = 'session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

function randomToken(): string {
  // 32 bytes -> 64 hex chars, ~256 bits of entropy
  return randomBytes(32).toString('hex')
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
    path: '/',
  }
}

export async function createSession(userId: string): Promise<string> {
  const token = randomToken()
  const now = new Date()
  await db.session.create({
    data: {
      token,
      userId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    },
  })
  return token
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions())
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function getCurrentUser(): Promise<{
  id: string
  email: string
  name: string
  avatar: string | null
} | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  try {
    const session = await db.session.findUnique({
      where: { token },
      select: {
        userId: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: { id: true, email: true, name: true, avatar: true } },
      },
    })

    if (!session) return null
    if (session.revokedAt) return null
    if (session.expiresAt.getTime() <= Date.now()) return null

    return session.user
  } catch {
    return null
  }
}

// Revoke a single session (logout)
export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return
  await db.session
    .updateMany({ where: { token, revokedAt: null }, data: { revokedAt: new Date() } })
    .catch(() => {})
}

// Revoke all sessions for a user (e.g. on password change)
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.session
    .updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
    .catch(() => {})
}
