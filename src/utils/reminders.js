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

/** 已触发的提醒记录（防止同一分钟内重复触发），格式：{tag}-{YYYY-MM-DD-HH-mm} */
const firedReminders = new Set()

/** 获取应用基础路径（修复 GitHub Pages 子路径图标问题） */
function getBasePath() {
  return import.meta.env.BASE_URL || '/'
}

/* ==================== 提示音（Web Audio API，零依赖） ==================== */

let audioCtx = null
function getAudioContext() {
  if (typeof window === 'undefined') return null
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      audioCtx = new AC()
    }
    // 浏览器自动暂停策略：恢复上下文
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    return audioCtx
  } catch (e) {
    console.warn('[reminders] AudioContext 创建失败:', e)
    return null
  }
}

/** 播放三声柔和提示音（古风铃铛感） */
export function playReminderSound() {
  if (typeof window === 'undefined') return
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const now = ctx.currentTime
    // 三声：E5 → G5 → C6（柔和上行）
    const notes = [
      { freq: 659.25, start: 0, dur: 0.25 },   // E5
      { freq: 783.99, start: 0.18, dur: 0.25 }, // G5
      { freq: 1046.5, start: 0.36, dur: 0.4 }   // C6
    ]
    for (const n of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = n.freq
      // 包络：淡入淡出，避免爆音
      gain.gain.setValueAtTime(0, now + n.start)
      gain.gain.linearRampToValueAtTime(0.18, now + n.start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + n.start)
      osc.stop(now + n.start + n.dur + 0.05)
    }
  } catch (e) {
    console.warn('[reminders] 播放提示音失败:', e)
  }
}

/** 触发设备振动（移动端） */
export function triggerVibration() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate([200, 100, 200, 100, 300])
    } catch (e) {
      console.warn('[reminders] 振动失败:', e)
    }
  }
}

/* ==================== 系统通知 ==================== */

/**
 * 发送提醒（双通道：系统通知 + 应用内弹窗）
 * @param {string} title - 通知标题
 * @param {string} body - 通知正文
 * @param {object} opts - 选项：tag, requireInteraction, persistent（应用内弹窗是否持久）
 */
export function notify(title, body, opts = {}) {
  const payload = { title, body, ...opts }

  // 通道 1：系统通知
  let systemNotified = false
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    const notifyOptions = {
      body,
      icon: getBasePath() + 'icons/icon-192.png',
      badge: getBasePath() + 'icons/icon-192.png',
      vibrate: [200, 100, 200],
      tag: opts.tag || 'qingyunzhi',
      requireInteraction: opts.requireInteraction !== false,
      data: { url: window.location.href },
    }

    if ('serviceWorker' in navigator) {
      // 给 SW.ready 加超时，避免挂起时永远不触发兜底
      const readyPromise = navigator.serviceWorker.ready
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('ServiceWorker.ready 超时（5s）')), 5000)
      )

      Promise.race([readyPromise, timeoutPromise])
        .then(reg => {
          if (!reg) {
            console.error('[reminders] ServiceWorker 注册对象为空')
            fallbackNotify(title, notifyOptions)
            return
          }
          if (typeof reg.showNotification !== 'function') {
            console.error('[reminders] 当前 ServiceWorker 不支持 showNotification，scope:', reg.scope)
            fallbackNotify(title, notifyOptions)
            return
          }
          // showNotification 返回 Promise，必须 catch 处理拒绝
          reg.showNotification(title, notifyOptions)
            .then(() => { systemNotified = true })
            .catch(err => {
              console.error('[reminders] SW showNotification 失败:', err)
              fallbackNotify(title, notifyOptions)
            })
        })
        .catch(err => {
          console.error('[reminders] ServiceWorker.ready 失败:', err)
          fallbackNotify(title, notifyOptions)
        })
    } else {
      console.warn('[reminders] 浏览器不支持 ServiceWorker，使用 new Notification()')
      fallbackNotify(title, notifyOptions)
    }
  } else if (typeof Notification !== 'undefined') {
    console.warn('[reminders] 通知权限未授权，当前状态:', Notification.permission)
  }

  // 通道 2：应用内弹窗（始终触发，确保用户看得到）
  if (typeof window !== 'undefined') {
    // 标记系统通知是否可用，供 InAppReminder 决定是否持久显示
    payload.systemAvailable = typeof Notification !== 'undefined' && Notification.permission === 'granted'
    window.dispatchEvent(new CustomEvent(IN_APP_EVENT, { detail: payload }))
  }

  // 提醒触发时播放提示音 + 振动（双通道都触发时也播放，增强感知）
  playReminderSound()
  triggerVibration()
}

/** new Notification() 兜底（页面前台时可用） */
function fallbackNotify(title, options) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      console.warn('[reminders] 无通知权限，跳过 new Notification()')
      return
    }
    const n = new Notification(title, options)
    n.onclick = () => { window.focus(); n.close() }
    n.onerror = (e) => { console.error('[reminders] new Notification() 错误:', e) }
  } catch (e) {
    console.error('[reminders] new Notification() 异常:', e)
  }
}

/** 请求通知权限 */
export async function requestNotifyPermission() {
  if (typeof Notification === 'undefined') {
    console.error('[reminders] 浏览器不支持 Notification API')
    return false
  }
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') {
    console.warn('[reminders] 通知权限已被拒绝，需用户在浏览器设置中手动开启')
    return false
  }
  try {
    const p = await Notification.requestPermission()
    console.log('[reminders] 通知权限请求结果:', p)
    return p === 'granted'
  } catch (e) {
    console.error('[reminders] 请求通知权限异常:', e)
    return false
  }
}

/** 获取当前通知权限状态 */
export function getNotifyPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/* ==================== 通知诊断 ==================== */

/**
 * 获取通知诊断信息（用于设置页展示）
 * @returns {Promise<object>} 诊断结果
 */
export async function getNotificationDiagnostics() {
  const diag = {
    notificationSupported: typeof Notification !== 'undefined',
    permission: 'unsupported',
    serviceWorkerSupported: false,
    serviceWorkerRegistered: false,
    serviceWorkerScope: null,
    showNotificationSupported: false,
    documentFocused: typeof document !== 'undefined' ? document.hasFocus() : false,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    basePath: getBasePath(),
    errors: []
  }

  if (diag.notificationSupported) {
    diag.permission = Notification.permission
  } else {
    diag.errors.push('浏览器不支持 Notification API')
  }

  if ('serviceWorker' in navigator) {
    diag.serviceWorkerSupported = true
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('SW ready 超时')), 5000))
      ])
      if (reg) {
        diag.serviceWorkerRegistered = true
        diag.serviceWorkerScope = reg.scope
        diag.showNotificationSupported = typeof reg.showNotification === 'function'
        if (!diag.showNotificationSupported) {
          diag.errors.push('ServiceWorker 已注册但不支持 showNotification（可能是 SW 版本过旧）')
        }
      }
    } catch (e) {
      diag.errors.push('ServiceWorker 未就绪: ' + e.message)
    }
  } else {
    diag.errors.push('浏览器不支持 ServiceWorker')
  }

  if (diag.permission === 'denied') {
    diag.errors.push('通知权限已被拒绝，需在浏览器地址栏左侧图标中手动允许')
  }

  return diag
}

/* ==================== 下次提醒时间计算 ==================== */

/**
 * 计算下一次提醒的时间
 * @param {object} settings - 提醒设置
 * @returns {object} { type, time, date, countdown } 或 null
 */
export function getNextReminder(settings) {
  if (!settings || !settings.remindersEnabled) return null

  const now = new Date()
  const candidates = []

  // 每日提醒
  if (settings.dailyRemind) {
    const t = parseTime(settings.dailyRemind)
    if (t) {
      const d = new Date(now)
      d.setHours(t.h, t.m, 0, 0)
      if (d <= now) d.setDate(d.getDate() + 1)
      candidates.push({ type: '每日提醒', time: settings.dailyRemind, date: d })
    }
  }

  // 每周提醒
  if (settings.weeklyRemind && settings.weeklyRemindWeekday !== undefined) {
    const t = parseTime(settings.weeklyRemind)
    if (t) {
      const target = Number(settings.weeklyRemindWeekday)
      const d = new Date(now)
      d.setHours(t.h, t.m, 0, 0)
      let diff = target - d.getDay()
      if (diff < 0 || (diff === 0 && d <= now)) diff += 7
      d.setDate(d.getDate() + diff)
      candidates.push({ type: '每周提醒', time: settings.weeklyRemind, date: d })
    }
  }

  // 每月提醒（每月1号）
  if (settings.monthlyRemind) {
    const t = parseTime(settings.monthlyRemind)
    if (t) {
      const d = new Date(now.getFullYear(), now.getMonth(), 1, t.h, t.m, 0, 0)
      if (d <= now) d.setMonth(d.getMonth() + 1)
      candidates.push({ type: '每月提醒', time: settings.monthlyRemind, date: d })
    }
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => a.date - b.date)
  const next = candidates[0]
  const diffMs = next.date - now
  return {
    type: next.type,
    time: next.time,
    date: next.date,
    countdown: formatCountdown(diffMs)
  }
}

function parseTime(str) {
  if (!str || typeof str !== 'string') return null
  const m = str.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return { h, m }
}

function formatCountdown(ms) {
  if (ms <= 0) return '即将触发'
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60
  if (days > 0) return `${days}天 ${hours}小时 ${mins}分`
  if (hours > 0) return `${hours}小时 ${mins}分 ${secs}秒`
  if (mins > 0) return `${mins}分 ${secs}秒`
  return `${secs}秒`
}

/* ==================== 测试通知 ==================== */

/** 发送测试通知（用于验证提醒功能） */
export function sendTestNotification() {
  notify('青云志 · 提醒测试 🔔', '如果你看到这条通知，说明提醒功能已正常工作！\n电脑端会弹出系统通知，手机端会显示在通知栏。', { tag: 'test', requireInteraction: true })
}

/* ==================== 提醒调度器 ==================== */

/** 初始化提醒调度器（应用启动时调用） */
export function initReminders() {
  if (typeof window === 'undefined') return
  const settings = localCache.readSettings() || {}
  if (!settings.remindersEnabled) {
    console.log('[reminders] 提醒未启用，跳过调度')
    return
  }

  console.log('[reminders] 提醒调度器启动，设置:', JSON.stringify({
    daily: settings.dailyRemind,
    weekly: settings.weeklyRemind,
    weeklyDay: settings.weeklyRemindWeekday,
    monthly: settings.monthlyRemind
  }))

  const check = () => {
    const now = new Date()
    const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    // 每日提醒
    if (settings.dailyRemind && settings.dailyRemind === hm) {
      const fireKey = `daily-${dayKey}-${hm}`
      if (!firedReminders.has(fireKey)) {
        firedReminders.add(fireKey)
        console.log('[reminders] 触发每日提醒 at', hm)
        notify('青云志 · 每日提醒 ✨', '记得做今日打卡与复盘，记录成长的每一天。\n坚持就是胜利！', { tag: 'daily' })
      }
    }

    // 每周提醒
    if (settings.weeklyRemind && settings.weeklyRemindWeekday !== undefined) {
      const wd = now.getDay()
      const target = Number(settings.weeklyRemindWeekday)
      if (wd === target && settings.weeklyRemind === hm) {
        const fireKey = `weekly-${dayKey}-${hm}`
        if (!firedReminders.has(fireKey)) {
          firedReminders.add(fireKey)
          console.log('[reminders] 触发每周提醒 at', hm)
          notify('青云志 · 每周总结 📜', '本周结束了，花 10 分钟做一次复盘吧。\n看看目标完成度、收支情况、学习收获。', { tag: 'weekly' })
        }
      }
    }

    // 每月提醒（每月 1 号）
    if (settings.monthlyRemind && settings.monthlyRemind === hm && now.getDate() === 1) {
      const fireKey = `monthly-${dayKey}-${hm}`
      if (!firedReminders.has(fireKey)) {
        firedReminders.add(fireKey)
        console.log('[reminders] 触发每月提醒 at', hm)
        notify('青云志 · 月度复盘 📊', '新的一月开始了！\n查看上月收支、净资产变化、目标达成情况，制定本月计划。', { tag: 'monthly' })
      }
    }

    // 清理超过 2 天的 fired 记录，防止内存泄漏
    if (firedReminders.size > 100) {
      const cutoff = new Date(now.getTime() - 2 * 86400000)
      const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`
      for (const key of firedReminders) {
        const match = key.match(/-\d{4}-\d{2}-\d{2}-/)
        if (match && key < cutoffStr) firedReminders.delete(key)
      }
    }
  }

  // 节流：同一分钟只检查一次
  let lastHm = ''
  const throttled = () => {
    const now = new Date()
    const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    if (hm !== lastHm) {
      lastHm = hm
      check()
    }
  }

  clearInterval(timer)
  // 关键：重置 lastHm，确保重新初始化后立即检查能触发当前分钟的提醒
  lastHm = ''
  // 每 15 秒检查一次（更密集，减少错过概率）
  timer = setInterval(throttled, 15000)
  // 启动时立即检查一次
  throttled()

  // 页面从后台恢复时立即检查（浏览器可能暂停了 setInterval）
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        console.log('[reminders] 页面从后台恢复，立即检查提醒')
        lastHm = '' // 重置节流，确保立即检查
        throttled()
      }
    })
  }
}

/** 停止提醒调度器 */
export function stopReminders() {
  if (timer) { clearInterval(timer); timer = null }
}

/* ==================== 目标与预算检查 ==================== */

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
