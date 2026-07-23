import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') || 'md'

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

  if (format === 'md') {
    const md = `# ${doc.title}\n\n${doc.content || ''}`
    return new NextResponse(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.title)}.md"`,
      },
    })
  }

  if (format === 'html') {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${doc.title}</title></head><body><h1>${doc.title}</h1><div>${doc.content || ''}</div></body></html>`
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.title)}.html"`,
      },
    })
  }

  if (format === 'txt') {
    const text = `${doc.title}\n\n${doc.content || ''}`
    return new NextResponse(text, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.title)}.txt"`,
      },
    })
  }

  if (format === 'csv' && doc.docType === 'sheet') {
    return new NextResponse(doc.content || '', {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.title)}.csv"`,
      },
    })
  }

  return NextResponse.json({ error: '不支持的格式' }, { status: 400 })
}
