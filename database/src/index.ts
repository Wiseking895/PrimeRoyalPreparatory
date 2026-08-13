export {}

/**
 * Shared Prisma client instance.
 *
 * NOTE: Phase 1 (public website) does not read from the database yet, so no
 * backend service imports this module. It is published as part of the data
 * layer foundation and will be consumed by repositories from Phase 2 onward.
 *
 * TODO(phase-2): export a configured `PrismaClient` singleton from here and
 * wire it into backend repositories.
 */
