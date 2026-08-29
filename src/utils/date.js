/**
 * 日期工具：统一的日期字符串格式为 YYYY-MM-DD
 */
export function pad(n) { return String(n).padStart(2, '0') }

export function toDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayStr() { return toDateStr(new Date()) }

export function nowTime() {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function parseDate(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/** 当前时间的 ISO 字符串 */
export function nowISO() { return new Date().toISOString() }

/** 两个日期字符串相隔天数（b - a） */
export function diffDays(a, b) {
  const da = parseDate(a), db = parseDate(b)
  if (!da || !db) return 0
  return Math.round((db - da) / 86400000)
}

export function addDays(dateStr, n) {
  const d = parseDate(dateStr)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

/** 当前周（周一为起点）的起止 */
export function weekRange(dateStr = todayStr()) {
  const d = parseDate(dateStr)
  const wd = (d.getDay() + 6) % 7 // 周一=0
  const start = addDays(toDateStr(d), -wd)
  return { start, end: addDays(start, 6) }
}

/** 当前月起止 */
export function monthRange(dateStr = todayStr()) {
  const d = parseDate(dateStr)
  const start = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return { start, end: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(last)}` }
}

export function monthKey(dateStr = todayStr()) { return (dateStr || todayStr()).slice(0, 7) }

/** 当前季度起止 */
export function quarterRange(dateStr = todayStr()) {
  const d = parseDate(dateStr)
  const q = Math.floor(d.getMonth() / 3)
  const startM = q * 3 + 1
  const endM = q * 3 + 3
  const last = new Date(d.getFullYear(), endM, 0).getDate()
  return {
    start: `${d.getFullYear()}-${pad(startM)}-01`,
    end: `${d.getFullYear()}-${pad(endM)}-${pad(last)}`
  }
}

/** 当前年起止 */
export function yearRange(dateStr = todayStr()) {
  const y = (dateStr || todayStr()).slice(0, 4)
  return { start: `${y}-01-01`, end: `${y}-12-31` }
}

/** 月份中文名 */
export function monthLabel(key) {
  const [y, m] = key.split('-')
  return `${y} 年 ${Number(m)} 月`
}

/** 格式化日期为中文，如 2026年8月29日 */
export function cnDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`
}

/** 星期中文 */
export function weekdayCn(dateStr) {
  const d = parseDate(dateStr)
  if (!d) return ''
  return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
}

/** 年龄（基于生日） */
export function ageAt(birthday, dateStr = todayStr()) {
  if (!birthday) return null
  const d = parseDate(dateStr), b = parseDate(birthday)
  let age = d.getFullYear() - b.getFullYear()
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) age--
  return age
}
