/**
 * 格式化工具：金额 / 数字 / 时长 / 百分比
 */

/** 金额格式化：12345.6 -> 12,345.60 */
export function fmtMoney(n, digits = 2) {
  const num = Number(n || 0)
  return num.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** 金额缩写：123456 -> 12.35万 */
export function fmtMoneyShort(n) {
  const num = Number(n || 0)
  const abs = Math.abs(num)
  if (abs >= 1e8) return (num / 1e8).toFixed(2) + ' 亿'
  if (abs >= 1e4) return (num / 1e4).toFixed(2) + ' 万'
  return fmtMoney(num, num % 1 === 0 ? 0 : 2)
}

/** 万元显示（用于大目标） */
export function fmtWan(n, digits = 1) {
  return (Number(n || 0) / 10000).toFixed(digits)
}

/** 整数 */
export function fmtInt(n) {
  return Math.round(Number(n || 0)).toLocaleString('zh-CN')
}

/** 百分比（0-100） */
export function fmtPercent(p, digits = 1) {
  return `${(Number(p) || 0).toFixed(digits)}%`
}

/** 时长：分钟 -> "2小时35分" */
export function fmtDuration(minutes) {
  const m = Math.round(Number(minutes || 0))
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} 小时 ${rest} 分` : `${h} 小时`
}

/** 生成唯一 id */
export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 深浅色判断 */
export function isDark(hex) {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 < 140
}

/** 颜色透明度（hex + alpha） */
export function withAlpha(hex, alpha) {
  const c = hex.replace('#', '')
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0')
  return `#${c}${a}`
}

/** 删除确认弹窗（所有删除操作必须经过此确认） */
export function confirmDelete(itemName = '该条目') {
  return window.confirm(`⚠️ 确定要删除「${itemName}」吗？\n\n此操作不可撤销，删除后将同步到云端。`)
}
