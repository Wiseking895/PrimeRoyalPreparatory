# PRPS — Database

**Phase:** 1 · **ORM:** Prisma · **Engine:** PostgreSQL

## 1. Scope (Phase 1)

Phase 1 establishes the **PostgreSQL foundation** only:

- Prisma project configured inside the `database/` package.
- A minimal `SchoolProfile` table (school identity, populated by seed from
  `@prps/shared` constants).
- Migration + migration lock committed.
- Seed script (`prisma/seed.ts`).

The full relational model is intentionally **not** created yet. Domain tables
arrive in their owning phases:

| Phase | Modules that add tables |
| --- | --- |
| 2 | auth, users, roles, permissions, staff, audit logs |
| 3 | classes, subjects, academic years, terms, teacher assignments |
| 4 | pupils, parents/guardians, admissions |
| 5 | fees, fee structures, invoices, payments, receipts |
| 6 | lesson plans, SBA, assessments |
| 7 | terminal reports |
| 8 | attendance, school location config |
| 9 | notifications, announcements, events |

## 2. Principles

- **Relational by design.** The domain is heavily relational (school, users,
  staff, teachers, pupils, classes, subjects, terms, SBA, fees, attendance).
  Never flatten it.
- **Migrations are the only way** to change schema. Never hand-edit a live
  database.
- **Foreign keys, indexes on lookup fields, unique constraints** where the
  domain requires them.
- **Transactions** for multi-step operations (e.g. fee collection → invoice →
  payment → receipt → audit).
- **Preserve history.** Prefer soft deletes/statuses (`active`, `inactive`,
  `archived`, `cancelled`) for audit-sensitive records; never hard-delete
  financial or academic history.
- **No premature columns.** Only add what a phase actually needs.
- Do not store calculated values unless there is a clear reporting/performance
  reason.

## 3. Current Schema

```prisma
model SchoolProfile {
  id           String   @id @default(cuid())
  name         String
  abbreviation String
  motto        String
  tagline      String?
  email        String?
  phone        String?
  address      String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

## 4. Workflows

Requires a reachable PostgreSQL instance. Connection string:
`DATABASE_URL` in `backend/.env` (loaded by the `database` package when
running Prisma commands from the repo root).

```bash
# regenerate the client (no DB needed)
npm run db:generate

# create/apply a new migration (needs DB)
npm run db:migrate          # prisma migrate dev

# apply committed migrations in production
npm run db:deploy           # prisma migrate deploy

# run the seed
npm run db:seed

# visual explorer
npm run db:studio
```

New tables are added with `npm run db:migrate -- --name <name>` inside the
`database` package (or `npx prisma migrate dev --name <name> -w @prps/database`).

## 5. Seed

`prisma/seed.ts` upserts the school identity profile from `@prps/shared`.
Future phases extend the seed with roles, the owner account, classes, fee
structures, etc.

## 6. Future Model Notes (design intentions)

- **Users / Roles / Permissions:** RBAC with granular permission strings
  (`school.view`, `fees.collect`, `sba.submit`, ...). Backend enforces;
  frontend hiding is never the control.
- **Teacher scoping:** SBA entry must be scoped by teacher × subject × class ×
  academic year × term. Class teachers can delegate subject entry within their
  class only.
- **Fees:** configurable fee categories and per term/year fee structures;
  invoice/payment/receipt history preserved (no destructive overwrites).
- **Attendance:** staff GPS attendance stores timestamp + coordinates +
  accuracy; the backend validates location — the frontend never decides.
- **Audit logging:** `who/what/when/record/changes` for sensitive actions; no
  ordinary user can delete audit history.
- **Profile pictures:** store references (URLs), not large binaries.
