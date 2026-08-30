/**
 * 统计计算：财务汇总 / 目标进度 / 任务完成率 / 学习时长 / 资产曲线
 * 所有金额单位统一为「元」
 */
import { diffDays, monthKey, parseDate, toDateStr, todayStr } from './date.js'

/** 在 [start, end] 区间内的记录 */
export function inRange(item, start, end, key = 'date') {
  const d = item[key]
  return (!start || d >= start) && (!end || d <= end)
}

/* ---------------- 消费统计 ---------------- */

/** 按字段分组求和：consumptions -> { category: 金额 } */
export function sumBy(items, field) {
  const map = {}
  for (const it of items) {
    const k = it[field] || '其他'
    map[k] = (map[k] || 0) + Number(it.amount || 0)
  }
  return map
}

/** 汇总一段时间的消费 */
export function sumAmount(items) {
  return items.reduce((s, it) => s + Number(it.amount || 0), 0)
}

/** 按月聚合支出：items -> [{month, total, ...}] */
export function monthlySeries(items, months) {
  return months.map(m => ({
    month: m,
    total: items.filter(i => monthKey(i.date) === m).reduce((s, i) => s + Number(i.amount || 0), 0)
  }))
}

/** 近 n 个月的月份序列 */
export function lastMonths(n, end = todayStr()) {
  const arr = []
  const d = parseDate(end)
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 1)
    arr.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`)
  }
  return arr
}

/* ---------------- 收入 / 结余 ---------------- */

export function monthlyIncome(incomes, month) {
  return incomes.filter(i => monthKey(i.date) === month).reduce((s, i) => s + Number(i.amount || 0), 0)
}

export function monthlyExpense(consumptions, month) {
  return consumptions.filter(c => monthKey(c.date) === month).reduce((s, c) => s + Number(c.amount || 0), 0)
}

/** 结余率 */
export function savingsRate(income, expense) {
  if (!income) return 0
  return Math.max(0, (income - expense) / income)
}

/* ---------------- 目标进度 ---------------- */

/** 目标进度百分比（0-100），时间占比与数值占比取较高作为提示 */
export function goalProgress(goal, currentValue) {
  const cv = currentValue ?? goal.currentValue ?? 0
  const tv = goal.targetValue
  let byValue = tv ? Math.min(100, (cv / tv) * 100) : 0
  return Math.max(0, byValue)
}

/** 目标时间占比 */
export function goalTimeRatio(goal) {
  const total = diffDays(goal.startDate, goal.endDate)
  const now = todayStr()
  if (now >= goal.endDate) return 1
  if (now <= goal.startDate) return 0
  const past = diffDays(goal.startDate, now)
  return total ? Math.min(1, past / total) : 0
}

/* ---------------- 资产 ---------------- */

/** 资产快照净值 = 现金+基金+股票+其他 */
export function netWorth(snapshot) {
  if (!snapshot) return 0
  return Number(snapshot.cash || 0) + Number(snapshot.fund || 0) +
         Number(snapshot.stock || 0) + Number(snapshot.other || 0)
}

/** 按时间排序的净资产曲线 [{month, value}] */
export function assetCurve(assets) {
  return [...assets]
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .map(a => ({ month: a.month, value: netWorth(a) }))
}

/** 年化增长率：给定起止值与跨越月份数 */
export function annualGrowthRate(startValue, endValue, months) {
  if (!startValue || months <= 0) return 0
  const years = months / 12
  if (years <= 0) return 0
  return Math.pow(endValue / startValue, 1 / years) - 1
}

/* ---------------- 任务 / 学习 ---------------- */

/** 任务完成率（按计划项状态） */
export function planCompletion(plans) {
  if (!plans.length) return 0
  const done = plans.filter(p => p.status === 'done').length
  return (done / plans.length) * 100
}

/** 学习总时长（分钟 -> 小时） */
export function studyHours(learnings) {
  return learnings.reduce((s, l) => s + Number(l.minutes || 0), 0) / 60
}

/** 读书完成数 / 在读数（兼容中英文状态值） */
export function bookStats(books) {
  const isRead = b => b.status === 'read' || b.status === '已读'
  const isReading = b => b.status === 'reading' || b.status === '在读'
  return {
    read: books.filter(isRead).length,
    reading: books.filter(isReading).length,
    abandoned: books.filter(b => b.status === 'abandoned' || b.status === '放弃').length,
    total: books.length
  }
}

/* ---------------- 交叉分析 ---------------- */

/** 某分类在不同模式下（必需/可选/冲动/投资）的分布 */
export function categoryByMode(consumptions, category) {
  const map = { 必需: 0, 可选: 0, 冲动: 0, 投资: 0 }
  for (const c of consumptions) {
    if (c.category === category && map[c.mode] !== undefined) map[c.mode] += Number(c.amount || 0)
  }
  return map
}

/** 按星期统计某分类支出：{周一: 金额, ...} */
export function categoryByWeekday(consumptions, category) {
  const map = { 周一: 0, 周二: 0, 周三: 0, 周四: 0, 周五: 0, 周六: 0, 周日: 0 }
  for (const c of consumptions) {
    if (c.category !== category) continue
    const d = parseDate(c.date)
    if (!d) continue
    const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
    map[wd] += Number(c.amount || 0)
  }
  return map
}
