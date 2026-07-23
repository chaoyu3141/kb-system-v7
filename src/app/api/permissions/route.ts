import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'

// List permissions for a knowledge base
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const kbId = searchParams.get('kbId')

  if (!kbId) return NextResponse.json({ error: '缺少知识库ID' }, { status: 400 })

  const kb = await db.knowledgeBase.findUnique({
    where: { id: kbId },
    include: {
      permissions: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      owner: { select: { id: true, name: true, email: true } },
    },
  })

  if (!kb) return NextResponse.json({ error: '知识库不存在' }, { status: 404 })
  if (kb.ownerId !== user.id) return NextResponse.json({ error: '无权管理权限' }, { status: 403 })

  return NextResponse.json({
    owner: kb.owner,
    permissions: kb.permissions,
  })
}

// Add or update permission
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { kbId, userId, role } = await req.json()

  const kb = await db.knowledgeBase.findUnique({ where: { id: kbId } })
  if (!kb) return NextResponse.json({ error: '知识库不存在' }, { status: 404 })
  if (kb.ownerId !== user.id) return NextResponse.json({ error: '无权管理权限' }, { status: 403 })

  const existing = await db.permission.findUnique({
    where: {
      userId_resourceType_resourceId: {
        userId,
        resourceType: 'knowledge_base',
        resourceId: kbId,
      },
    },
  })

  if (existing) {
    const updated = await db.permission.update({
      where: { id: existing.id },
      data: { role },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    return NextResponse.json(updated)
  }

  const perm = await db.permission.create({
    data: {
      userId,
      resourceType: 'knowledge_base',
      resourceId: kbId,
      role,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  return NextResponse.json(perm, { status: 201 })
}

// Delete permission
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const permId = searchParams.get('id')

  if (!permId) return NextResponse.json({ error: '缺少权限ID' }, { status: 400 })

  const perm = await db.permission.findUnique({ where: { id: permId } })
  if (!perm) return NextResponse.json({ error: '权限不存在' }, { status: 404 })

  const kb = await db.knowledgeBase.findUnique({ where: { id: perm.resourceId } })
  if (!kb || kb.ownerId !== user.id) {
    return NextResponse.json({ error: '无权管理权限' }, { status: 403 })
  }

  await db.permission.delete({ where: { id: permId } })
  return NextResponse.json({ ok: true })
}
