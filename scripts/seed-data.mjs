/**
 * 初始化数据仓库的 data/user-data.json
 * 用法：npm run seed   —— 在本地 data/ 目录生成一份示例数据 JSON
 * 你可以把生成的文件提交到 GitHub 数据仓库，应用首次连接即可读到结构化数据。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sampleData } from '../src/utils/defaultData.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'data')
mkdirSync(outDir, { recursive: true })
const file = join(outDir, 'user-data.json')
writeFileSync(file, JSON.stringify(sampleData(), null, 2))
console.log(`✔ 已生成示例数据：${file}`)
console.log('  提交到你的 GitHub 数据仓库即可（路径需与设置中的 data/user-data.json 一致）。')
