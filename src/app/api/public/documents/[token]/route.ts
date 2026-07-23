import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isShareValid } from '@/lib/share/public-share'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const doc = await db.document.findFirst({
    where: { shareToken: token },
    select: {
      title: true,
      content: true,
      docType: true,
      updatedAt: true,
      shareEnabled: true,
      shareToken: true,
      shareExpireAt: true,
      author: { select: { name: true } },
    },
  })

  if (!doc || !isShareValid(doc.shareEnabled, doc.shareToken, doc.shareExpireAt)) {
    return NextResponse.json({ error: '该分享链接已失效' }, { status: 410 })
  }

  return NextResponse.json({
    title: doc.title,
    content: doc.content,
    docType: doc.docType,
    updatedAt: doc.updatedAt.toISOString(),
    author: { name: doc.author.name },
  })
}
