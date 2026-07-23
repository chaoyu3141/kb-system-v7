import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'

// Search users by email or name (for adding permissions)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')

  if (!q || q.trim().length === 0) {
    return NextResponse.json([])
  }

  const users = await db.user.findMany({
    where: {
      AND: [
        { id: { not: user.id } },
        {
          OR: [
            { email: { contains: q } },
            { name: { contains: q } },
          ],
        },
      ],
    },
    select: { id: true, name: true, email: true },
    take: 10,
  })

  return NextResponse.json(users)
}
