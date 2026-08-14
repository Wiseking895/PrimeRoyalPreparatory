#!/usr/bin/env node
/**
 * Bootstrap the frontend development environment variables.
 *
 * Copies frontend/.env.example into frontend/.env when it does not already
 * exist. Existing .env files are never overwritten.
 */
import { cpSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const example = join(appRoot, '.env.example')
const destination = join(appRoot, '.env')

if (!existsSync(example)) {
  console.warn(`[setup] Skipping ${destination}: example file missing (${example}).`)
} else if (existsSync(destination)) {
  console.log(`[setup] Skipping ${destination}: already exists.`)
} else {
  cpSync(example, destination)
  console.log(`[setup] Created ${destination} from example.`)
}