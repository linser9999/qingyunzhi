/**
 * GitHub Pages 部署脚本
 *
 * 用法：
 *   1) 先构建：npm run build
 *   2) 配置环境变量：
 *      GHP_REPO   = 你的 GitHub 仓库地址（如 git@github.com:user/qingyunzhi.git 或 https://github.com/user/qingyunzhi.git）
 *      GHP_BASE   = 站点根路径（子路径部署时填写，如 /qingyunzhi/；根域名部署留空即可）
 *      GHP_BRANCH = 部署分支（默认 gh-pages）
 *   3) 运行：npm run deploy
 *
 * 说明：静态站部署到 gh-pages 分支，与数据仓库可以是同一仓库的不同分支
 *      （main 分支放源码 + data/ 数据，gh-pages 分支放 dist 构建产物）。
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const repo = process.env.GHP_REPO
const base = process.env.GHP_BASE || '/'
const branch = process.env.GHP_BRANCH || 'gh-pages'
const dist = resolve(root, 'dist')

function run(cmd, cwd = root) {
  console.log(`> ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

if (!existsSync(dist)) {
  console.log('未找到 dist/，先执行构建…')
  run('npm run build')
}
if (!repo) {
  console.error('请设置环境变量 GHP_REPO，例如：')
  console.error('  $env:GHP_REPO="git@github.com:you/qingyunzhi.git"')
  process.exit(1)
}

const tmp = resolve(root, '.gh-pages-tmp')

console.log(`\n部署到 ${repo} 的 ${branch} 分支（站点根路径：${base}）\n`)

// 干净构建（含子路径 base）
process.env.VITE_BASE = base
run('npm run build')
// 把 dist 产物加进一个临时 git 目录，强制推送到 gh-pages 分支
run(`rm -rf ${tmp}`)
run(`git clone --quiet --depth 1 --branch ${branch} ${repo} ${tmp} 2>nul || git init ${tmp}`)
// 清空旧产物
run(`cd ${tmp} && git rm -rf . --quiet 2>nul || true`)
// 拷贝新产物
run(`cp -r ${dist}/* ${tmp}/`)
run(`cd ${tmp} && git add -A && git -c user.email=deploy@localhost -c user.name=deploy commit -m "deploy: ${new Date().toISOString()}" --quiet`)
run(`cd ${tmp} && git push origin HEAD:${branch} --force`)
run(`rm -rf ${tmp}`)

console.log('\n✅ 部署完成！')
console.log(`GitHub Pages 地址：https://<你的用户名>.github.io/<仓库名>/${base === '/' ? '' : base}`)
console.log('设置 Pages 时选择 gh-pages 分支 /root。')
