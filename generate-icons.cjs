/**
 * Generates solid-green icon-192.png and icon-512.png in public/
 * Uses only Node.js built-ins (zlib + Buffer). No extra deps.
 * Run once: node generate-icons.js
 */
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

// Pre-compute CRC table
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff]
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.allocUnsafe(4)
  len.writeUInt32BE(data.length, 0)
  const crcInput = Buffer.concat([t, data])
  const crcBuf = Buffer.allocUnsafe(4)
  crcBuf.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([len, t, data, crcBuf])
}

function solidPNG(size, r, g, b) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // RGB
  ihdr[10] = 0 // deflate
  ihdr[11] = 0 // adaptive filter
  ihdr[12] = 0 // no interlace

  // Raw scanlines: filter byte 0 + RGB pixels
  const row = Buffer.allocUnsafe(1 + size * 3)
  row[0] = 0 // None filter
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = r
    row[2 + x * 3] = g
    row[3 + x * 3] = b
  }
  const raw = Buffer.concat(Array(size).fill(row))

  const idat = zlib.deflateSync(raw, { level: 1 })

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

// App green: #16a34a = rgb(22, 163, 74)
const R = 22, G = 163, B = 74

const out = path.join(__dirname, 'public')
fs.writeFileSync(path.join(out, 'icon-192.png'), solidPNG(192, R, G, B))
fs.writeFileSync(path.join(out, 'icon-512.png'), solidPNG(512, R, G, B))
console.log('Generated public/icon-192.png and public/icon-512.png')
