import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, revokeAllUserSessions, SESSION_COOKIE } from '@/lib/auth/session'
import { hashPassword, verifyPassword, isHashedPassword } from '@/lib/auth/password'
import { cookies } from 'next/headers'

// PUT /api/auth/password
// Body: { currentPassword, newPassword }
// Changes the logged-in user's password, then revokes all sessions (force re-login).
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { currentPassword, newPassword } = await req.json()
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: '请填写完整信息' }, { status: 400 })
  }
  if (String(newPassword).length < 6) {
    return NextResponse.json({ error: '新密码至少 6 位' }, { status: 400 })
  }

  const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { password: true } })
  if (!dbUser) return NextResponse.json({ error: '用户不存在' }, { status: 404 })

  // Verify current password. Support legacy plaintext (auto-migrate on success).
  const isHashed = isHashedPassword(dbUser.password)
  const ok = isHashed
    ? await verifyPassword(String(currentPassword), dbUser.password)
    : dbUser.password === String(currentPassword)

  if (!ok) {
    return NextResponse.json({ error: '当前密码错误' }, { status: 403 })
  }

  const hashed = await hashPassword(String(newPassword))
  await db.user.update({ where: { id: user.id }, data: { password: hashed } })

  // Revoke all sessions for this user — forces re-login everywhere.
  await revokeAllUserSessions(user.id)

  // Also clear the current cookie so the browser drops the session immediately.
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)

  return NextResponse.json({ ok: true })
}
