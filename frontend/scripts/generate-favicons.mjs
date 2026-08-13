import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

const source = join(projectRoot, 'src', 'assets', 'brand', 'logo', 'LogoPrps.jpeg')
const outDir = join(projectRoot, 'public')

const resize = (size) =>
  sharp(source).resize(size, size, { fit: 'cover' }).png({ compressionLevel: 9 })

async function toPng(size) {
  return await resize(size).toBuffer()
}

function buildIco(images, sizes) {
  const count = images.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(count, 4)

  const entries = []
  let offset = 6 + count * 16
  for (const [index, image] of images.entries()) {
    const entry = Buffer.alloc(16)
    const size = sizes[index]
    entry.writeUInt8(size >= 256 ? 0 : size, 0) // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1) // height
    entry.writeUInt8(0, 2) // palette
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(image.length, 8) // bytes in resource
    entry.writeUInt32LE(offset, 12) // image offset
    entries.push(entry)
    offset += image.length
  }
  return Buffer.concat([header, ...entries, ...images])
}

async function main() {
  const faviconSizes = [16, 32, 48]
  const faviconPngs = await Promise.all(faviconSizes.map(toPng))

  await writeFile(join(outDir, 'favicon.ico'), buildIco(faviconPngs, faviconSizes))
  for (const [index, size] of faviconSizes.entries()) {
    await writeFile(join(outDir, `favicon-${size}x${size}.png`), faviconPngs[index])
  }
  await writeFile(join(outDir, 'apple-touch-icon-180x180.png'), await toPng(180))
  await writeFile(join(outDir, 'pwa-64x64.png'), await toPng(64))
  await writeFile(join(outDir, 'pwa-192x192.png'), await toPng(192))
  await writeFile(join(outDir, 'pwa-512x512.png'), await toPng(512))
  await writeFile(join(outDir, 'maskable-icon-512x512.png'), await toPng(512))

  console.log(`favicon assets generated from ${source} into ${outDir}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})