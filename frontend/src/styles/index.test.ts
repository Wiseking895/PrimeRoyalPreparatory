import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8')

function ruleBody(selector: string): string {
  const pattern = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`)
  return pattern.exec(css)?.[1] ?? ''
}

describe('global text wrapping rules', () => {
  it('keeps buttons on one line', () => {
    expect(ruleBody('button')).toMatch(/white-space:\s*nowrap/)
  })

  it('keeps table header cells on one line', () => {
    expect(ruleBody('table thead th')).toMatch(/white-space:\s*nowrap/)
  })

  it('never applies a global no-wrap to prose elements', () => {
    expect(ruleBody('p')).not.toMatch(/white-space:\s*nowrap/)
    expect(ruleBody('h1')).not.toMatch(/white-space:\s*nowrap/)
    expect(ruleBody('td')).not.toMatch(/white-space:\s*nowrap/)
  })
})
