import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import {
  computeShareExpireAt,
  generateShareToken,
  type ShareExpireOption,
} from '@/lib/share/public-share'

async function getDocWithAccess(docId: string, userId: string) {
  const doc = await db.document.findUnique({ where: { id: docId } })
  if (!doc) return { error: NextResponse.json({ error: '文档不存在' }, { status: 404 }) }

  const kb = await db.knowledgeBase.findUnique({
    where: { id: doc.knowledgeBaseId },
    include: { permissions: true },
  })
  if (!kb) return { error: NextResponse.json({ error: '知识库不存在' }, { status: 404 }) }

  const perm = kb.permissions.find((p) => p.userId === userId)
  const isOwner = kb.ownerId === userId
  const isEditor = perm?.role === 'editor' || isOwner
  if (!isEditor) return { error: NextResponse.json({ error: '无编辑权限' }, { status: 403 }) }

  return { doc, kb }
}

function toShareResponse(doc: {
  shareEnabled: boolean
  shareToken: string | null
  shareExpireAt: Date | null
}) {
  return {
    shareEnabled: doc.shareEnabled,
    shareToken: doc.shareToken,
    shareExpireAt: doc.shareExpireAt?.toISOString() ?? null,
    shareUrl: doc.shareEnabled && doc.shareToken ? `/share/${doc.shareToken}` : null,
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { id } = await params
  const result = await getDocWithAccess(id, user.id)
  if ('error' in result && result.error) return result.error

  return NextResponse.json(toShareResponse(result.doc!))
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { id } = await params
  const result = await getDocWithAccess(id, user.id)
  if ('error' in result && result.error) return result.error

  const body = await req.json()
  const { shareEnabled, expireOption, updateExpireOnly: onlyUpdateExpire } = body as {
    shareEnabled?: boolean
    expireOption?: ShareExpireOption
    updateExpireOnly?: boolean
  }

  if (shareEnabled === false) {
    const updated = await db.document.update({
      where: { id },
      data: {
        shareEnabled: false,
        shareToken: null,
        shareExpireAt: null,
      },
    })
    return NextResponse.json(toShareResponse(updated))
  }

  if (shareEnabled !== true) {
    return NextResponse.json({ error: '无效请求' }, { status: 400 })
  }

  const option = expireOption ?? '1week'
  const validOptions: ShareExpireOption[] = ['1week', '1month', '3months', 'forever']
  if (!validOptions.includes(option)) {
    return NextResponse.json({ error: '无效的有效期选项' }, { status: 400 })
  }

  const existing = result.doc!
  const shouldOnlyUpdateExpire = onlyUpdateExpire === true && existing.shareEnabled && existing.shareToken

  const updated = await db.document.update({
    where: { id },
    data: shouldOnlyUpdateExpire
      ? { shareExpireAt: computeShareExpireAt(option) }
      : {
          shareEnabled: true,
          shareToken: generateShareToken(),
          shareExpireAt: computeShareExpireAt(option),
        },
  })

  return NextResponse.json(toShareResponse(updated))
}
