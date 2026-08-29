/**
 * 生成 PWA 图标（纯 Node 实现，零外部依赖）
 * 使用内置 zlib 编码 PNG，绘制古风纸鸢图标。
 * 运行：npm run icons
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'icons')

// ---------- 简易 PNG 编码 ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const tb = Buffer.from(type, 'ascii')
  const cb = Buffer.alloc(4)
  cb.writeUInt32BE(crc32(Buffer.concat([tb, data])))
  return Buffer.concat([len, tb, data, cb])
}

function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

// ---------- 画布 ----------
function makeCanvas(size) {
  const data = Buffer.alloc(size * size * 4) // 预乘 alpha 之前用直通 alpha
  return { size, data }
}

function blend(canvas, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= canvas.size || y >= canvas.size) return
  const i = (y * canvas.size + x) * 4
  const da = canvas.data[i + 3] / 255
  const outA = a + da * (1 - a)
  if (outA === 0) return
  canvas.data[i] = Math.round((r * a + canvas.data[i] * da * (1 - a)) / outA)
  canvas.data[i + 1] = Math.round((g * a + canvas.data[i + 1] * da * (1 - a)) / outA)
  canvas.data[i + 2] = Math.round((b * a + canvas.data[i + 2] * da * (1 - a)) / outA)
  canvas.data[i + 3] = Math.round(outA * 255)
}

function fillRect(canvas, x0, y0, w, h, color) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) blend(canvas, x, y, ...color)
}

// 扫描线填充多边形
function fillPoly(canvas, pts, color) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
  const minY = Math.floor(Math.min(...ys)), maxY = Math.ceil(Math.max(...ys))
  for (let y = minY; y <= maxY; y++) {
    const nodes = []
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i]
      const [x2, y2] = pts[(i + 1) % pts.length]
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        nodes.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1))
      }
    }
    nodes.sort((a, b) => a - b)
    for (let i = 0; i < nodes.length; i += 2) {
      const x0 = Math.round(nodes[i]), x1 = Math.round(nodes[i + 1] ?? nodes[i])
      for (let x = x0; x <= x1; x++) blend(canvas, x, y, ...color)
    }
  }
}

function strokeLine(canvas, x0, y0, x1, y1, width, color) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t
    for (let dx = -width / 2; dx <= width / 2; dx++)
      for (let dy = -width / 2; dy <= width / 2; dy++) blend(canvas, Math.round(x + dx), Math.round(y + dy), ...color)
  }
}

function roundedMask(canvas, radius) {
  const { size } = canvas
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      // 圆角：把四角外区域清掉
      const cx = x < radius ? radius : x > size - radius ? size - radius : x
      const cy = y < radius ? radius : y > size - radius ? size - radius : y
      const dx = x - cx, dy = y - cy
      if (dx * dx + dy * dy > radius * radius) {
        const i = (y * size + x) * 4
        canvas.data[i + 3] = 0
      }
    }
}

// ---------- 绘制纸鸢图标 ----------
function drawIcon(size) {
  const c = makeCanvas(size)
  const s = size / 100 // 以 100 为单位坐标

  // 背景：米色渐变（右上角到左下角）
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const t = (x / size + y / size) / 2
      const r = Math.round(0xfdf - t * (0xfdf - 0xf2e))
      // 用数值：from #fdf6ec (253,246,236) to #f2e3c8 (242,227,200)
      const R = Math.round(253 - t * (253 - 242))
      const G = Math.round(246 - t * (246 - 227))
      const B = Math.round(236 - t * (236 - 200))
      blend(c, x, y, R, G, B, 1)
    }

  // 右上角祥云（青）
  fillCircle(c, 82 * s, 18 * s, 6 * s, [127, 181, 168, 128])
  // 左上角桃花（粉）
  fillCircle(c, 14 * s, 24 * s, 4 * s, [232, 162, 162, 140])

  // 风筝主体（菱形）
  const kite = [50, 14, 76, 46, 50, 72, 24, 46].map(v => v * s)
  fillPoly(c, [[kite[0], kite[1]], [kite[2], kite[3]], [kite[4], kite[5]], [kite[6], kite[7]]], [232, 138, 106, 255])
  // 右下半部阴影
  fillPoly(c, [[50 * s, 46 * s], [76 * s, 46 * s], [50 * s, 72 * s]], [184, 85, 63, 150])
  // 边框
  strokePoly(c, [[kite[0], kite[1]], [kite[2], kite[3]], [kite[4], kite[5]], [kite[6], kite[7]]], 2 * s, [74, 74, 74, 255])
  // 十字骨架
  strokeLine(c, 50 * s, 14 * s, 50 * s, 72 * s, 1.6 * s, [247, 232, 208, 220])
  strokeLine(c, 24 * s, 46 * s, 76 * s, 46 * s, 1.6 * s, [247, 232, 208, 220])
  // 中心圆点
  fillCircle(c, 50 * s, 46 * s, 4.5 * s, [247, 232, 208, 255])

  // 尾巴（波浪线 + 小蝶结）
  strokeLine(c, 50 * s, 70 * s, 58 * s, 82 * s, 1.4 * s, [74, 74, 74, 230])
  strokeLine(c, 58 * s, 82 * s, 50 * s, 88 * s, 1.4 * s, [74, 74, 74, 230])
  strokeLine(c, 50 * s, 88 * s, 52 * s, 96 * s, 1.4 * s, [74, 74, 74, 230])
  fillPoly(c, [[46 * s, 90 * s], [54 * s, 90 * s], [56 * s, 94 * s], [50 * s, 98 * s], [44 * s, 94 * s]], [232, 162, 162, 255])
  strokePoly(c, [[46 * s, 90 * s], [54 * s, 90 * s], [56 * s, 94 * s], [50 * s, 98 * s], [44 * s, 94 * s]], 1 * s, [74, 74, 74, 220])

  roundedMask(c, size * 0.22)
  return c.data
}

function fillCircle(canvas, cx, cy, r, color) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) blend(canvas, x, y, ...color)
    }
}

function strokePoly(canvas, pts, width, color) {
  for (let i = 0; i < pts.length; i++) {
    strokeLine(canvas, pts[i][0], pts[i][1], pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1], width, color)
  }
}

mkdirSync(outDir, { recursive: true })
for (const size of [192, 512]) {
  const png = encodePNG(size, size, drawIcon(size))
  writeFileSync(join(outDir, `icon-${size}.png`), png)
  console.log(`✔ icon-${size}.png 生成 (${(png.length / 1024).toFixed(1)} KB)`)
}
