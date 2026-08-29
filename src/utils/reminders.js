/**
 * 提醒引擎（浏览器通知）
 * - 每日 / 每周 / 每月定时提醒
 * - 目标 deadline 前 7 天提醒
 * - 预算超支提醒
 * 配置存储于 localCache（不上传到 GitHub，属设备本地偏好）。
 */
import { localCache } from '../services/localCache.js'
import { todayStr, monthKey } from './date.js'

let timer = null

export function initReminders() {
  if (typeof Notification === 'undefined') return
  const settings = localCache.readSettings() || {}
  if (!settings.remindersEnabled) return

  const check = () => {
    const now = new Date()
    const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    // 每日提醒
    if (settings.dailyRemind && settings.dailyRemind === hm) {
      notify('青云志 · 每日提醒', '记得做今日打卡与复盘，记录成长的每一天 ✨')
    }
    // 每周提醒（星期天匹配：0-6）
    if (settings.weeklyRemind && settings.weeklyRemindWeekday !== undefined) {
      const wd = now.getDay()
      const target = Number(settings.weeklyRemindWeekday)
      if (wd === target && settings.weeklyRemind === hm) {
        notify('青云志 · 每周总结', '本周结束了，花 10 分钟做一次复盘吧 📜')
      }
    }
  }

  // 已在本小时提醒过则不再重复
  let lastHm = ''
  const throttled = () => {
    const now = new Date()
    const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    if (hm !== lastHm) { lastHm = hm; check() }
  }

  clearInterval(timer)
  timer = setInterval(throttled, 30000)
}

/** 目标 deadline 与预算检查（由数据层在合适时机调用） */
export function checkGoalsAndBudget(data) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const today = todayStr()
  const settings = localCache.readSettings() || {}
  // 目标 7 天内到期
  if (settings.deadlineRemind) {
    for (const g of (data.goals || [])) {
      if (g.status !== 'active' || !g.endDate) continue
      const days = Math.round((new Date(g.endDate) - new Date(today)) / 86400000)
      if (days >= 0 && days <= 7) {
        notify('青云志 · 目标临近', `「${g.name}」将于 ${g.endDate} 截止，还有 ${days} 天 🎯`)
      }
    }
  }
  // 预算超支
  if (settings.budgetAlert) {
    const budget = Number(data.user?.monthlyBudget) || 0
    if (budget > 0) {
      const mk = monthKey()
      const spent = (data.consumptions || []).filter(c => c.date.startsWith(mk)).reduce((s, c) => s + Number(c.amount || 0), 0)
      if (spent > budget) notify('青云志 · 预算超支', `本月已支出 ¥${spent.toLocaleString()}，超出预算 ¥${(spent - budget).toLocaleString()} 💸`)
    }
  }
}

export function notify(title, body) {
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.svg' })
  }
}

export async function requestNotifyPermission() {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const p = await Notification.requestPermission()
  return p === 'granted'
}
