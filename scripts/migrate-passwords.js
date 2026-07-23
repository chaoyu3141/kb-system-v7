// One-time migration: hash any legacy plaintext passwords in the DB.
// Run once after deploying the security fixes:
//   node scripts/migrate-passwords.js
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const db = new PrismaClient()

function isHashed(value) {
  return typeof value === 'string' && /^\$2[abxy]\$\d{2}\$/.test(value)
}

async function main() {
  const users = await db.user.findMany({ select: { id: true, email: true, password: true } })
  let migrated = 0
  for (const u of users) {
    if (isHashed(u.password)) continue
    const hashed = await bcrypt.hash(u.password, 12)
    await db.user.update({ where: { id: u.id }, data: { password: hashed } })
    migrated++
    console.log('migrated', u.email)
  }
  console.log(`Done. Migrated ${migrated} user(s).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
