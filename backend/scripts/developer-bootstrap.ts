/**
 * PRPS Developer Bootstrap Script
 *
 * Provisions the PERMANENT developer / maintenance account
 * (developer@prps.local, OWNER role) so the application owner can maintain and
 * update PRPS without using school staff credentials.
 *
 * This account is a system fixture — it is NOT trial/demo data and must never
 * be removed by a production-baseline cleanup. It is deliberately kept out of
 * `prisma/seed.ts`, application start-up and the `/api/setup/owner` flow, so a
 * fresh deployment can never acquire it silently.
 *
 * USAGE:
 *   npx tsx scripts/developer-bootstrap.ts
 *   npx tsx scripts/developer-bootstrap.ts --reset
 *   npx tsx scripts/developer-bootstrap.ts --allow-production   (NODE_ENV=production)
 *
 * The script will:
 *   1. Check if a developer account already exists (by email)
 *   2. If not, create one with a cryptographically secure random password
 *   3. Assign the OWNER role so the developer has full access
 *   4. Display the credentials ONCE (they are never stored or logged)
 *   5. Record an audit event
 *
 * Idempotent: re-running it never duplicates the account and never changes an
 * existing password (use `--reset` for that).
 *
 * RELATIONSHIP TO FIRST-OWNER SETUP:
 *   The developer account does not satisfy `ownerExists()`, so
 *   GET /api/setup/status keeps reporting `ownerExists: false` and the school
 *   can still create its operational Owner through POST /api/setup/owner.
 *
 * SECURITY:
 *   - Does NOT create a universal password or backdoor
 *   - Does NOT bypass authentication
 *   - Does NOT overwrite existing user passwords
 *   - Does NOT expose password hashes
 *   - Uses the same password hashing as normal user creation
 *   - Requires explicit developer action to run (never automatic)
 *   - Holds no permissions outside the normal OWNER RBAC model
 */

import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'
// The only src/ import: dependency-free and side-effect free, so it cannot
// drag in the Prisma client or the strict startup validation performed by
// config/env.ts (which throws when JWT_SECRET is missing in production).
import { resolveAppUrl } from '../src/config/app-url'

// ---------------------------------------------------------------------------
// Inline dependencies to avoid importing from src/ (which may require
// the full Prisma client and all transitive imports). This keeps the
// script self-contained and safe to run independently.
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set. Cannot connect to the database.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Production safety.
//
// Nothing in the application, the migration path or `prisma db seed` ever runs
// this script, so a deployment can never *silently* end up with these
// credentials. Because `developer@prps.local` IS the permanent maintenance
// account, provisioning it against a production database is a legitimate —
// but deliberately acknowledged — action, so NODE_ENV=production requires an
// explicit `--allow-production` opt-in instead of being blocked outright.
// ---------------------------------------------------------------------------
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const ALLOW_PRODUCTION = process.argv.includes('--allow-production')

if (IS_PRODUCTION && !ALLOW_PRODUCTION) {
  console.error('ERROR: refusing to provision the developer account with NODE_ENV=production.')
  console.error('This script never runs automatically (not on start-up, not on migrate, not on seed).')
  console.error('If provisioning the permanent maintenance account is your intent, re-run with:')
  console.error('  npx tsx scripts/developer-bootstrap.ts --allow-production')
  console.error('  npm run dev:bootstrap -- --allow-production')
  process.exit(1)
}

const DEVELOPER_EMAIL = 'developer@prps.local'
const DEVELOPER_FULL_NAME = 'PRPS Developer'
const DEVELOPER_STAFF_ID = 'PRPS-DEV-001'
const OWNER_ROLE_NAME = 'OWNER'
const PASSWORD_LENGTH = 18

// Application origin used for the links printed below. In development this is
// the local Vite server; with NODE_ENV=production it resolves to the deployed
// frontend, so production output never points at localhost.
const PUBLIC_APP_URL = resolveAppUrl(process.env.CLIENT_URL, IS_PRODUCTION)

/**
 * Staff/owner portal sign-in route (frontend/src/routes/index.tsx: `/login`,
 * the LoginPage protected by ProtectedRoute). This is where the OWNER-role
 * developer signs in — `/setup/owner` is the separate first-owner flow driven
 * by POST /api/setup/owner, which this account does not use.
 */
const LOGIN_ROUTE = '/login'

// ---------------------------------------------------------------------------
// Temporary password generator (copied from src/lib/temporary-password.ts
// to keep this script self-contained).
// ---------------------------------------------------------------------------

const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWERCASE = 'abcdefghijkmnpqrstuvwxyz'
const DIGITS = '23456789'
const AMBIGUOUS = new Set(['0', 'O', '1', 'l', 'I', 'o'])

function generatePassword(length = PASSWORD_LENGTH): string {
  const alphabet = `${UPPERCASE}${LOWERCASE}${DIGITS}`
  const parts: string[] = [
    UPPERCASE[randomInt(UPPERCASE.length)],
    LOWERCASE[randomInt(LOWERCASE.length)],
    DIGITS[randomInt(DIGITS.length)],
  ]

  while (parts.length < length) {
    const char = alphabet[randomInt(alphabet.length)]
    if (!AMBIGUOUS.has(char)) parts.push(char)
  }

  for (let i = parts.length - 1; i > 0; i--) {
    const swap = randomInt(i + 1)
    ;[parts[i], parts[swap]] = [parts[swap], parts[i]]
  }

  return parts.join('')
}

// ---------------------------------------------------------------------------
// Minimal Prisma client (dynamic import to avoid top-level issues)
// ---------------------------------------------------------------------------

async function createPrisma() {
  const { PrismaClient } = await import('@prisma/client')
  return new PrismaClient()
}

// ---------------------------------------------------------------------------
// Main bootstrap logic
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== PRPS Developer Bootstrap ===\n')

  const prisma = await createPrisma()

  try {
    // 1. Check if developer account already exists
    const existing = await prisma.user.findUnique({
      where: { email: DEVELOPER_EMAIL },
      include: {
        roles: { include: { role: true } },
        staffProfile: true,
      },
    })

    if (existing) {
      console.log('Developer account already exists.')
      console.log(`  Email: ${existing.email}`)
      console.log(`  Name:  ${existing.fullName}`)
      console.log(`  Status: ${existing.status}`)
      console.log(`  Roles: ${existing.roles.map((r) => r.role.name).join(', ') || 'none'}`)
      console.log(`  Staff ID: ${existing.staffProfile?.staffId ?? 'none'}`)

      if (existing.status !== 'ACTIVE') {
        console.log('\nActivating developer account...')
        await prisma.user.update({
          where: { id: existing.id },
          data: { status: 'ACTIVE' },
        })
        console.log('Developer account is now ACTIVE.')
      }

      // Repair the staff profile so isDeveloperAccount (email + DEVELOPER
      // position) keeps passing even if the profile was created elsewhere.
      if (existing.staffProfile?.position !== 'DEVELOPER') {
        console.log('\nRepairing staff profile position to DEVELOPER...')
        if (existing.staffProfile) {
          await prisma.staffProfile.update({
            where: { userId: existing.id },
            data: { position: 'DEVELOPER' },
          })
        } else {
          await prisma.staffProfile.create({
            data: {
              userId: existing.id,
              staffId: DEVELOPER_STAFF_ID,
              category: 'LEADERSHIP',
              position: 'DEVELOPER',
            },
          })
        }
        console.log('Staff profile repaired.')
      }

      console.log('\nNo password was changed. Use your existing password to log in.')
      console.log('If you forgot the password, run this script with --reset flag:')
      console.log('  npx tsx scripts/developer-bootstrap.ts --reset')
      return
    }

    // 2. Generate a secure temporary password
    const tempPassword = generatePassword()
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    // 3. Find the OWNER role
    const ownerRole = await prisma.role.findUnique({
      where: { name: OWNER_ROLE_NAME },
    })

    if (!ownerRole) {
      console.error('ERROR: OWNER role not found in the database.')
      console.error('Run "npx prisma db seed" first to initialize the RBAC catalog.')
      process.exit(1)
    }

    // 4. Create the developer account in a transaction
    await prisma.$transaction(async (tx) => {
      // Create the user
      const user = await tx.user.create({
        data: {
          fullName: DEVELOPER_FULL_NAME,
          email: DEVELOPER_EMAIL,
          passwordHash,
          status: 'ACTIVE',
          mustChangePassword: false,
        },
      })

      // Assign the OWNER role
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: ownerRole.id,
        },
      })

      // Create a staff profile
      await tx.staffProfile.create({
        data: {
          userId: user.id,
          staffId: DEVELOPER_STAFF_ID,
          category: 'LEADERSHIP',
          position: 'DEVELOPER',
        },
      })

      // Record an audit event
      await tx.auditLog.create({
        data: {
          actorUserId: null, // System-initiated
          action: 'developer.bootstrap.created',
          resourceType: 'user',
          resourceId: user.id,
          metadata: {
            email: DEVELOPER_EMAIL,
            role: OWNER_ROLE_NAME,
            staffId: DEVELOPER_STAFF_ID,
            purpose: 'developer-access',
          },
          ip: null,
        },
      })

      return user
    })

    // 5. Display credentials (shown ONCE, never stored)
    console.log('Developer account created successfully!\n')
    console.log('--- CREDENTIALS (shown once, save somewhere safe) ---')
    console.log(`  Email:    ${DEVELOPER_EMAIL}`)
    console.log(`  Password: ${tempPassword}`)
    console.log('--- END CREDENTIALS ---\n')
    console.log(`Log in at: ${PUBLIC_APP_URL}${LOGIN_ROUTE}`)
    console.log('Use the email and password above to sign in.')
    console.log('\nThis account has the OWNER role with full administrative access.')
    console.log('You may change the password after first login if desired.')

    // 6. Security reminders
    console.log('\n--- SECURITY NOTES ---')
    console.log('- This script does NOT create a universal password.')
    console.log('- This script does NOT bypass authentication.')
    console.log('- This script does NOT overwrite existing user passwords.')
    console.log('- The password above is a one-time display; it is not stored in logs.')
    console.log('- Run this script again any time to check account status.')
    console.log('- Use --reset to regenerate the password if forgotten.')
    console.log('--- END SECURITY NOTES ---')
  } finally {
    await prisma.$disconnect()
  }
}

// ---------------------------------------------------------------------------
// Password reset mode (--reset flag)
// ---------------------------------------------------------------------------

async function resetPassword() {
  console.log('=== PRPS Developer Password Reset ===\n')

  const prisma = await createPrisma()

  try {
    const existing = await prisma.user.findUnique({
      where: { email: DEVELOPER_EMAIL },
    })

    if (!existing) {
      console.error('Developer account does not exist.')
      console.error('Run this script without --reset to create one.')
      process.exit(1)
    }

    const tempPassword = generatePassword()
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          status: 'ACTIVE',
        },
      })

      await tx.auditLog.create({
        data: {
          actorUserId: null,
          action: 'developer.bootstrap.password_reset',
          resourceType: 'user',
          resourceId: existing.id,
          metadata: {
            email: DEVELOPER_EMAIL,
            purpose: 'developer-password-reset',
          },
          ip: null,
        },
      })
    })

    console.log('Password reset successfully!\n')
    console.log('--- NEW CREDENTIALS (shown once, save somewhere safe) ---')
    console.log(`  Email:    ${DEVELOPER_EMAIL}`)
    console.log(`  Password: ${tempPassword}`)
    console.log('--- END CREDENTIALS ---\n')
    console.log(`Log in at: ${PUBLIC_APP_URL}${LOGIN_ROUTE}`)
  } finally {
    await prisma.$disconnect()
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
if (args.includes('--reset')) {
  resetPassword().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
} else {
  main().catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
}
