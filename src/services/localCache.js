/**
 * 本地缓存层：localStorage
 * - qyz_data  : 最近一次成功的数据快照（离线可用）
 * - qyz_meta  : 数据元信息（sha、最后同步时间、来源）
 * - qyz_cfg   : GitHub 连接配置（token 仅存本地，不落盘到仓库）
 * - qyz_ui    : UI 偏好
 */

const K_DATA = 'qyz_data_v1'
const K_META = 'qyz_meta_v1'
const K_CFG = 'qyz_gh_cfg_v1'
const K_UI = 'qyz_ui_v1'
const K_SETTINGS = 'qyz_settings_v1'

function safeGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}
function safeSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true } catch { return false }
}

export const localCache = {
  readData: () => safeGet(K_DATA, null),
  writeData: (data) => safeSet(K_DATA, data),
  readMeta: () => safeGet(K_META, { sha: null, syncedAt: null, source: null }),
  writeMeta: (meta) => safeSet(K_META, meta),

  readConfig: () => safeGet(K_CFG, null),
  writeConfig: (cfg) => safeSet(K_CFG, cfg),
  clearConfig: () => localStorage.removeItem(K_CFG),

  readSettings: () => safeGet(K_SETTINGS, {}),
  writeSettings: (s) => safeSet(K_SETTINGS, s),

  readUi: () => safeGet(K_UI, {}),
  writeUi: (u) => safeSet(K_UI, u)
}
