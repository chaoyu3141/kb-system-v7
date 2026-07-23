import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'

// List documents in a knowledge base (tree structure)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const knowledgeBaseId = searchParams.get('kbId')
  const parentId = searchParams.get('parentId')
  const all = searchParams.get('all') === 'true'

  if (!knowledgeBaseId) {
    return NextResponse.json({ error: '缺少知识库ID' }, { status: 400 })
  }

  // Check access
  const kb = await db.knowledgeBase.findUnique({
    where: { id: knowledgeBaseId },
    include: { permissions: true },
  })
  if (!kb) return NextResponse.json({ error: '知识库不存在' }, { status: 404 })
  const hasAccess = kb.ownerId === user.id || kb.permissions.some((p) => p.userId === user.id)
  if (!hasAccess) return NextResponse.json({ error: '无权访问' }, { status: 403 })

  const documents = await db.document.findMany({
    where: all
      ? { knowledgeBaseId }
      : {
          knowledgeBaseId,
          parentId: parentId === 'null' || parentId === '' ? null : parentId,
        },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      title: true,
      parentId: true,
      order: true,
      docType: true,
      icon: true,
      createdAt: true,
      updatedAt: true,
      authorId: true,
    },
  })

  return NextResponse.json(documents)
}

// Create a new document
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { title, content, knowledgeBaseId, parentId, docType, icon } = await req.json()

  // Check access - must be owner or editor
  const kb = await db.knowledgeBase.findUnique({
    where: { id: knowledgeBaseId },
    include: { permissions: true },
  })
  if (!kb) return NextResponse.json({ error: '知识库不存在' }, { status: 404 })

  const perm = kb.permissions.find((p) => p.userId === user.id)
  const isOwner = kb.ownerId === user.id
  const isEditor = perm?.role === 'editor' || isOwner
  if (!isEditor) return NextResponse.json({ error: '无编辑权限' }, { status: 403 })

  // Get order for new document
  const siblings = await db.document.count({
    where: { knowledgeBaseId, parentId: parentId || null },
  })

  const doc = await db.document.create({
    data: {
      title: title || '无标题文档',
      content: content || '',
      docType: docType || 'doc',
      icon: icon || null,
      knowledgeBaseId,
      parentId: parentId || null,
      authorId: user.id,
      order: siblings,
    },
  })

  return NextResponse.json(doc, { status: 201 })
}
