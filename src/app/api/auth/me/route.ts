import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET() {
  const user = await getCurrentUser()
  return NextResponse.json(user)
}

export async function DELETE() {
  const user = await getCurrentUser()
  if (user) {
    // Revoke all sessions for this user (force logout everywhere)
    await db.session
      .updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })
      .catch(() => {})
  }
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  cookieStore.delete('session')
  return NextResponse.json({ ok: true })
}
