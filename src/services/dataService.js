/**
 * 数据服务：协调「本地缓存 ↔ GitHub 仓库」的读写、批量提交与冲突合并
 *
 * 策略（数据安全优先）：
 * - 读：先取本地缓存立即可用，再尝试拉取 GitHub（联网即用远端覆盖），
 *   拉取失败（离线/未配置）则回退缓存。
 * - 写：变更后 debounce 合并为一次提交（批量提交机制），减少 API 调用规避限流；
 *   写入前先写本地缓存（保证离线可查看）。
 * - 同步安全（核心）：
 *   1. 推送前 ALWAYS 先读远端，获取最新 SHA + 数据
 *   2. 本地为空 + 远端有数据 → 只拉取远端，绝不推送空数据覆盖
 *   3. 两边都有数据 → 按 id 取并集合并（远端条目不会因本地缺失而被删除）
 *   4. 本地有数据 + 远端为空 → 创建新文件推送
 *   5. 两边都为空 → 不做任何操作
 * - 冲突：PUT 遇 409 时自动拉取最新远端并合并后重推（最多重试 2 次）。
 */
import { githubService } from './githubService.js'
import { localCache } from './localCache.js'
import { emptyData, sampleData } from '../utils/defaultData.js'

const ARRAY_KEYS = ['goals', 'plans', 'dailyRecords', 'consumptions', 'incomes', 'assets', 'books', 'learnings', 'reviews', 'milestones']

/** 判断数据是否为空（所有数组均无条目） */
export function isEmptyData(data) {
  if (!data) return true
  return ARRAY_KEYS.every(k => !Array.isArray(data[k]) || data[k].length === 0)
}

/** 统计数据总条目数 */
export function countItems(data) {
  if (!data) return 0
  return ARRAY_KEYS.reduce((s, k) => s + (Array.isArray(data[k]) ? data[k].length : 0), 0)
}

/** 按 id 合并两个数据集（取并集：远端条目保留，本地新增/同 id 覆盖） */
export function mergeData(remote, local) {
  const out = { ...(remote || emptyData()) }
  for (const key of ARRAY_KEYS) {
    const r = remote?.[key] || []
    const l = local?.[key] || []
    const byId = new Map(r.map(it => [it.id, it]))
    for (const it of l) byId.set(it.id, it) // 本地同 id 覆盖（本地更新优先）
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

/** 立即保存（数据安全优先：绝不空数据覆盖远端） */
export async function persist(data, meta) {
  // 先落本地缓存（保证离线可查）
  localCache.writeData(data)
  if (saving) return { ok: true, queued: true, local: true, message: '保存进行中，已排队' }

  if (!githubService.isConfigured()) {
    return { ok: true, local: true, message: '已保存到本地（未配置 GitHub 同步）' }
  }

  saving = true
  try {
    // ===== 第一步： ALWAYS 先读远端，获取最新 SHA 和数据 =====
    let remote = null
    try {
      remote = await githubService.readData()
    } catch (e) {
      // 404 = 远端文件不存在，正常；其他错误记录
      if (!String(e.message).includes('404')) console.warn('同步前读取远端失败:', e.message)
    }

    const localEmpty = isEmptyData(data)
    const remoteEmpty = !remote || isEmptyData(remote.data)

    // ===== 第二步：根据双方数据状态决定策略 =====

    // 情况 A：本地为空 + 远端有数据 → 只拉取，绝不推送空数据覆盖
    if (localEmpty && !remoteEmpty) {
      const m = { sha: remote.sha, syncedAt: Date.now(), source: 'github' }
      localCache.writeData(remote.data)
      localCache.writeMeta(m)
      return { ok: true, pulled: true, message: '检测到远端有数据，已自动拉取到本地', data: remote.data, sha: remote.sha }
    }

    // 情况 B：两边都为空 → 无需同步
    if (localEmpty && remoteEmpty) {
      return { ok: true, skipped: true, message: '没有数据可同步' }
    }

    // 情况 C：本地有数据 + 远端为空 → 创建新文件
    if (!localEmpty && remoteEmpty) {
      const sha = await githubService.writeData(data, null)
      const m = { sha, syncedAt: Date.now(), source: 'github' }
      localCache.writeMeta(m)
      return { ok: true, message: '已创建并同步到 GitHub', sha }
    }

    // 情况 D：两边都有数据 → 合并（取并集，远端条目不会被删除）后推送
    const merged = mergeData(remote.data, data)
    let sha = remote.sha
    let lastErr = null

    // 最多重试 2 次（处理 409 冲突）
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        sha = await githubService.writeData(merged, sha)
        lastErr = null
        break
      } catch (e) {
        lastErr = e
        const conflict = String(e.message).includes('409') || String(e.message).includes('conflict') || String(e.message).includes('冲突')
        if (!conflict) throw e
        // 冲突：重新读远端最新数据，再次合并后重试
        console.warn(`同步冲突（第${attempt + 1}次），重新拉取合并...`)
        try {
          remote = await githubService.readData()
          if (remote) {
            const reMerged = mergeData(remote.data, data)
            // 把合并结果写回 merged 引用
            Object.assign(merged, reMerged)
            sha = remote.sha
          }
        } catch (re) {
          console.warn('冲突重试时读取远端失败:', re.message)
        }
      }
    }
    if (lastErr) throw lastErr

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

/**
 * 强制清空云端数据（绕过安全同步逻辑）
 * 仅在用户明确确认"同时清空云端"时调用
 * 将 GitHub 上的数据文件覆盖为空数据结构
 */
export async function forceClearRemote(meta) {
  if (!githubService.isConfigured()) {
    return { ok: false, message: '未配置 GitHub，无法清空云端' }
  }
  try {
    const empty = emptyData()
    // 先读远端获取最新 SHA
    let sha = meta?.sha || null
    try {
      const remote = await githubService.readData()
      if (remote) sha = remote.sha
    } catch (e) {
      // 404 说明远端不存在，无需清空
      if (String(e.message).includes('404')) {
        return { ok: true, skipped: true, message: '云端数据文件不存在，无需清空' }
      }
      console.warn('[forceClearRemote] 读取远端失败:', e.message)
    }
    // 直接写入空数据，绕过 persist 的安全检查
    const newSha = await githubService.writeData(empty, sha)
    const m = { sha: newSha, syncedAt: Date.now(), source: 'github' }
    localCache.writeData(empty)
    localCache.writeMeta(m)
    return { ok: true, message: '云端数据已清空', sha: newSha }
  } catch (e) {
    return { ok: false, message: e.message || '清空云端失败', error: e }
  }
}
