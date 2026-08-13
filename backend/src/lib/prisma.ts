import { PrismaClient } from '@prisma/client'

/**
 * Shared Prisma client for the backend process. Consumed by all data-access
 * services. Tests mock this module with `vi.mock('../lib/prisma')`.
 */
export const prisma = new PrismaClient()