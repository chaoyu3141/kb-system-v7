import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  const kbId = searchParams.get('kbId')

  if (!q || q.trim().length === 0) {
    return NextResponse.json([])
  }

  // Get all KBs the user has access to
  const kbs = await db.knowledgeBase.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        { permissions: { some: { userId: user.id } } },
      ],
      ...(kbId ? { id: kbId } : {}),
    },
    select: { id: true, name: true, icon: true },
  })

  const kbIds = kbs.map((k) => k.id)
  if (kbIds.length === 0) return NextResponse.json([])

  // Search documents by title or content
  const docs = await db.document.findMany({
    where: {
      knowledgeBaseId: { in: kbIds },
      OR: [
        { title: { contains: q } },
        { content: { contains: q } },
      ],
    },
    include: {
      knowledgeBase: { select: { id: true, name: true, icon: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })

  const results = docs.map((doc) => {
    // Extract snippet
    let snippet = ''
    if (doc.content) {
      const idx = doc.content.toLowerCase().indexOf(q.toLowerCase())
      if (idx >= 0) {
        const start = Math.max(0, idx - 30)
        const end = Math.min(doc.content.length, idx + q.length + 50)
        snippet = (start > 0 ? '...' : '') + doc.content.slice(start, end) + (end < doc.content.length ? '...' : '')
      }
    }

    return {
      id: doc.id,
      title: doc.title,
      snippet,
      knowledgeBaseId: doc.knowledgeBaseId,
      knowledgeBaseName: doc.knowledgeBase.name,
      knowledgeBaseIcon: doc.knowledgeBase.icon,
      updatedAt: doc.updatedAt,
    }
  })

  return NextResponse.json(results)
}
