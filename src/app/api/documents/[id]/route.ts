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

  const doc = await db.document.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true } },
      children: {
        orderBy: { order: 'asc' },
        select: { id: true, title: true, order: true },
      },
    },
  })

  if (!doc) return NextResponse.json({ error: '文档不存在' }, { status: 404 })

  // Check access
  const kb = await db.knowledgeBase.findUnique({
    where: { id: doc.knowledgeBaseId },
    include: { permissions: true },
  })
  if (!kb) return NextResponse.json({ error: '知识库不存在' }, { status: 404 })
  const hasAccess = kb.ownerId === user.id || kb.permissions.some((p) => p.userId === user.id)
  if (!hasAccess) return NextResponse.json({ error: '无权访问' }, { status: 403 })

  return NextResponse.json(doc)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { title, content, parentId, order } = body

  const doc = await db.document.findUnique({ where: { id } })
  if (!doc) return NextResponse.json({ error: '文档不存在' }, { status: 404 })

  // Check edit permission
  const kb = await db.knowledgeBase.findUnique({
    where: { id: doc.knowledgeBaseId },
    include: { permissions: true },
  })
  if (!kb) return NextResponse.json({ error: '知识库不存在' }, { status: 404 })
  const perm = kb.permissions.find((p) => p.userId === user.id)
  const isOwner = kb.ownerId === user.id
  const isEditor = perm?.role === 'editor' || isOwner
  if (!isEditor) return NextResponse.json({ error: '无编辑权限' }, { status: 403 })

  // Save version snapshot if content changed
  if (content !== undefined && content !== doc.content) {
    const versionCount = await db.documentVersion.count({ where: { documentId: id } })
    await db.documentVersion.create({
      data: {
        documentId: id,
        title: doc.title,
        content: doc.content || '',
        version: versionCount + 1,
        editorId: user.id,
      },
    })
  }

  const updated = await db.document.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(parentId !== undefined && { parentId: parentId || null }),
      ...(order !== undefined && { order }),
      updatedAt: new Date(),
    },
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

  const doc = await db.document.findUnique({ where: { id } })
  if (!doc) return NextResponse.json({ error: '文档不存在' }, { status: 404 })

  const kb = await db.knowledgeBase.findUnique({
    where: { id: doc.knowledgeBaseId },
    include: { permissions: true },
  })
  if (!kb) return NextResponse.json({ error: '知识库不存在' }, { status: 404 })
  const perm = kb.permissions.find((p) => p.userId === user.id)
  const isOwner = kb.ownerId === user.id
  const isEditor = perm?.role === 'editor' || isOwner
  if (!isEditor) return NextResponse.json({ error: '无编辑权限' }, { status: 403 })

  await db.document.delete({ where: { id } })

  return NextResponse.json({ ok: true })
}
