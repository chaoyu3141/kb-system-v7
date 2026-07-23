const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const db = new PrismaClient()

async function main() {
  // Read from env to avoid hardcoding secrets into source.
  const email = process.env.SEED_EMAIL
  const name = process.env.SEED_NAME || '管理员'
  const password = process.env.SEED_PASSWORD

  if (!email || !password) {
    console.error(
      '请通过环境变量提供初始账号，例如：\n' +
        '  SEED_EMAIL=you@example.com SEED_NAME=管理员 SEED_PASSWORD=your-password node scripts/seed-user.js',
    )
    process.exit(1)
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    console.log('User already exists:', existing.id)
    return
  }

  const hashed = await bcrypt.hash(password, 12)
  const user = await db.user.create({ data: { email, name, password: hashed } })
  const kb = await db.knowledgeBase.create({
    data: {
      name: `${name}的知识库`,
      description: '默认知识库',
      icon: '📚',
      ownerId: user.id,
    },
  })
  await db.permission.create({
    data: {
      userId: user.id,
      resourceType: 'knowledge_base',
      resourceId: kb.id,
      role: 'owner',
    },
  })

  console.log('Created user:', JSON.stringify({ id: user.id, email: user.email, name: user.name }))
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
