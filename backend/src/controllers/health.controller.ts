import { HttpStatus } from '../config/enums'
import type { HealthResponse } from '../config/api-contracts'
import type { Request, Response } from 'express'
import { getHealth } from '../services/health.service'

export function getHealthHandler(_req: Request, res: Response): void {
  const body: HealthResponse = {
    success: true,
    message: 'PRPS API is running',
    data: getHealth(),
  }
  res.status(HttpStatus.Ok).json(body)
}
