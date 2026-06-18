// Standalone script to create the first admin user.
//
//   npx ts-node src/seed.ts <username> <password>
//   (or: npm run seed -- <username> <password>)
//
// This is the only way to create the initial admin account; afterwards the admin
// panel handles user management. If a user with the given name already exists, it
// is promoted to admin and its password is reset.

import { db } from './db'
import { hashPassword } from './auth'
import { getUserByUsername } from './repo'

function main() {
  const [username, password] = process.argv.slice(2)
  if (!username || !password) {
    console.error('Usage: ts-node src/seed.ts <username> <password>')
    process.exit(1)
  }
  if (password.length < 6) {
    console.error('Password must be at least 6 characters.')
    process.exit(1)
  }

  const existing = getUserByUsername(username)
  if (existing) {
    db.prepare("UPDATE users SET password_hash = ?, role = 'admin' WHERE id = ?")
      .run(hashPassword(password), existing.id)
    console.log(`Updated existing user "${username}" -> admin, password reset.`)
  } else {
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')")
      .run(username, hashPassword(password))
    console.log(`Created admin user "${username}".`)
  }
}

main()
