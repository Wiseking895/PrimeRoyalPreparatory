import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

/**
 * Append-only audit log. There are no update or delete operations for audit
 * records — the service layer exposes recording and listing only.
 */

export interface AuditRecordInput {
  actorUserId: string | null
  action: string
  resourceType?: string | null
  resourceId?: string | null
  metadata?: Prisma.InputJsonValue
  ip?: string | null
}

export function recordAudit(input: AuditRecordInput): Promise<unknown> {
  return prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata,
      ip: input.ip ?? null,
    },
  })
}

export interface AuditEntry {
  id: string
  action: string
  resourceType: string | null
  resourceId: string | null
  metadata: Prisma.JsonValue | null
  ip: string | null
  createdAt: Date
  actor: { id: string; fullName: string; email: string } | null
}

export async function listAudit(limit: number, offset: number): Promise<AuditEntry[]> {
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    include: { actorUser: { select: { id: true, fullName: true, email: true } } },
  })
  return entries.map((entry) => ({
    id: entry.id,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    metadata: entry.metadata,
    ip: entry.ip,
    createdAt: entry.createdAt,
    actor: entry.actorUser,
  }))
}

export async function countAudit(): Promise<number> {
  return prisma.auditLog.count()
}