<script setup>
import { ref, computed, onMounted, onBeforeUnmount, reactive } from 'vue'
import { useDataStore } from '../stores/dataStore.js'
import { useUiStore } from '../stores/uiStore.js'
import Card from '../components/common/Card.vue'
import Modal from '../components/common/Modal.vue'
import { githubService } from '../services/githubService.js'
import { localCache } from '../services/localCache.js'
import { exportJSON } from '../utils/export.js'
import {
  requestNotifyPermission, checkGoalsAndBudget, initReminders,
  sendTestNotification, getNotifyPermission, getNotificationDiagnostics,
  getNextReminder, playReminderSound
} from '../utils/reminders.js'
import { usePWAInstall } from '../composables/usePWAInstall.js'
import { ageAt, todayStr } from '../utils/date.js'

const store = useDataStore()
const ui = useUiStore()

const profile = ref({})
const gh = ref({})
const testing = ref(false)
const settings = ref({})
const importInput = ref(null)

const { canInstall, isInstalled, install } = usePWAInstall()

/* ---------- 通知权限 ---------- */
const notifyPermission = computed(() => getNotifyPermission())
const permissionLabel = computed(() => {
  const map = { granted: '✅ 已授权', denied: '❌ 已拒绝（需在浏览器设置中开启）', default: '⚠️ 未授权', unsupported: '❌ 浏览器不支持' }
  return map[notifyPermission.value] || notifyPermission.value
})

/* ---------- 通知诊断 ---------- */
const diag = reactive({
  loading: false,
  notificationSupported: null,
  permission: 'unknown',
  serviceWorkerSupported: null,
  serviceWorkerRegistered: null,
  serviceWorkerScope: null,
  showNotificationSupported: null,
  documentFocused: null,
  errors: []
})

async function runDiagnostics() {
  diag.loading = true
  try {
    const d = await getNotificationDiagnostics()
    Object.assign(diag, d)
  } finally {
    diag.loading = false
  }
}

async function reRequestPermission() {
  const ok = await requestNotifyPermission()
  if (ok) {
    ui.toast('通知权限已开启 ✅', 'success')
    // 权限变更后重新初始化提醒
    if (settings.value.remindersEnabled) initReminders()
  } else {
    ui.toast('未能获得通知权限。若已被拒绝，请在浏览器地址栏左侧🔒图标中手动允许', 'warning')
  }
  await runDiagnostics()
}

/* ---------- 下次提醒倒计时 ---------- */
const nextReminder = ref(null)
let countdownTimer = null

function updateNextReminder() {
  nextReminder.value = getNextReminder(settings.value)
}

/* ---------- 清空数据确认对话框 ---------- */
const showResetModal = ref(false)
const resetStep = ref(1) // 1: 选择范围, 2: 云端二次确认
const resetScope = ref('local') // 'local' | 'cloud'
const resetConfirmText = ref('')
const resetting = ref(false)
const RESET_CONFIRM_WORD = '清空'

function openResetModal() {
  resetStep.value = 1
  resetScope.value = 'local'
  resetConfirmText.value = ''
  resetting.value = false
  showResetModal.value = true
}

function chooseResetScope(scope) {
  resetScope.value = scope
  if (scope === 'cloud') {
    resetStep.value = 2 // 进入二次确认
  } else {
    doResetLocal()
  }
}

function doResetLocal() {
  resetting.value = true
  try {
    store.resetAll()
    ui.toast('已清空本机数据。GitHub 云端数据保留，下次同步将从云端恢复', 'warning')
  } finally {
    resetting.value = false
    showResetModal.value = false
  }
}

async function doResetCloud() {
  if (resetConfirmText.value !== RESET_CONFIRM_WORD) {
    ui.toast(`请输入「${RESET_CONFIRM_WORD}」确认清空云端数据`, 'error')
    return
  }
  resetting.value = true
  try {
    const res = await store.resetAllAndCloud()
    if (res.ok) {
      ui.toast('本地与云端数据均已清空（不可恢复）', 'warning')
    } else {
      ui.toast('清空云端失败：' + (res.message || '未知错误'), 'error')
    }
  } finally {
    resetting.value = false
    showResetModal.value = false
  }
}

function cancelReset() {
  if (resetting.value) return
  showResetModal.value = false
}

/* ---------- 生命周期 ---------- */
onMounted(() => {
  const u = store.user
  profile.value = { name: u.name || '', birthday: u.birthday || '', targetAge: u.targetAge || 40, baselineSalary: u.baselineSalary || 0, monthlyBudget: u.monthlyBudget || 0 }
  const c = localCache.readConfig() || {}
  gh.value = { token: c.token || '', owner: c.owner || '', repo: c.repo || '', branch: c.branch || 'main', path: c.path || 'data/user-data.json' }
  settings.value = localCache.readSettings() || {}

  // 运行通知诊断
  runDiagnostics()
  // 更新下次提醒
  updateNextReminder()
  // 每秒更新倒计时
  countdownTimer = setInterval(updateNextReminder, 1000)
})

onBeforeUnmount(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})

/* ---------- 个人资料 ---------- */
function saveProfile() {
  store.updateUser({
    name: profile.value.name || '追梦人',
    birthday: profile.value.birthday,
    targetAge: Number(profile.value.targetAge) || 40,
    baselineSalary: Number(profile.value.baselineSalary) || 0,
    monthlyBudget: Number(profile.value.monthlyBudget) || 0
  })
  ui.toast('个人资料已保存', 'success')
}

/* ---------- GitHub ---------- */
async function testGitHub() {
  testing.value = true
  try {
    localCache.writeConfig({ ...gh.value })
    const login = await githubService.verify()
    ui.toast(`连接成功：@${login}，仓库可访问 ✅`, 'success')
  } catch (e) {
    ui.toast('连接失败：' + e.message, 'error')
  } finally { testing.value = false }
}

function saveGitHub() {
  store.setConfig({ ...gh.value })
  ui.toast('已保存 GitHub 配置，正在同步…', 'success')
  store.saveNow().then(res => {
    if (!res.ok) ui.toast('同步失败：' + res.message, 'error')
  })
}

function clearGitHub() {
  store.clearConfig()
  gh.value = { token: '', owner: '', repo: '', branch: 'main', path: 'data/user-data.json' }
  ui.toast('已清除云端配置，进入本地模式', 'success')
}

/* ---------- 数据管理 ---------- */
function exportData() {
  exportJSON(`青云志数据备份-${todayStr()}.json`, store.data)
  ui.toast('已导出 JSON 备份', 'success')
}
function onImportFile(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result)
      if (!data || !Array.isArray(data.goals)) throw new Error('格式不正确')
      store.data = data
      store.markDirty()
      ui.toast('已导入数据并开始同步', 'success')
    } catch (err) {
      ui.toast('导入失败：' + err.message, 'error')
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}
function loadSample() {
  store.loadSample()
  ui.toast('已载入示例数据', 'success')
}

/* ---------- 提醒 ---------- */
async function enableReminders() {
  const ok = await requestNotifyPermission()
  if (ok) {
    settings.value.remindersEnabled = true
    localCache.writeSettings(settings.value)
    initReminders()
    updateNextReminder()
    ui.toast('已开启浏览器提醒 🔔', 'success')
  } else {
    ui.toast('未获得通知权限，请允许浏览器通知。应用内弹窗仍会提醒。', 'warning')
  }
  runDiagnostics()
}
function saveReminders() {
  localCache.writeSettings(settings.value)
  initReminders()
  updateNextReminder()
  ui.toast('提醒设置已保存', 'success')
}
function testNotify() {
  sendTestNotification()
  ui.toast('已发送测试通知，请注意查看系统通知或页面弹窗', 'success')
}
function testSound() {
  playReminderSound()
  ui.toast('已播放提示音 🔊', 'success')
}
async function installApp() {
  const ok = await install()
  if (ok) ui.toast('安装成功！可从桌面/主屏幕打开', 'success')
  else ui.toast('安装已取消或浏览器不支持', 'warning')
}
</script>

<template>
  <div>
    <h1 class="page-title">⚙️ 设置</h1>
    <p class="page-sub">个人资料 · 云同步 · 数据管理 · 提醒通知</p>

    <div class="grid mb-16" style="grid-template-columns: 1fr 1fr;">
      <Card title="个人资料" icon="👤">
        <div class="form-grid">
          <div class="form-field"><label>昵称</label><input v-model="profile.name" /></div>
          <div class="form-field"><label>生日</label><input type="date" v-model="profile.birthday" /></div>
          <div class="form-field"><label>目标年龄（财富自由）</label><input type="number" v-model="profile.targetAge" /></div>
          <div class="form-field"><label>基准月薪</label><input type="number" v-model="profile.baselineSalary" /></div>
          <div class="form-field full"><label>月度预算（元）</label><input type="number" v-model="profile.monthlyBudget" placeholder="2000" /></div>
        </div>
        <div v-if="profile.birthday" class="small muted mt-8">当前年龄：{{ ageAt(profile.birthday, todayStr()) }} 岁</div>
        <button class="btn btn-block mt-16" @click="saveProfile">保存资料</button>
      </Card>

      <Card title="GitHub 云同步" icon="☁️">
        <p class="small muted mb-12">数据存储在你自己的 GitHub 仓库 <code>data/user-data.json</code>，跨设备完全一致。Token 仅保存在本机浏览器。</p>
        <div class="form-grid">
          <div class="form-field full"><label>Personal Access Token</label><input v-model="gh.token" type="password" placeholder="ghp_…" /></div>
          <div class="form-field"><label>Owner（用户名）</label><input v-model="gh.owner" /></div>
          <div class="form-field"><label>仓库名</label><input v-model="gh.repo" /></div>
          <div class="form-field"><label>分支</label><input v-model="gh.branch" /></div>
          <div class="form-field"><label>数据文件路径</label><input v-model="gh.path" /></div>
        </div>
        <p class="tiny muted mt-8">Token 需要 <code>repo</code> 权限。仓库需已存在（可以是私有仓库）。</p>
        <div class="row gap-8 mt-12 wrap">
          <button class="btn btn-sm" :disabled="testing" @click="testGitHub">{{ testing ? '测试中…' : '🔌 测试连接' }}</button>
          <button class="btn btn-sm btn-gold" @click="saveGitHub">保存并同步</button>
          <button class="btn btn-sm btn-ghost" @click="clearGitHub">清除配置</button>
        </div>
        <div v-if="store.connected" class="small mt-8" style="color:var(--success)">✅ 已连接云端 · 上次同步 {{ store.meta.syncedAt ? new Date(store.meta.syncedAt).toLocaleString('zh-CN') : '—' }}</div>
      </Card>
    </div>

    <div class="grid mb-16" style="grid-template-columns: 1fr 1fr;">
      <Card title="数据管理" icon="🗄️">
        <div class="row gap-8 wrap">
          <button class="btn btn-sm" @click="exportData">⬇ 导出 JSON 备份</button>
          <button class="btn btn-sm btn-gold" @click="importInput.click()">⬆ 导入 JSON</button>
          <button class="btn btn-sm btn-ghost" @click="loadSample">载入示例数据</button>
          <button class="btn btn-sm btn-red" @click="openResetModal">🗑️ 清空全部数据</button>
        </div>
        <input ref="importInput" type="file" accept="application/json,.json" style="display:none" @change="onImportFile" />
        <p class="tiny muted mt-12">数据以 JSON 存储于 GitHub 仓库，可随时导出备份。建议定期备份。清空操作需确认，不会误触。</p>
      </Card>

      <Card title="提醒与通知" icon="🔔">
        <div class="form-field mb-12">
          <label class="row gap-8">
            <input type="checkbox" v-model="settings.remindersEnabled" /> 启用提醒（系统通知 + 页面内弹窗 双通道）
          </label>
          <div class="small muted mt-4">通知权限状态：{{ permissionLabel }}</div>
        </div>

        <!-- 下次提醒倒计时 -->
        <div v-if="settings.remindersEnabled && nextReminder" class="next-reminder-box mb-12">
          <div class="small bold">⏰ 下次提醒</div>
          <div class="next-reminder-info">
            <span class="next-reminder-type">{{ nextReminder.type }}</span>
            <span class="next-reminder-time">{{ nextReminder.date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }}</span>
          </div>
          <div class="next-reminder-countdown">倒计时：{{ nextReminder.countdown }}</div>
        </div>
        <div v-else-if="settings.remindersEnabled" class="small muted mb-12">⚠️ 未设置任何提醒时间</div>

        <div class="form-grid">
          <div class="form-field"><label>每日提醒时间</label><input type="time" v-model="settings.dailyRemind" /></div>
          <div class="form-field"><label>每周提醒时间</label><input type="time" v-model="settings.weeklyRemind" /></div>
          <div class="form-field"><label>每周提醒日</label>
            <select v-model.number="settings.weeklyRemindWeekday">
              <option :value="1">周一</option><option :value="2">周二</option><option :value="3">周三</option>
              <option :value="4">周四</option><option :value="5">周五</option><option :value="6">周六</option><option :value="0">周日</option>
            </select>
          </div>
          <div class="form-field"><label>每月提醒（每月1号）</label><input type="time" v-model="settings.monthlyRemind" /></div>
        </div>

        <div class="form-field mt-12">
          <label class="row gap-8"><input type="checkbox" v-model="settings.deadlineRemind" /> 目标到期前 7 天提醒</label>
        </div>
        <div class="form-field">
          <label class="row gap-8"><input type="checkbox" v-model="settings.budgetAlert" /> 预算超支提醒</label>
        </div>

        <div class="row gap-8 mt-12 wrap">
          <button class="btn btn-sm btn-pink" @click="enableReminders">开启通知权限</button>
          <button class="btn btn-sm btn-gold" @click="testNotify">🔔 发送测试通知</button>
          <button class="btn btn-sm btn-ghost" @click="testSound">🔊 测试提示音</button>
        </div>
        <button class="btn btn-block mt-12" @click="saveReminders">保存提醒设置</button>

        <!-- 通知诊断区域 -->
        <div class="diag-box mt-16">
          <div class="diag-header">
            <span class="small bold">🔧 通知诊断</span>
            <button class="btn btn-sm btn-ghost" :disabled="diag.loading" @click="runDiagnostics">{{ diag.loading ? '诊断中…' : '重新诊断' }}</button>
          </div>
          <div class="diag-grid">
            <div class="diag-item">
              <span class="diag-label">Notification API</span>
              <span class="diag-value" :class="diag.notificationSupported ? 'ok' : 'fail'">
                {{ diag.notificationSupported === null ? '—' : (diag.notificationSupported ? '✅ 支持' : '❌ 不支持') }}
              </span>
            </div>
            <div class="diag-item">
              <span class="diag-label">通知权限</span>
              <span class="diag-value" :class="diag.permission === 'granted' ? 'ok' : (diag.permission === 'denied' ? 'fail' : 'warn')">
                {{ diag.permission === 'unknown' ? '—' : diag.permission }}
              </span>
            </div>
            <div class="diag-item">
              <span class="diag-label">ServiceWorker</span>
              <span class="diag-value" :class="diag.serviceWorkerRegistered ? 'ok' : 'warn'">
                {{ diag.serviceWorkerRegistered === null ? '—' : (diag.serviceWorkerRegistered ? '✅ 已注册' : '⚠️ 未注册') }}
              </span>
            </div>
            <div class="diag-item">
              <span class="diag-label">showNotification</span>
              <span class="diag-value" :class="diag.showNotificationSupported ? 'ok' : 'fail'">
                {{ diag.showNotificationSupported === null ? '—' : (diag.showNotificationSupported ? '✅ 支持' : '❌ 不支持') }}
              </span>
            </div>
            <div class="diag-item">
              <span class="diag-label">页面焦点</span>
              <span class="diag-value" :class="diag.documentFocused ? 'ok' : 'warn'">
                {{ diag.documentFocused === null ? '—' : (diag.documentFocused ? '✅ 前台' : '⚠️ 后台') }}
              </span>
            </div>
            <div class="diag-item">
              <span class="diag-label">SW Scope</span>
              <span class="diag-value tiny">{{ diag.serviceWorkerScope || '—' }}</span>
            </div>
          </div>
          <div v-if="diag.errors.length > 0" class="diag-errors">
            <div class="small bold mb-4" style="color:var(--danger)">⚠️ 检测到问题：</div>
            <ul class="tiny" style="padding-left:16px;line-height:1.8">
              <li v-for="(err, i) in diag.errors" :key="i">{{ err }}</li>
            </ul>
          </div>
          <div class="row gap-8 mt-8 wrap">
            <button class="btn btn-sm" @click="reRequestPermission">🔄 重新请求通知权限</button>
          </div>
        </div>

        <!-- Windows 端通知排查提示 -->
        <div class="windows-guide mt-16">
          <p class="small bold mb-4">🪟 Windows 端系统通知排查</p>
          <ol class="small muted" style="padding-left:18px;line-height:1.8">
            <li>关闭<b>专注助手</b>（任务栏右下角 → 月亮图标，确保为关闭状态）</li>
            <li>进入 <b>设置 → 系统 → 通知</b>，开启<b>通知</b>总开关</li>
            <li>在通知列表中找到你的浏览器（Chrome / Edge），开启<b>允许应用通知</b></li>
            <li>确保浏览器通知的<b>横幅</b>和<b>操作中心</b>均已勾选</li>
            <li>安装为 PWA 应用后，在通知列表中找到「青云志」单独开启通知</li>
            <li>重启浏览器后再次点击「发送测试通知」验证</li>
          </ol>
        </div>

        <div class="reminder-guide mt-16">
          <p class="small bold mb-4">📱 手机锁屏通知设置（iQOO / 安卓）</p>
          <ol class="small muted" style="padding-left:18px;line-height:1.8">
            <li>先点击上方「开启通知权限」，允许浏览器通知</li>
            <li>安装为应用后（见下方），进入 <b>设置 → 通知与状态栏 → 应用通知管理</b></li>
            <li>找到「青云志」或浏览器，开启 <b>允许通知</b> + <b>锁屏显示</b></li>
            <li>开启 <b>后台弹出界面</b> 和 <b>悬浮通知</b>，即可弹浮窗</li>
            <li>在电池设置中关闭该应用的 <b>后台限制</b>，保证提醒不被系统杀死</li>
          </ol>
        </div>
      </Card>

      <Card title="安装为应用（PWA）" icon="📲">
        <p class="small muted mb-12">将青云志安装到电脑桌面或手机主屏幕，体验类似原生 App 的通知、锁屏提醒和离线访问。</p>

        <div v-if="isInstalled" class="pwa-installed">
          <span style="font-size:32px">✅</span>
          <div>
            <div class="bold">已安装为应用</div>
            <div class="small muted">可从桌面/主屏幕直接打开，通知可显示在锁屏</div>
          </div>
        </div>

        <div v-else-if="canInstall">
          <button class="btn btn-bounce btn-block" style="font-size:15px;padding:12px" @click="installApp">
            📲 安装到桌面 / 主屏幕
          </button>
          <p class="tiny muted mt-8">安装后系统通知可直接弹出，手机端可显示在锁屏界面</p>
        </div>

        <div v-else class="pwa-manual">
          <p class="small bold mb-4">🖥️ 电脑端安装方法：</p>
          <p class="small muted mb-8">Chrome / Edge 地址栏右侧点击「安装」图标（📥），或菜单 → 安装应用</p>
          <p class="small bold mb-4">📱 手机端安装方法：</p>
          <p class="small muted">浏览器菜单 →「添加到主屏幕」/「安装应用」，安装后从主屏幕打开</p>
        </div>

        <div class="mt-16 pwa-tips">
          <p class="small bold mb-4">💡 安装后的好处：</p>
          <ul class="small muted" style="padding-left:18px;line-height:1.8">
            <li>独立窗口运行，无浏览器地址栏干扰</li>
            <li>系统级通知弹窗，电脑端直接弹桌面</li>
            <li>手机端通知可显示在锁屏和通知栏</li>
            <li>离线可查看缓存数据，联网自动同步</li>
            <li>图标在桌面/主屏幕，一键打开</li>
          </ul>
        </div>
      </Card>
    </div>

    <Card title="关于" icon="🏮">
      <p class="small">《青云志 · 人生进度簿》——童真动画古风风格的个人成长与财务追踪系统。</p>
      <p class="small muted mt-8">追风赶月莫停留，平芜尽处是春山。愿你一步步走向 100 万与财富自由。</p>
      <p class="small muted mt-8">版本 v1.0.0 · Vue 3 + Pinia + ECharts · GitHub API 数据层 · PWA 离线可用</p>
    </Card>

    <!-- 清空数据确认对话框 -->
    <Modal v-if="showResetModal" title="清空数据确认" icon="⚠️" @close="cancelReset">
      <!-- 第一步：选择清空范围 -->
      <div v-if="resetStep === 1">
        <div class="reset-warning">
          <p class="bold" style="color:var(--danger);font-size:15px">⚠️ 请仔细阅读</p>
          <p class="small mt-8" style="line-height:1.8">
            这将清空<b>本机浏览器</b>中的所有数据（目标、计划、记录、收支、资产、书籍、学习、复盘等）。
          </p>
          <p class="small mt-8" style="line-height:1.8">
            <b>GitHub 云端数据不会被删除</b>，重新同步后会从云端恢复。
          </p>
          <p class="small mt-8 muted">请选择清空范围：</p>
        </div>
        <div class="reset-options">
          <button class="reset-option-btn" :class="{ active: resetScope === 'local' }" @click="chooseResetScope('local')">
            <div class="reset-option-title">📱 仅清空本地</div>
            <div class="reset-option-desc">本机数据清空，GitHub 云端保留。下次同步将从云端恢复数据。</div>
          </button>
          <button class="reset-option-btn danger" :class="{ active: resetScope === 'cloud' }" @click="chooseResetScope('cloud')">
            <div class="reset-option-title">☁️ 同时清空云端</div>
            <div class="reset-option-desc">本机 + GitHub 云端数据全部清空，<b style="color:var(--danger)">不可恢复</b>！</div>
          </button>
        </div>
        <div class="row gap-8 mt-16 justify-end">
          <button class="btn btn-sm btn-ghost" @click="cancelReset">取消</button>
        </div>
      </div>

      <!-- 第二步：云端清空二次确认 -->
      <div v-else-if="resetStep === 2">
        <div class="reset-warning">
          <p class="bold" style="color:var(--danger);font-size:15px">🚨 最终确认：清空云端数据</p>
          <p class="small mt-8" style="line-height:1.8">
            你选择了<b style="color:var(--danger)">同时清空 GitHub 云端数据</b>。
          </p>
          <p class="small mt-8" style="line-height:1.8">
            此操作将把仓库中的 <code>data/user-data.json</code> 覆盖为空数据结构，<b style="color:var(--danger)">所有云端数据将永久丢失，无法恢复</b>。
          </p>
          <p class="small mt-8 muted">请输入「{{ RESET_CONFIRM_WORD }}」确认操作：</p>
        </div>
        <input
          v-model="resetConfirmText"
          class="reset-confirm-input mt-12"
          :placeholder="`请输入「${RESET_CONFIRM_WORD}」`"
          @keyup.enter="doResetCloud"
        />
        <div class="row gap-8 mt-16 justify-end">
          <button class="btn btn-sm btn-ghost" :disabled="resetting" @click="resetStep = 1">返回</button>
          <button
            class="btn btn-sm btn-red"
            :disabled="resetting || resetConfirmText !== RESET_CONFIRM_WORD"
            @click="doResetCloud"
          >{{ resetting ? '清空中…' : '确认清空云端' }}</button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.tiny { font-size: 11px; }
code { background: #f3ece0; padding: 1px 6px; border-radius: 6px; font-size: 12px; }

/* 下次提醒 */
.next-reminder-box {
  background: var(--cyan-soft);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  border-left: 3px solid var(--cyan, #5b9aa0);
}
.next-reminder-info {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 4px;
}
.next-reminder-type { font-weight: 600; font-size: 13px; color: var(--ink); }
.next-reminder-time { font-size: 12px; color: var(--ink-2); }
.next-reminder-countdown {
  font-size: 13px; font-weight: 700; color: var(--cyan, #3a7a80);
  margin-top: 2px; font-variant-numeric: tabular-nums;
}

/* 通知诊断 */
.diag-box {
  background: #f7f3ec;
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  border: 1px solid var(--line-soft);
}
.diag-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 10px;
}
.diag-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px;
}
.diag-item {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 12px;
}
.diag-label { color: var(--ink-3); }
.diag-value { font-weight: 600; }
.diag-value.ok { color: var(--success, #6f9a5c); }
.diag-value.fail { color: var(--danger, #c0553f); }
.diag-value.warn { color: var(--gold, #d9922e); }
.diag-errors {
  margin-top: 10px; padding-top: 8px;
  border-top: 1px dashed var(--line-soft);
}

/* Windows 排查提示 */
.windows-guide {
  background: var(--blue-soft, #e8f0f7);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  border-left: 3px solid var(--blue, #4a7fb5);
}

.reminder-guide {
  background: var(--gold-soft);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  border-left: 3px solid var(--gold);
}
.pwa-installed {
  display: flex; align-items: center; gap: 14px;
  background: var(--green-soft); border-radius: var(--radius);
  padding: 16px; margin-bottom: 12px;
}
.pwa-manual {
  background: var(--cyan-soft); border-radius: var(--radius-sm);
  padding: 14px; margin-bottom: 12px;
}
.pwa-tips {
  background: var(--pink-soft); border-radius: var(--radius-sm);
  padding: 12px 14px; border-left: 3px solid var(--pink);
}

/* 清空数据确认对话框 */
.reset-warning {
  background: #fdf3f0;
  border: 1px solid #f0c8bf;
  border-radius: var(--radius-sm);
  padding: 14px 16px;
}
.reset-options {
  display: flex; flex-direction: column; gap: 10px; margin-top: 14px;
}
.reset-option-btn {
  text-align: left;
  background: #fff;
  border: 2px solid var(--line-soft);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  cursor: pointer;
  transition: all .2s;
}
.reset-option-btn:hover { border-color: var(--gold); background: var(--gold-soft); }
.reset-option-btn.active { border-color: var(--gold); background: var(--gold-soft); }
.reset-option-btn.danger:hover { border-color: var(--danger, #c0553f); background: #fdf3f0; }
.reset-option-btn.danger.active { border-color: var(--danger, #c0553f); background: #fdf3f0; }
.reset-option-title { font-weight: 700; font-size: 14px; margin-bottom: 4px; color: var(--ink); }
.reset-option-desc { font-size: 12px; color: var(--ink-2); line-height: 1.6; }
.reset-confirm-input {
  width: 100%;
  padding: 10px 14px;
  border: 2px solid var(--danger, #c0553f);
  border-radius: var(--radius-sm);
  font-size: 15px;
  font-weight: 600;
  text-align: center;
  outline: none;
}
.reset-confirm-input:focus { border-color: var(--danger, #c0553f); box-shadow: 0 0 0 3px rgba(192,85,63,.15); }
.justify-end { justify-content: flex-end; }
</style>
