/**
 * 提醒引擎（浏览器系统通知 + 应用内弹窗 双通道）
 *
 * 双通道策略：
 * 1. 系统通知（Notification API）—— PWA 安装后可显示在锁屏/通知栏
 * 2. 应用内弹窗（自定义事件）—— 即使没有通知权限，也能在页面内看到提醒
 *
 * 提醒类型：每日 / 每周 / 每月 / 目标到期 / 预算超支
 * 配置存储于 localCache（设备本地偏好，不上传 GitHub）。
 *
 * 限制说明：纯前端方案只能在应用打开时调度提醒；应用完全关闭后需依赖
 * Service Worker + 推送服务器（预留 Web Push 接口，未来可接入）。
 */
import { localCache } from '../services/localCache.js'
import { todayStr, monthKey } from './date.js'

let timer = null
const IN_APP_EVENT = 'qingyunzhi-reminder'

/** 获取应用基础路径（修复 GitHub Pages 子路径图标问题） */
function getBasePath() {
  return import.meta.env.BASE_URL || '/'
}

/** 发送提醒（双通道：系统通知 + 应用内弹窗） */
export function notify(title, body, opts = {}) {
  const payload = { title, body, ...opts }

  // 通道 1：系统通知（需权限）
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        body,
        icon: getBasePath() + 'icons/icon-192.png',
        badge: getBasePath() + 'icons/icon-192.png',
        vibrate: [200, 100, 200],
        tag: opts.tag || 'qingyunzhi',
        requireInteraction: opts.requireInteraction || false,
      })
      // 点击通知聚焦应用
      n.onclick = () => { window.focus(); n.close() }
    } catch (e) {
      console.warn('系统通知发送失败:', e)
    }
  }

  // 通道 2：应用内弹窗（始终触发，确保用户看得到）
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(IN_APP_EVENT, { detail: payload }))
  }
}

/** 请求通知权限 */
export async function requestNotifyPermission() {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const p = await Notification.requestPermission()
  return p === 'granted'
}

/** 获取当前通知权限状态 */
export function getNotifyPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/** 发送测试通知（用于验证提醒功能） */
export function sendTestNotification() {
  notify('青云志 · 提醒测试 🔔', '如果你看到这条通知，说明提醒功能已正常工作！\n电脑端会弹出系统通知，手机端会显示在通知栏。', { tag: 'test', requireInteraction: true })
}

/** 初始化提醒调度器（应用启动时调用） */
export function initReminders() {
  if (typeof window === 'undefined') return
  const settings = localCache.readSettings() || {}
  if (!settings.remindersEnabled) return

  const check = () => {
    const now = new Date()
    const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    // 每日提醒
    if (settings.dailyRemind && settings.dailyRemind === hm) {
      notify('青云志 · 每日提醒 ✨', '记得做今日打卡与复盘，记录成长的每一天。\n坚持就是胜利！', { tag: 'daily' })
    }

    // 每周提醒
    if (settings.weeklyRemind && settings.weeklyRemindWeekday !== undefined) {
      const wd = now.getDay()
      const target = Number(settings.weeklyRemindWeekday)
      if (wd === target && settings.weeklyRemind === hm) {
        notify('青云志 · 每周总结 📜', '本周结束了，花 10 分钟做一次复盘吧。\n看看目标完成度、收支情况、学习收获。', { tag: 'weekly' })
      }
    }

    // 每月提醒（每月 1 号）
    if (settings.monthlyRemind && settings.monthlyRemind === hm && now.getDate() === 1) {
      notify('青云志 · 月度复盘 📊', '新的一月开始了！\n查看上月收支、净资产变化、目标达成情况，制定本月计划。', { tag: 'monthly' })
    }
  }

  // 节流：同一分钟只检查一次
  let lastHm = ''
  const throttled = () => {
    const now = new Date()
    const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    if (hm !== lastHm) { lastHm = hm; check() }
  }

  clearInterval(timer)
  timer = setInterval(throttled, 20000) // 每 20 秒检查一次
  // 启动时立即检查一次
  throttled()
}

/** 停止提醒调度器 */
export function stopReminders() {
  if (timer) { clearInterval(timer); timer = null }
}

/** 目标 deadline 与预算检查（数据变更后调用） */
export function checkGoalsAndBudget(data) {
  if (typeof window === 'undefined') return
  const today = todayStr()
  const settings = localCache.readSettings() || {}

  // 目标 7 天内到期
  if (settings.deadlineRemind) {
    for (const g of (data.goals || [])) {
      if (g.status !== 'active' || !g.endDate) continue
      const days = Math.round((new Date(g.endDate) - new Date(today)) / 86400000)
      if (days >= 0 && days <= 7) {
        notify('青云志 · 目标临近 🎯', `「${g.name}」将于 ${g.endDate} 截止，还有 ${days} 天。\n加油冲刺！`, { tag: 'deadline-' + g.id })
      }
    }
  }

  // 预算超支
  if (settings.budgetAlert) {
    const budget = Number(data.user?.monthlyBudget) || 0
    if (budget > 0) {
      const mk = monthKey()
      const spent = (data.consumptions || []).filter(c => c.date.startsWith(mk)).reduce((s, c) => s + Number(c.amount || 0), 0)
      if (spent > budget) {
        notify('青云志 · 预算超支 💸', `本月已支出 ¥${spent.toLocaleString()}，超出预算 ¥${(spent - budget).toLocaleString()}。\n注意控制消费！`, { tag: 'budget' })
      }
    }
  }
}

/** 应用内提醒事件名（供组件监听） */
export const REMINDER_EVENT = IN_APP_EVENT
