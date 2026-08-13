import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { server: 'src/server.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  // The Prisma client resolves its generated engine relative to its own
  // directory at runtime, so it must not be inlined into the bundle.
  external: ['@prisma/client', '.prisma/client'],
})
