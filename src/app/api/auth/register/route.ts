import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createSession, setSessionCookie } from '@/lib/auth/session'
import { hashPassword } from '@/lib/auth/password'

// Public registration is disabled in production by default.
// Set ENABLE_PUBLIC_REGISTER=1 to allow it (e.g. for first-time setup).
function isPublicRegisterEnabled(): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  return process.env.ENABLE_PUBLIC_REGISTER === '1'
}

export async function POST(req: NextRequest) {
  if (!isPublicRegisterEnabled()) {
    return NextResponse.json({ error: '注册已关闭，请联系管理员开通账号' }, { status: 403 })
  }

  const { email, name, password } = await req.json()
  if (!email || !password || !name) {
    return NextResponse.json({ error: '请填写完整信息' }, { status: 400 })
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: '密码至少 6 位' }, { status: 400 })
  }

  const normalizedEmail = String(email).toLowerCase()
  const existing = await db.user.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    return NextResponse.json({ error: '该邮箱已注册' }, { status: 400 })
  }

  const hashed = await hashPassword(String(password))
  const user = await db.user.create({
    data: { email: normalizedEmail, name: String(name), password: hashed },
  })

  const kb = await db.knowledgeBase.create({
    data: {
      name: `${name}的知识库`,
      description: '默认知识库',
      icon: '📚',
      ownerId: user.id,
    },
  })
  await db.permission.create({
    data: {
      userId: user.id,
      resourceType: 'knowledge_base',
      resourceId: kb.id,
      role: 'owner',
    },
  })

  const token = await createSession(user.id)
  await setSessionCookie(token)

  return NextResponse.json({ id: user.id, email: user.email, name: user.name })
}
