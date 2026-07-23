import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { id } = await params

  const kb = await db.knowledgeBase.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      permissions: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      documents: {
        where: { parentId: null },
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!kb) return NextResponse.json({ error: '知识库不存在' }, { status: 404 })

  // Check access
  const hasAccess = kb.ownerId === user.id || kb.permissions.some((p) => p.userId === user.id)
  if (!hasAccess) return NextResponse.json({ error: '无权访问' }, { status: 403 })

  return NextResponse.json(kb)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { id } = await params
  const { name, description, icon } = await req.json()

  const kb = await db.knowledgeBase.findUnique({ where: { id } })
  if (!kb) return NextResponse.json({ error: '知识库不存在' }, { status: 404 })
  if (kb.ownerId !== user.id) return NextResponse.json({ error: '无权修改' }, { status: 403 })

  const updated = await db.knowledgeBase.update({
    where: { id },
    data: { name, description, icon },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { id } = await params

  const kb = await db.knowledgeBase.findUnique({ where: { id } })
  if (!kb) return NextResponse.json({ error: '知识库不存在' }, { status: 404 })
  if (kb.ownerId !== user.id) return NextResponse.json({ error: '无权删除' }, { status: 403 })

  await db.knowledgeBase.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
