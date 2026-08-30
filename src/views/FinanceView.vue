<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/dataStore.js'
import { useUiStore } from '../stores/uiStore.js'
import Card from '../components/common/Card.vue'
import Modal from '../components/common/Modal.vue'
import EmptyState from '../components/common/EmptyState.vue'
import ProgressBar from '../components/common/ProgressBar.vue'
import BaseChart from '../components/charts/BaseChart.vue'
import { todayStr, monthKey, monthLabel, parseDate } from '../utils/date.js'
import { sumBy, sumAmount, monthlyExpense, monthlyIncome, monthlySeries, lastMonths, categoryByMode } from '../utils/calc.js'
import { fmtMoney, fmtMoneyShort, fmtPercent, uid } from '../utils/format.js'
import { exportCSV } from '../utils/export.js'
import { CATEGORIES, PAY_METHODS, MODES, INCOME_TYPES, CATEGORY_COLORS } from '../utils/defaultData.js'

const store = useDataStore()
const ui = useUiStore()

const month = ref(monthKey())
const tab = ref('支出')
const showSpend = ref(false)
const showIncome = ref(false)
const showManage = ref(false)
const spendForm = ref({})
const incomeForm = ref({})
const filterCategory = ref('全部')
const filterMode = ref('全部')
const viewMode = ref('monthly') // 'monthly' | 'yearly'
const selectedYear = ref(new Date().getFullYear())

const customCategories = computed(() => store.user.customCategories || [])
const categories = computed(() => [...new Set([...CATEGORIES, ...customCategories.value])])
const customModes = computed(() => store.user.customModes || [])
const modes = computed(() => [...new Set([...MODES, ...customModes.value])])
const budget = computed(() => Number(store.user.monthlyBudget) || 0)

const monthExpense = computed(() => monthlyExpense(store.consumptions, month.value))
const monthIncome = computed(() => monthlyIncome(store.incomes, month.value))
const balance = computed(() => monthIncome.value - monthExpense.value)
const budgetLeft = computed(() => budget.value - monthExpense.value)
const budgetPct = computed(() => budget.value ? (monthExpense.value / budget.value) * 100 : 0)

const spendings = computed(() => store.consumptions
  .filter(c => c.date.startsWith(month.value))
  .filter(c => filterCategory.value === '全部' || c.category === filterCategory.value)
  .filter(c => filterMode.value === '全部' || c.mode === filterMode.value)
  .sort((a, b) => (a.date + (a.time || '') < b.date + (b.time || '') ? 1 : -1)))

const incomes = computed(() => store.incomes
  .filter(i => i.date.startsWith(month.value))
  .sort((a, b) => (a.date < b.date ? 1 : -1)))

/* —— 图表 —— */
const pieOption = computed(() => {
  const map = sumBy(store.consumptions.filter(c => c.date.startsWith(month.value)), 'category')
  return {
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: '#6b6256', fontSize: 12 } },
    series: [{
      type: 'pie', radius: ['40%', '66%'], center: ['50%', '42%'],
      itemStyle: { borderRadius: 6, borderColor: '#fffdf7', borderWidth: 2 },
      label: { show: false },
      data: Object.entries(map).map(([name, value]) => ({ name, value, itemStyle: { color: CATEGORY_COLORS[name] || '#9a8f7f' } }))
    }]
  }
})

const modeBarOption = computed(() => {
  const cats = categories.value.slice(0, 6)
  const series = modes.value.map((m, i) => ({
    name: m, type: 'bar', stack: 'total',
    itemStyle: { color: ['#5b8c85', '#e0a1a1', '#d9a94e', '#a58bb5'][i % 4] },
    data: cats.map(c => categoryByMode(store.consumptions.filter(x => x.date.startsWith(month.value)), c)[m] || 0)
  }))
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0, textStyle: { color: '#6b6256', fontSize: 12 } },
    grid: { left: 8, right: 12, top: 30, bottom: 6, containLabel: true },
    xAxis: { type: 'category', data: cats, axisLabel: { color: '#9a8f7f' }, axisLine: { lineStyle: { color: '#eadfc8' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0e8d8' } }, axisLabel: { color: '#9a8f7f' } },
    series
  }
})

const trendOption = computed(() => {
  const ms = lastMonths(6, month.value + '-01')
  const exp = monthlySeries(store.consumptions, ms)
  const inc = ms.map(m => monthlyIncome(store.incomes, m))
  return {
    tooltip: { trigger: 'axis', valueFormatter: v => '¥' + Number(v).toLocaleString() },
    legend: { data: ['支出', '收入'], textStyle: { color: '#6b6256', fontSize: 12 } },
    grid: { left: 8, right: 12, top: 34, bottom: 0, containLabel: true },
    xAxis: { type: 'category', data: ms, axisLabel: { color: '#9a8f7f' }, axisLine: { lineStyle: { color: '#eadfc8' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0e8d8' } }, axisLabel: { color: '#9a8f7f', formatter: v => (v / 1000).toFixed(0) + 'k' } },
    series: [
      { name: '支出', type: 'line', smooth: true, data: exp.map(e => e.total), itemStyle: { color: '#c96a4a' }, areaStyle: { color: 'rgba(201,106,74,.12)' } },
      { name: '收入', type: 'line', smooth: true, data: inc, itemStyle: { color: '#7a9e6b' }, areaStyle: { color: 'rgba(122,158,107,.12)' } }
    ]
  }
})

/* —— 年度统计 —— */
const yearExpense = computed(() => store.consumptions.filter(c => c.date.startsWith(String(selectedYear.value))).reduce((s, c) => s + Number(c.amount || 0), 0))
const yearIncome = computed(() => store.incomes.filter(i => i.date.startsWith(String(selectedYear.value))).reduce((s, i) => s + Number(i.amount || 0), 0))
const yearBalance = computed(() => yearIncome.value - yearExpense.value)
const yearSavingRate = computed(() => yearIncome.value ? Math.max(0, (yearBalance.value / yearIncome.value) * 100) : 0)
const yearCategoryMap = computed(() => sumBy(store.consumptions.filter(c => c.date.startsWith(String(selectedYear.value))), 'category'))
const yearMonths = computed(() => Array.from({ length: 12 }, (_, i) => `${selectedYear.value}-${String(i + 1).padStart(2, '0')}`))

const yearPieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
  legend: { bottom: 0, textStyle: { color: '#6b6256', fontSize: 12 }, type: 'scroll' },
  series: [{
    type: 'pie', radius: ['38%', '62%'], center: ['50%', '42%'],
    itemStyle: { borderRadius: 6, borderColor: '#fffdf7', borderWidth: 2 },
    label: { show: false },
    data: Object.entries(yearCategoryMap.value).map(([name, value]) => ({ name, value, itemStyle: { color: CATEGORY_COLORS[name] || '#9a8f7f' } }))
  }]
}))

const yearTrendOption = computed(() => {
  const exp = yearMonths.value.map(m => monthlyExpense(store.consumptions, m))
  const inc = yearMonths.value.map(m => monthlyIncome(store.incomes, m))
  return {
    tooltip: { trigger: 'axis', valueFormatter: v => '¥' + Number(v).toLocaleString() },
    legend: { data: ['支出', '收入'], textStyle: { color: '#6b6256', fontSize: 12 } },
    grid: { left: 8, right: 12, top: 34, bottom: 0, containLabel: true },
    xAxis: { type: 'category', data: yearMonths.value.map(m => m.slice(5) + '月'), axisLabel: { color: '#9a8f7f' }, axisLine: { lineStyle: { color: '#eadfc8' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0e8d8' } }, axisLabel: { color: '#9a8f7f', formatter: v => (v / 1000).toFixed(0) + 'k' } },
    series: [
      { name: '支出', type: 'bar', data: exp, itemStyle: { color: '#c96a4a', borderRadius: [4,4,0,0] }, barMaxWidth: 24 },
      { name: '收入', type: 'bar', data: inc, itemStyle: { color: '#7a9e6b', borderRadius: [4,4,0,0] }, barMaxWidth: 24 }
    ]
  }
})

const availableYears = computed(() => {
  const years = new Set()
  store.consumptions.forEach(c => years.add(c.date?.slice(0, 4)))
  store.incomes.forEach(i => years.add(i.date?.slice(0, 4)))
  store.assets.forEach(a => years.add(a.month?.slice(0, 4)))
  years.add(String(new Date().getFullYear()))
  return [...years].filter(Boolean).sort().reverse()
})
function openSpend() {
  spendForm.value = { amount: '', date: todayStr(), time: '', category: '餐饮', payMethod: '微信', mode: '必需', note: '', tags: [] }
  showSpend.value = true
}
function openIncome() {
  incomeForm.value = { amount: '', date: todayStr(), type: '工资', note: '' }
  showIncome.value = true
}
function saveSpend() {
  const amt = Number(spendForm.value.amount)
  if (!amt || amt <= 0) { ui.toast('请输入金额', 'warning'); return }
  store.addItem('consumptions', {
    amount: amt, date: spendForm.value.date, time: spendForm.value.time || '00:00',
    category: spendForm.value.category, payMethod: spendForm.value.payMethod,
    mode: spendForm.value.mode, note: spendForm.value.note, tags: spendForm.value.tags
  })
  showSpend.value = false
  ui.toast('已记录一笔支出 💸', 'success')
}
function saveIncome() {
  const amt = Number(incomeForm.value.amount)
  if (!amt || amt <= 0) { ui.toast('请输入金额', 'warning'); return }
  store.addItem('incomes', { amount: amt, date: incomeForm.value.date, type: incomeForm.value.type, note: incomeForm.value.note })
  showIncome.value = false
  ui.toast('已记录一笔收入 💰', 'success')
}
function removeSpend(id) { store.removeItem('consumptions', id); ui.toast('已删除') }
function removeIncome(id) { store.removeItem('incomes', id); ui.toast('已删除') }

/* —— 自定义类别 —— */
const newCat = ref('')
function addCategory() {
  const v = newCat.value.trim()
  if (!v) return
  if (categories.value.includes(v)) { ui.toast('类别已存在', 'warning'); return }
  store.updateUser({ customCategories: [...customCategories.value, v] })
  newCat.value = ''
}
function addMode() {
  const v = newCat.value.trim()
  if (!v) return
  if (modes.value.includes(v)) { ui.toast('模式已存在', 'warning'); return }
  store.updateUser({ customModes: [...customModes.value, v] })
  newCat.value = ''
}
function removeCategory(c) { store.updateUser({ customCategories: customCategories.value.filter(x => x !== c) }) }

/* —— 导出 —— */
function exportSpend() {
  exportCSV(`消费记录-${month.value}.csv`, spendings.value.map(c => ({
    日期: c.date, 时间: c.time, 类别: c.category, 支付方式: c.payMethod, 模式: c.mode, 金额: c.amount, 备注: c.note
  })))
  ui.toast('已导出 CSV', 'success')
}

function prevMonth() { month.value = shiftMonth(month.value, -1) }
function nextMonth() { month.value = shiftMonth(month.value, 1) }
function shiftMonth(key, delta) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h1 class="page-title">💰 消费与财务</h1>
      <div class="spacer"></div>
      <button class="btn btn-sm btn-gold" @click="showManage = true">⚙ 自定义类别</button>
      <button class="btn btn-sm btn-ghost" @click="exportSpend">导出 CSV</button>
      <button class="btn btn-sm btn-pink" @click="openIncome">＋ 记收入</button>
      <button class="btn btn-bounce" @click="openSpend">＋ 记支出</button>
    </div>

    <div class="row gap-8 mb-16">
      <button class="btn btn-sm" :class="viewMode === 'monthly' ? '' : 'btn-ghost'" @click="viewMode = 'monthly'">月度</button>
      <button class="btn btn-sm" :class="viewMode === 'yearly' ? '' : 'btn-ghost'" @click="viewMode = 'yearly'">年度</button>
      <span class="spacer"></span>
      <template v-if="viewMode === 'monthly'">
        <button class="btn btn-sm btn-ghost" @click="prevMonth">◀</button>
        <span class="month-label">{{ monthLabel(month) }}</span>
        <button class="btn btn-sm btn-ghost" @click="nextMonth">▶</button>
        <span v-if="month !== monthKey()" class="q-tag t-gray clickable" @click="month = monthKey()">回到本月</span>
      </template>
      <template v-else>
        <select v-model.number="selectedYear" class="mini">
          <option v-for="y in availableYears" :key="y" :value="Number(y)">{{ y }} 年</option>
        </select>
      </template>
    </div>

    <!-- 月度视图 -->
    <template v-if="viewMode === 'monthly'">
    <div class="grid grid-4 mb-16">
      <div class="stat-card"><div class="s-label">月总支出</div><div class="s-value" style="color:#c96a4a">¥ {{ fmtMoney(monthExpense) }}</div><div class="s-sub">{{ spendings.length }} 笔</div></div>
      <div class="stat-card"><div class="s-label">月总收入</div><div class="s-value" style="color:#6f9a5c">¥ {{ fmtMoney(monthIncome) }}</div><div class="s-sub">{{ incomes.length }} 笔</div></div>
      <div class="stat-card"><div class="s-label">月结余</div><div class="s-value" :style="{ color: balance >= 0 ? '#5b8c85' : '#c0553f' }">¥ {{ fmtMoney(balance) }}</div><div class="s-sub">储蓄率 {{ fmtPercent(budget.value ? Math.max(0, (monthIncome - monthExpense) / Math.max(monthIncome, 1)) * 100 : 0, 0) }}</div></div>
      <div class="stat-card"><div class="s-label">预算剩余</div><div class="s-value" :style="{ color: budgetLeft >= 0 ? '#7a9e6b' : '#c0553f' }">¥ {{ fmtMoney(budgetLeft) }}</div><div class="s-sub">预算 ¥ {{ fmtMoney(budget) }}</div></div>
    </div>

    <div v-if="budget" class="mb-16">
      <div class="row-between small muted mb-4"><span>预算执行</span><span>{{ fmtPercent(budgetPct, 0) }}</span></div>
      <ProgressBar :value="budgetPct" :color="budgetPct >= 100 ? 'red' : budgetPct >= 75 ? 'gold' : 'green'" :height="12" />
    </div>

    <div class="grid mb-16" style="grid-template-columns: 1fr 1fr;">
      <Card :title="'支出结构（' + month + '）'" icon="🥧">
        <BaseChart v-if="monthExpense > 0" :option="pieOption" height="260px" />
        <EmptyState v-else emoji="🍃" text="本月暂无支出" />
      </Card>
      <Card title="类别 × 消费模式" icon="📊">
        <BaseChart v-if="monthExpense > 0" :option="modeBarOption" height="260px" />
        <EmptyState v-else emoji="🍃" text="记录消费后展示分析" />
      </Card>
    </div>

    <Card title="近 6 个月收支趋势" icon="📈" class="mb-16">
      <BaseChart v-if="store.consumptions.length || store.incomes.length" :option="trendOption" height="260px" />
      <EmptyState v-else emoji="📈" text="暂无数据" />
    </Card>
    </template>

    <!-- 年度视图 -->
    <template v-if="viewMode === 'yearly'">
    <div class="grid grid-4 mb-16">
      <div class="stat-card"><div class="s-label">年总支出</div><div class="s-value" style="color:#c96a4a">¥ {{ fmtMoney(yearExpense) }}</div><div class="s-sub">{{ selectedYear }} 年</div></div>
      <div class="stat-card"><div class="s-label">年总收入</div><div class="s-value" style="color:#6f9a5c">¥ {{ fmtMoney(yearIncome) }}</div><div class="s-sub">{{ selectedYear }} 年</div></div>
      <div class="stat-card"><div class="s-label">年结余</div><div class="s-value" :style="{ color: yearBalance >= 0 ? '#5b8c85' : '#c0553f' }">¥ {{ fmtMoney(yearBalance) }}</div><div class="s-sub">储蓄率 {{ fmtPercent(yearSavingRate, 0) }}</div></div>
      <div class="stat-card"><div class="s-label">月均支出</div><div class="s-value" style="color:#7b95b5">¥ {{ fmtMoney(yearExpense / 12) }}</div><div class="s-sub">月均收入 ¥{{ fmtMoney(yearIncome / 12) }}</div></div>
    </div>

    <div class="grid mb-16" style="grid-template-columns: 1fr 1fr;">
      <Card :title="selectedYear + ' 年支出结构'" icon="🥧">
        <BaseChart v-if="yearExpense > 0" :option="yearPieOption" height="280px" />
        <EmptyState v-else emoji="🍃" text="本年暂无支出" />
      </Card>
      <Card :title="selectedYear + ' 年月度收支'" icon="📊">
        <BaseChart v-if="yearExpense > 0 || yearIncome > 0" :option="yearTrendOption" height="280px" />
        <EmptyState v-else emoji="📈" text="本年暂无数据" />
      </Card>
    </div>

    <Card :title="selectedYear + ' 年分类支出明细'" icon="📋" class="mb-16">
      <div v-if="Object.keys(yearCategoryMap).length" class="tx-list">
        <div v-for="(val, cat) in yearCategoryMap" :key="cat" class="tx row-between">
          <div class="row gap-10">
            <span class="tx-cat" :style="{ background: (CATEGORY_COLORS[cat] || '#9a8f7f') + '22', color: CATEGORY_COLORS[cat] || '#9a8f7f' }">{{ cat }}</span>
            <span class="small muted">占比 {{ fmtPercent(yearExpense ? (val / yearExpense) * 100 : 0, 1) }}</span>
          </div>
          <span class="bold" style="color:#c96a4a">¥ {{ fmtMoney(val) }}</span>
        </div>
      </div>
      <EmptyState v-else emoji="🍃" text="本年暂无支出记录" />
    </Card>
    </template>

    <!-- 明细 -->
    <Card>
      <div class="row gap-8 mb-12">
        <button class="btn btn-sm" :class="tab === '支出' ? '' : 'btn-ghost'" @click="tab = '支出'">支出明细</button>
        <button class="btn btn-sm" :class="tab === '收入' ? '' : 'btn-ghost'" @click="tab = '收入'">收入明细</button>
        <div class="spacer"></div>
        <template v-if="tab === '支出'">
          <select v-model="filterCategory" class="mini"><option>全部</option><option v-for="c in categories" :key="c">{{ c }}</option></select>
          <select v-model="filterMode" class="mini"><option>全部</option><option v-for="m in modes" :key="m">{{ m }}</option></select>
        </template>
      </div>

      <div v-if="tab === '支出'">
        <div v-if="spendings.length" class="tx-list">
          <div v-for="c in spendings" :key="c.id" class="tx row-between">
            <div class="row gap-10">
              <span class="tx-cat" :style="{ background: (CATEGORY_COLORS[c.category] || '#9a8f7f') + '22', color: CATEGORY_COLORS[c.category] || '#9a8f7f' }">{{ c.category }}</span>
              <div>
                <div class="small">{{ c.note || c.category }} <span class="q-tag t-gray small">{{ c.mode }}</span></div>
                <div class="tiny muted">{{ c.date }} {{ c.time }} · {{ c.payMethod }}</div>
              </div>
            </div>
            <div class="row gap-8">
              <span class="bold" style="color:#c96a4a">- ¥{{ fmtMoney(c.amount) }}</span>
              <button class="btn btn-sm btn-ghost" @click="removeSpend(c.id)">删</button>
            </div>
          </div>
        </div>
        <EmptyState v-else emoji="🍃" text="本月暂无支出记录" />
      </div>

      <div v-else>
        <div v-if="incomes.length" class="tx-list">
          <div v-for="c in incomes" :key="c.id" class="tx row-between">
            <div class="row gap-10">
              <span class="tx-cat" style="background:#e3ecdc;color:#54763f">{{ c.type }}</span>
              <div>
                <div class="small">{{ c.note || c.type }}</div>
                <div class="tiny muted">{{ c.date }}</div>
              </div>
            </div>
            <div class="row gap-8">
              <span class="bold" style="color:#6f9a5c">+ ¥{{ fmtMoney(c.amount) }}</span>
              <button class="btn btn-sm btn-ghost" @click="removeIncome(c.id)">删</button>
            </div>
          </div>
        </div>
        <EmptyState v-else emoji="🍃" text="本月暂无收入记录" />
      </div>
    </Card>

    <!-- 记支出弹窗 -->
    <Modal title="记一笔支出" icon="💸" @close="showSpend = false" v-if="showSpend">
      <div class="form-grid">
        <div class="form-field"><label>金额 <span class="req">*</span></label><input type="number" v-model="spendForm.amount" placeholder="0.00" /></div>
        <div class="form-field"><label>日期</label><input type="date" v-model="spendForm.date" /></div>
        <div class="form-field"><label>时间</label><input type="time" v-model="spendForm.time" /></div>
        <div class="form-field"><label>消费类别</label><select v-model="spendForm.category"><option v-for="c in categories" :key="c" :value="c">{{ c }}</option></select></div>
        <div class="form-field"><label>支付方式</label><select v-model="spendForm.payMethod"><option v-for="m in PAY_METHODS" :key="m" :value="m">{{ m }}</option></select></div>
        <div class="form-field"><label>消费模式</label><select v-model="spendForm.mode"><option v-for="m in modes" :key="m" :value="m">{{ m }}</option></select></div>
        <div class="form-field full"><label>详细理由 / 备注</label><input v-model="spendForm.note" placeholder="这笔钱花得值不值？" /></div>
      </div>
      <button class="btn btn-block mt-16" @click="saveSpend">保存支出</button>
    </Modal>

    <!-- 记收入弹窗 -->
    <Modal title="记一笔收入" icon="💰" @close="showIncome = false" v-if="showIncome">
      <div class="form-grid">
        <div class="form-field"><label>金额 <span class="req">*</span></label><input type="number" v-model="incomeForm.amount" placeholder="0.00" /></div>
        <div class="form-field"><label>日期</label><input type="date" v-model="incomeForm.date" /></div>
        <div class="form-field"><label>收入类型</label><select v-model="incomeForm.type"><option v-for="t in INCOME_TYPES" :key="t" :value="t">{{ t }}</option></select></div>
        <div class="form-field"><label>备注</label><input v-model="incomeForm.note" /></div>
      </div>
      <button class="btn btn-block mt-16" @click="saveIncome">保存收入</button>
    </Modal>

    <!-- 自定义类别 -->
    <Modal title="自定义类别与模式" icon="⚙️" @close="showManage = false" v-if="showManage">
      <p class="small muted mb-8">自定义消费类别（用于多维度统计）</p>
      <div class="row gap-8 mb-8">
        <input v-model="newCat" placeholder="新类别，如：宠物" style="flex:1" />
        <button class="btn btn-sm" @click="addCategory">添加类别</button>
      </div>
      <div class="row gap-8 wrap mb-16">
        <span v-for="c in customCategories" :key="c" class="q-tag t-cyan">{{ c }} <b style="cursor:pointer" @click="removeCategory(c)"> ×</b></span>
        <span v-if="!customCategories.length" class="small muted">暂无自定义类别</span>
      </div>
      <p class="small muted mb-8">自定义消费模式（必需 / 可选 / 冲动 / 投资）</p>
      <div class="row gap-8 mb-8">
        <input v-model="newCat" placeholder="新模式，如：人情往来" style="flex:1" />
        <button class="btn btn-sm" @click="addMode">添加模式</button>
      </div>
      <div class="row gap-8 wrap">
        <span v-for="m in customModes" :key="m" class="q-tag t-pink">{{ m }}</span>
        <span v-if="!customModes.length" class="small muted">暂无自定义模式</span>
      </div>
      <p class="small muted mt-16">月度预算（总预算）</p>
      <div class="row gap-8">
        <input type="number" v-model.number="store.user.monthlyBudget" placeholder="2000" style="flex:1" />
        <button class="btn btn-sm" @click="store.markDirty()">保存预算</button>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.month-label { font-family: var(--font-title); font-size: 20px; padding: 0 8px; }
.tx-list { display: flex; flex-direction: column; }
.tx { padding: 9px 6px; border-bottom: 1px dashed var(--line-soft); }
.tx:last-child { border-bottom: none; }
.tx-cat { padding: 2px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; }
.tiny { font-size: 11px; }
.mini { width: 110px; }
</style>
