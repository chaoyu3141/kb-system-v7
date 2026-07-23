import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const knowledgeBaseId = formData.get('knowledgeBaseId') as string
  const parentId = formData.get('parentId') as string

  if (!file || !knowledgeBaseId) {
    return NextResponse.json({ error: '缺少文件或知识库ID' }, { status: 400 })
  }

  // Size & extension allowlist to prevent DoS / arbitrary uploads.
  const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '文件过大（上限 5MB）' }, { status: 413 })
  }
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !['md', 'markdown', 'txt', 'csv', 'html'].includes(ext)) {
    return NextResponse.json({ error: '不支持的文件类型' }, { status: 400 })
  }

  // Check access
  const kb = await db.knowledgeBase.findUnique({
    where: { id: knowledgeBaseId },
    include: { permissions: true },
  })
  if (!kb) return NextResponse.json({ error: '知识库不存在' }, { status: 404 })
  const perm = kb.permissions.find((p) => p.userId === user.id)
  const isOwner = kb.ownerId === user.id
  const isEditor = perm?.role === 'editor' || isOwner
  if (!isEditor) return NextResponse.json({ error: '无编辑权限' }, { status: 403 })

  const text = await file.text()
  const fileName = file.name

  let docType = 'doc'
  let icon = '📄'
  if (ext === 'md' || ext === 'markdown') { docType = 'markdown'; icon = '📝' }
  else if (ext === 'csv') { docType = 'sheet'; icon = '📊' }
  else if (ext === 'txt') { docType = 'doc'; icon = '📄' }
  else if (ext === 'html') { docType = 'doc'; icon = '📄' }

  // Remove extension from title
  const title = fileName.replace(/\.[^/.]+$/, '')

  const siblings = await db.document.count({
    where: { knowledgeBaseId, parentId: parentId || null },
  })

  const doc = await db.document.create({
    data: {
      title,
      content: text,
      docType,
      icon,
      knowledgeBaseId,
      parentId: parentId || null,
      authorId: user.id,
      order: siblings,
    },
  })

  return NextResponse.json(doc, { status: 201 })
}
