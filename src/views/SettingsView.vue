<script setup>
import { ref, computed, onMounted } from 'vue'
import { useDataStore } from '../stores/dataStore.js'
import { useUiStore } from '../stores/uiStore.js'
import Card from '../components/common/Card.vue'
import { githubService } from '../services/githubService.js'
import { localCache } from '../services/localCache.js'
import { exportJSON } from '../utils/export.js'
import { requestNotifyPermission, checkGoalsAndBudget, initReminders, sendTestNotification, getNotifyPermission } from '../utils/reminders.js'
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

const notifyPermission = computed(() => getNotifyPermission())
const permissionLabel = computed(() => {
  const map = { granted: '✅ 已授权', denied: '❌ 已拒绝（需在浏览器设置中开启）', default: '⚠️ 未授权', unsupported: '❌ 浏览器不支持' }
  return map[notifyPermission.value] || notifyPermission.value
})

onMounted(() => {
  const u = store.user
  profile.value = { name: u.name || '', birthday: u.birthday || '', targetAge: u.targetAge || 40, baselineSalary: u.baselineSalary || 0, monthlyBudget: u.monthlyBudget || 0 }
  const c = localCache.readConfig() || {}
  gh.value = { token: c.token || '', owner: c.owner || '', repo: c.repo || '', branch: c.branch || 'main', path: c.path || 'data/user-data.json' }
  settings.value = localCache.readSettings() || {}
})

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

/* —— 数据管理 —— */
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
function resetAll() {
  store.resetAll()
  ui.toast('已清空全部数据', 'warning')
}

/* —— 提醒 —— */
async function enableReminders() {
  const ok = await requestNotifyPermission()
  if (ok) {
    settings.value.remindersEnabled = true
    localCache.writeSettings(settings.value)
    initReminders()
    ui.toast('已开启浏览器提醒 🔔', 'success')
  } else {
    ui.toast('未获得通知权限，请允许浏览器通知。应用内弹窗仍会提醒。', 'warning')
  }
}
function saveReminders() {
  localCache.writeSettings(settings.value)
  initReminders()
  ui.toast('提醒设置已保存', 'success')
}
function testNotify() {
  sendTestNotification()
  ui.toast('已发送测试通知，请注意查看系统通知或页面弹窗', 'success')
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
          <button class="btn btn-sm btn-red" @click="resetAll">清空全部数据</button>
        </div>
        <input ref="importInput" type="file" accept="application/json,.json" style="display:none" @change="onImportFile" />
        <p class="tiny muted mt-12">数据以 JSON 存储于 GitHub 仓库，可随时导出备份。建议定期备份。</p>
      </Card>

      <Card title="提醒与通知" icon="🔔">
        <div class="form-field mb-12">
          <label class="row gap-8">
            <input type="checkbox" v-model="settings.remindersEnabled" /> 启用提醒（系统通知 + 页面内弹窗 双通道）
          </label>
          <div class="small muted mt-4">通知权限状态：{{ permissionLabel }}</div>
        </div>

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
        </div>
        <button class="btn btn-block mt-12" @click="saveReminders">保存提醒设置</button>

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
  </div>
</template>

<style scoped>
.tiny { font-size: 11px; }
code { background: #f3ece0; padding: 1px 6px; border-radius: 6px; font-size: 12px; }
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
</style>
