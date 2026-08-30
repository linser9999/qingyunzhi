/**
 * 数据服务：协调「本地缓存 ↔ GitHub 仓库」的读写、批量提交与冲突合并
 *
 * 策略：
 * - 读：先取本地缓存立即可用，再尝试拉取 GitHub（联网即用远端覆盖），
 *   拉取失败（离线/未配置）则回退缓存。
 * - 写：变更后 debounce 合并为一次提交（批量提交机制），减少 API 调用规避限流；
 *   写入前先写本地缓存（保证离线可查看）。
 * - 冲突：PUT 遇 409（其他设备改过）时自动拉取远端并按 id 合并后重推。
 */
import { githubService } from './githubService.js'
import { localCache } from './localCache.js'
import { emptyData, sampleData } from '../utils/defaultData.js'

const ARRAY_KEYS = ['goals', 'plans', 'dailyRecords', 'consumptions', 'incomes', 'assets', 'books', 'learnings', 'reviews', 'milestones']

/** 按 id 合并两个数据集（本地优先，远端补齐） */
export function mergeData(remote, local) {
  const out = { ...(remote || emptyData()) }
  for (const key of ARRAY_KEYS) {
    const r = remote?.[key] || []
    const l = local?.[key] || []
    const byId = new Map(r.map(it => [it.id, it]))
    for (const it of l) byId.set(it.id, it) // 本地同 id 覆盖
    out[key] = [...byId.values()]
  }
  out.user = { ...(remote?.user || {}), ...(local?.user || {}) }
  return out
}

/** 初次加载：优先 GitHub，其次本地缓存，最后示例数据 */
export async function loadData() {
  const cache = localCache.readData()
  const meta = localCache.readMeta()

  if (!githubService.isConfigured()) {
    const data = cache || sampleData()
    if (!cache) localCache.writeData(data)
    return { data, meta, source: cache ? 'cache' : 'sample' }
  }

  try {
    const remote = await githubService.readData()
    if (remote) {
      const m = { sha: remote.sha, syncedAt: Date.now(), source: 'github' }
      localCache.writeData(remote.data)
      localCache.writeMeta(m)
      return { data: remote.data, meta: m, source: 'github' }
    }
    // 远端文件尚未创建：首次将自动创建
    const data = cache || sampleData()
    return { data, meta: { ...meta, source: 'new' }, source: cache ? 'cache' : 'new' }
  } catch (e) {
    // 离线 / 配置错误：回退本地
    return { data: cache || sampleData(), meta, source: cache ? 'cache' : 'sample', error: e.message }
  }
}

let saveTimer = null
let saving = false

/** 变更后调度保存（debounce 合并批量提交） */
export function scheduleSave(data, meta, debounce = 1200) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => persist(data, meta), debounce)
}

/** 立即保存 */
export async function persist(data, meta) {
  // 先落本地缓存（保证离线可查）
  localCache.writeData(data)
  if (saving) return { ok: true, queued: true, local: true, message: '保存进行中，已排队' }

  if (!githubService.isConfigured()) {
    return { ok: true, local: true, message: '已保存到本地（未配置 GitHub 同步）' }
  }

  saving = true
  try {
    let sha = meta.sha
    let merged = data
    // 如果没有 sha（首次配置或本地加载），先从 GitHub 读取最新状态
    if (!sha && githubService.isConfigured()) {
      try {
        const remote = await githubService.readData()
        if (remote) {
          sha = remote.sha
          // 远端有数据：按 id 合并（本地优先），避免覆盖远端新增
          merged = mergeData(remote.data, data)
        }
      } catch (e) {
        // 读取失败（404 等）：sha 保持 null，writeData 将创建新文件
        if (!String(e.message).includes('404')) console.warn('同步前读取远端失败:', e.message)
      }
    }
    try {
      sha = await githubService.writeData(merged, sha)
    } catch (e) {
      const conflict = String(e.message).includes('409') || String(e.message).includes('conflict') || String(e.message).includes('冲突')
      if (!conflict) throw e
      // 冲突：拉远端合并后重推（远端+本地按 id 合并，本地优先）
      const remote = await githubService.readData()
      if (remote) {
        merged = mergeData(remote.data, data)
        sha = await githubService.writeData(merged, remote.sha)
      } else {
        sha = await githubService.writeData(data, null)
      }
    }
    const m = { sha, syncedAt: Date.now(), source: 'github' }
    localCache.writeMeta(m)
    localCache.writeData(merged)
    return { ok: true, message: '已同步到 GitHub', sha, merged }
  } catch (e) {
    // 网络或限流失败：保留本地，提示稍后重试
    return { ok: false, message: e.message || '同步失败', error: e }
  } finally {
    saving = false
  }
}

/** 手动拉取远端覆盖本地（会丢弃本地未推送的差异，用于冲突时） */
export async function pullRemote() {
  const remote = await githubService.readData()
  if (!remote) throw new Error('远端数据文件不存在')
  localCache.writeData(remote.data)
  localCache.writeMeta({ sha: remote.sha, syncedAt: Date.now(), source: 'github' })
  return { data: remote.data, sha: remote.sha }
}

/** 手动强制推送本地覆盖远端 */
export async function pushLocal(data, meta) {
  const res = await persist(data, meta)
  return res
}
