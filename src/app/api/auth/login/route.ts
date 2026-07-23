import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  revokeSession,
  SESSION_COOKIE,
} from '@/lib/auth/session'
import { hashPassword, isHashedPassword, verifyPassword } from '@/lib/auth/password'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: '请输入邮箱和密码' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { email: String(email).toLowerCase() } })
  if (!user) {
    // Avoid user enumeration timing differences
    await hashPassword(password)
    return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 })
  }

  const ok = await verifyPassword(password, user.password)

  // Migrate legacy plaintext passwords to hashed on next successful login.
  if (ok && !isHashedPassword(user.password)) {
    const newHash = await hashPassword(password)
    await db.user.update({ where: { id: user.id }, data: { password: newHash } })
  }

  if (!ok) {
    return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 })
  }

  const token = await createSession(user.id)
  await setSessionCookie(token)

  return NextResponse.json({ id: user.id, email: user.email, name: user.name, avatar: user.avatar })
}

export async function DELETE() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  await revokeSession(token)
  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}
