#!/usr/bin/env node
/**
 * Bootstrap local development environment variables.
 *
 * Copies the committed .env.example files into real .env files (backend/.env
 * and frontend/.env) when they do not already exist. Existing .env files are
 * never overwritten.
 */
import { cpSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const targets = [
  {
    example: join(root, 'backend', '.env.example'),
    destination: join(root, 'backend', '.env'),
  },
  {
    example: join(root, 'frontend', '.env.example'),
    destination: join(root, 'frontend', '.env'),
  },
]

for (const { example, destination } of targets) {
  if (!existsSync(example)) {
    console.warn(`[setup] Skipping ${destination}: example file missing (${example}).`)
    continue
  }
  if (existsSync(destination)) {
    console.log(`[setup] Skipping ${destination}: already exists.`)
    continue
  }
  cpSync(example, destination)
  console.log(`[setup] Created ${destination} from example.`)
}

console.log('[setup] Done. Review the generated .env files before starting the dev server.')
