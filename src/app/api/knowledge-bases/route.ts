import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'

// List all knowledge bases the current user has access to
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const kbs = await db.knowledgeBase.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        { permissions: { some: { userId: user.id } } },
      ],
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      permissions: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { documents: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json(kbs)
}

// Create a new knowledge base
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { name, description, icon } = await req.json()

  const kb = await db.knowledgeBase.create({
    data: {
      name,
      description: description || null,
      icon: icon || '📁',
      ownerId: user.id,
      permissions: {
        create: {
          userId: user.id,
          resourceType: 'knowledge_base',
          role: 'owner',
        },
      },
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json(kb, { status: 201 })
}
