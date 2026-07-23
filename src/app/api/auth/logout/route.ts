import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { revokeSession, SESSION_COOKIE } from '@/lib/auth/session'

export async function DELETE() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  await revokeSession(token)
  cookieStore.delete(SESSION_COOKIE)
  return NextResponse.json({ ok: true })
}
