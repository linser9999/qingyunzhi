/**
 * 全局数据 Store：持有全部业务数据，负责加载、变更、自动同步
 */
import { defineStore } from 'pinia'
import { loadData, persist, pullRemote, scheduleSave } from '../services/dataService.js'
import { githubService } from '../services/githubService.js'
import { localCache } from '../services/localCache.js'
import { emptyData, sampleData } from '../utils/defaultData.js'
import { uid } from '../utils/format.js'

export const COLLECTIONS = ['goals', 'plans', 'dailyRecords', 'consumptions', 'incomes', 'assets', 'books', 'learnings', 'reviews', 'milestones']

export const useDataStore = defineStore('data', {
  state: () => ({
    data: emptyData(),
    meta: { sha: null, syncedAt: null, source: null },
    loading: true,
    // sync: 'idle' | 'saving' | 'saved' | 'error' | 'local'
    sync: 'idle',
    syncMessage: '',
    syncError: '',
    connected: false, // 是否已配置 GitHub
    verified: false, // 配置是否已验证通过
    verifiedUser: null // 验证通过的 GitHub 用户名
  }),

  getters: {
    user: s => s.data.user || {},
    goals: s => s.data.goals || [],
    plans: s => s.data.plans || [],
    dailyRecords: s => s.data.dailyRecords || [],
    consumptions: s => s.data.consumptions || [],
    incomes: s => s.data.incomes || [],
    assets: s => s.data.assets || [],
    books: s => s.data.books || [],
    learnings: s => s.data.learnings || [],
    reviews: s => s.data.reviews || [],
    milestones: s => s.data.milestones || []
  },

  actions: {
    /** 初始化：加载数据（GitHub 优先，离线回退缓存） */
    async init() {
      this.loading = true
      const cfg = localCache.readConfig()
      this.connected = !!(cfg && cfg.token && cfg.owner && cfg.repo)
      // 配置存在时自动验证连接有效性
      if (this.connected) {
        try {
          const login = await githubService.verify()
          this.verified = true
          this.verifiedUser = login
        } catch (e) {
          this.verified = false
          this.verifiedUser = null
          console.warn('GitHub 配置验证失败:', e.message)
        }
      }
      const { data, meta, source, error } = await loadData()
      this.data = data
      this.meta = meta
      if (source === 'github') { this.sync = 'saved'; this.syncMessage = '已从云端载入' }
      else if (source === 'new') { this.sync = 'local'; this.syncMessage = '本地新建（首次保存将创建云端文件）' }
      else if (source === 'sample') { this.sync = 'local'; this.syncMessage = '已载入示例数据，可在设置中清除' }
      else { this.sync = 'local'; this.syncMessage = '离线模式，使用本地缓存' }
      if (error) this.syncError = error
      this.loading = false
    },

    /** 数据变更后调用：立即落本地 + 调度云端同步 */
    markDirty() {
      scheduleSave(this.data, this.meta)
      this.sync = 'saving'
      this.syncMessage = '等待同步…'
    },

    /** 立即同步 */
    async saveNow() {
      this.sync = 'saving'
      this.syncMessage = '正在同步…'
      const res = await persist(this.data, this.meta)
      if (res.ok) {
        if (res.merged) this.data = res.merged
        if (res.sha) this.meta.sha = res.sha
        this.meta.syncedAt = Date.now()
        this.sync = 'saved'
        this.syncMessage = res.message
        this.syncError = ''
      } else {
        this.sync = 'error'
        this.syncMessage = res.message
        this.syncError = res.message
      }
      return res
    },

    /** 手动从远端拉取 */
    async pull() {
      try {
        const { data, sha } = await pullRemote()
        this.data = data
        this.meta.sha = sha
        this.meta.syncedAt = Date.now()
        this.sync = 'saved'
        this.syncMessage = '已从云端拉取最新数据'
        this.syncError = ''
        return { ok: true }
      } catch (e) {
        this.sync = 'error'
        this.syncMessage = '拉取失败：' + e.message
        this.syncError = e.message
        return { ok: false, message: e.message }
      }
    },

    /** 手动推送本地覆盖云端 */
    async push() {
      return this.saveNow()
    },

    /** 保存 GitHub 配置 */
    setConfig(cfg) {
      localCache.writeConfig(cfg)
      this.connected = !!(cfg && cfg.token && cfg.owner && cfg.repo)
      this.verified = false
      this.verifiedUser = null
    },
    clearConfig() {
      localCache.clearConfig()
      this.connected = false
      this.verified = false
      this.verifiedUser = null
    },

    /* ---------------- 通用集合操作 ---------------- */
    addItem(collection, item) {
      const items = this.data[collection] || (this.data[collection] = [])
      const record = { id: uid(collection.slice(0, 1)), createdAt: new Date().toISOString(), ...item }
      items.push(record)
      this.markDirty()
      return record
    },
    updateItem(collection, id, patch) {
      const items = this.data[collection] || []
      const idx = items.findIndex(it => it.id === id)
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() }
        this.markDirty()
        return items[idx]
      }
      return null
    },
    removeItem(collection, id) {
      const items = this.data[collection] || []
      const idx = items.findIndex(it => it.id === id)
      if (idx >= 0) { items.splice(idx, 1); this.markDirty(); return true }
      return false
    },
    replaceAll(collection, items) {
      this.data[collection] = items
      this.markDirty()
    },

    /** 更新用户资料 */
    updateUser(patch) {
      this.data.user = { ...this.data.user, ...patch }
      this.markDirty()
    },

    /** 恢复为示例数据 */
    loadSample() {
      this.data = sampleData()
      this.markDirty()
    },
    /** 清空所有数据 */
    resetAll() {
      this.data = emptyData()
      this.markDirty()
    }
  }
})
