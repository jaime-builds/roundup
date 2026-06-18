// Generates placeholder PWA icons with no dependencies: a solid #4A90D9 square
// with a white blocky "R". Outputs public/icons/icon-192.png and icon-512.png.
// Real icons can replace these later. Run with: npm run gen-icons

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '..', 'public', 'icons')
mkdirSync(OUT, { recursive: true })

// ---- minimal PNG encoder (RGBA, 8-bit) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// ---- draw a blocky white "R" on a blue field ----
function draw(size) {
  const bg = [0x4a, 0x90, 0xd9, 0xff]
  const fg = [0xff, 0xff, 0xff, 0xff]
  const buf = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    buf[i * 4] = bg[0]
    buf[i * 4 + 1] = bg[1]
    buf[i * 4 + 2] = bg[2]
    buf[i * 4 + 3] = bg[3]
  }
  const set = (x, y) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const o = (y * size + x) * 4
    buf[o] = fg[0]
    buf[o + 1] = fg[1]
    buf[o + 2] = fg[2]
    buf[o + 3] = fg[3]
  }
  const rect = (x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y)
  }

  const S = Math.round(size * 0.5) // letter height
  const W = Math.round(S * 0.72) // letter width
  const t = Math.round(S * 0.17) // stroke thickness
  const bowlH = Math.round(S * 0.52)
  const x0 = Math.round((size - W) / 2)
  const y0 = Math.round((size - S) / 2)

  rect(x0, y0, t, S) // left stem
  rect(x0, y0, W - t, t) // top bar
  rect(x0 + W - t, y0, t, bowlH) // right upper stem
  rect(x0, y0 + bowlH - t, W - t, t) // middle bar

  // diagonal leg
  const lx0 = x0 + Math.round(W * 0.42)
  const ly0 = y0 + bowlH - t
  const lx1 = x0 + W
  const ly1 = y0 + S
  const steps = Math.max(lx1 - lx0, ly1 - ly0)
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(lx0 + ((lx1 - lx0) * i) / steps)
    const y = Math.round(ly0 + ((ly1 - ly0) * i) / steps)
    rect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t)
  }
  return buf
}

for (const size of [192, 512]) {
  const png = encodePNG(size, draw(size))
  writeFileSync(join(OUT, `icon-${size}.png`), png)
  console.log(`wrote icons/icon-${size}.png (${png.length} bytes)`)
}
