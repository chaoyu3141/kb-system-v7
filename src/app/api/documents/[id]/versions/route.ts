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

  const doc = await db.document.findUnique({ where: { id } })
  if (!doc) return NextResponse.json({ error: '文档不存在' }, { status: 404 })

  // Check access
  const kb = await db.knowledgeBase.findUnique({
    where: { id: doc.knowledgeBaseId },
    include: { permissions: true },
  })
  if (!kb) return NextResponse.json({ error: '知识库不存在' }, { status: 404 })
  const hasAccess = kb.ownerId === user.id || kb.permissions.some((p) => p.userId === user.id)
  if (!hasAccess) return NextResponse.json({ error: '无权访问' }, { status: 403 })

  const versions = await db.documentVersion.findMany({
    where: { documentId: id },
    include: {
      editor: { select: { id: true, name: true } },
    },
    orderBy: { version: 'desc' },
  })

  return NextResponse.json(versions)
}
