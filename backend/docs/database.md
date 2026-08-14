# PRPS — Database

**Phase:** 2 · **ORM:** Prisma · **Engine:** PostgreSQL

## 1. Scope

The PostgreSQL data layer lives **inside the backend** (`backend/prisma/`). The
backend is the only process that reads or writes the database; the frontend
never touches it.

- Prisma project configured in the backend workspace.
- `SchoolProfile` table (school identity, populated by seed from the backend
  school constants).
- Phase 2: users, roles, permissions, staff profiles and audit logs.
- Migration + migration lock committed under `prisma/migrations/`.
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

The schema is defined in `prisma/schema.prisma`. Phase 2 models:
`SchoolProfile`, `Role`, `Permission`, `RolePermission`, `User`, `UserRole`,
`StaffProfile`, `AuditLog`, and the `AccountStatus` enum.

## 4. Workflows

Requires a reachable PostgreSQL instance. Connection string:
`DATABASE_URL` in `.env` (loaded by Prisma when running commands from the
`backend` workspace or the repo root).

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

New tables are added with `npm run db:migrate -- --name <name>` (runs inside
the `backend` workspace).

## 5. Seed

`prisma/seed.ts` upserts the school identity profile from the backend
school constants and the roles/permissions catalog from
`src/rbac/catalog.ts`. The Owner account is intentionally NOT seeded —
the first Owner is always created through the secure initial setup flow
(`POST /api/setup/owner`). Future phases extend the seed with classes, fee
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