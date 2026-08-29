<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '../stores/dataStore.js'
import { useUiStore } from '../stores/uiStore.js'
import Card from '../components/common/Card.vue'
import StatCard from '../components/common/StatCard.vue'
import ProgressBar from '../components/common/ProgressBar.vue'
import EmptyState from '../components/common/EmptyState.vue'
import BaseChart from '../components/charts/BaseChart.vue'
import { todayStr, weekdayCn, monthKey, cnDate } from '../utils/date.js'
import {
  sumAmount, monthlyExpense, monthlyIncome, savingsRate, goalProgress,
  goalTimeRatio, studyHours, bookStats, planCompletion, assetCurve, sumBy, netWorth
} from '../utils/calc.js'
import { fmtMoney, fmtMoneyShort, fmtWan, fmtPercent, fmtDuration } from '../utils/format.js'
import { CATEGORY_COLORS } from '../utils/defaultData.js'

const store = useDataStore()
const ui = useUiStore()
const router = useRouter()

const user = computed(() => store.user)
const today = todayStr()

// —— 主目标：净资产 100 万 ——
const mainGoal = computed(() => {
  return store.goals.find(g => g.name.includes('100')) || store.goals.find(g => g.type === '长期') || store.goals[0] || null
})
const latestAsset = computed(() => {
  if (!store.assets.length) return null
  return [...store.assets].sort((a, b) => (a.month < b.month ? 1 : -1))[0]
})
const currentNet = computed(() => latestAsset.value ? netWorth(latestAsset.value) : 0)
const goalCurrent = computed(() => mainGoal.value?.currentValue ?? currentNet.value)
const goalPct = computed(() => mainGoal.value ? goalProgress(mainGoal.value, goalCurrent.value) : 0)
const goalTimePct = computed(() => mainGoal.value ? goalTimeRatio(mainGoal.value) * 100 : 0)
const gapToGoal = computed(() => mainGoal.value ? Math.max(0, mainGoal.value.targetValue - goalCurrent.value) : 0)

// —— 本月财务 ——
const mk = monthKey()
const monthExpense = computed(() => monthlyExpense(store.consumptions, mk))
const monthIncome = computed(() => monthlyIncome(store.incomes, mk))
const monthBalance = computed(() => monthIncome.value - monthExpense.value)
const savingRate = computed(() => savingsRate(monthIncome.value, monthExpense.value) * 100)

// —— 学习 / 读书 / 任务 ——
const hours = computed(() => studyHours(store.learnings))
const bStats = computed(() => bookStats(store.books))
const planDone = computed(() => store.plans.filter(p => p.status === 'done').length)
const planTotal = computed(() => store.plans.length)
const taskRate = computed(() => planCompletion(store.plans))
const doneToday = computed(() => {
  const rec = store.dailyRecords.find(r => r.date === today)
  return rec ? (rec.tasksDone?.length || 0) : 0
})

// —— 图表 ——
const catPie = computed(() => {
  const m = monthExpense.value
  const map = sumBy(store.consumptions.filter(c => c.date.startsWith(mk)), 'category')
  return {
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: '#6b6256', fontSize: 12 } },
    series: [{
      type: 'pie', radius: ['42%', '68%'], center: ['50%', '44%'],
      itemStyle: { borderRadius: 6, borderColor: '#fffdf7', borderWidth: 2 },
      label: { show: false },
      data: Object.entries(map).map(([name, value]) => ({ name, value, itemStyle: { color: CATEGORY_COLORS[name] || '#9a8f7f' } }))
    }]
  }
})
const assetLine = computed(() => {
  const curve = assetCurve(store.assets).slice(-12)
  return {
    tooltip: { trigger: 'axis', valueFormatter: v => '¥' + Number(v).toLocaleString() },
    grid: { left: 8, right: 12, top: 24, bottom: 0, containLabel: true },
    xAxis: { type: 'category', data: curve.map(c => c.month), axisLabel: { color: '#9a8f7f' }, axisLine: { lineStyle: { color: '#eadfc8' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0e8d8' } }, axisLabel: { color: '#9a8f7f', formatter: v => (v / 10000).toFixed(1) + '万' } },
    series: [{
      type: 'line', smooth: true, symbolSize: 7,
      data: curve.map(c => c.value),
      itemStyle: { color: '#5b8c85' },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(91,140,133,.28)' }, { offset: 1, color: 'rgba(91,140,133,.02)' }] } }
    }]
  }
})

function go(path) { router.push(path) }
function goDaily() { router.push('/daily') }
</script>

<template>
  <div class="stagger">
    <!-- 顶部问候 -->
    <div class="welcome row-between wrap gap-12 mb-16">
      <div>
        <h1 class="page-title">☁️ {{ user.name || '追梦人' }}，今日 {{ weekdayCn(today) }}</h1>
        <p class="page-sub">{{ cnDate(today) }} · 莫负好时光，今日已记录 {{ doneToday }} 项任务</p>
      </div>
      <button class="btn btn-pink btn-bounce" @click="goDaily">✍️ 今日打卡</button>
    </div>

    <!-- 核心指标 -->
    <div class="grid grid-4 mb-16">
      <StatCard label="当前净资产" :value="'¥ ' + fmtMoneyShort(currentNet)" :icon="'🪙'" color="#5b8c85" sub="近月资产快照" />
      <StatCard label="本月结余" :value="'¥ ' + fmtMoney(monthBalance)" :icon="'🌊'" :color="monthBalance >= 0 ? '#6f9a5c' : '#c0553f'" sub="收入 - 支出" />
      <StatCard label="累计学习" :value="fmtDuration(hours * 60)" :icon="'🎓'" color="#7b95b5" :sub="'共 ' + store.learnings.length + ' 次记录'" />
      <StatCard label="读书 / 任务完成率" :value="bStats.read + ' 本 · ' + fmtPercent(taskRate)" :icon="'📚'" color="#d9a94e" :sub="planTotal ? planDone + '/' + planTotal + ' 项任务完成' : '暂无任务'" />
    </div>

    <div class="grid mb-16" style="grid-template-columns: 1.2fr 1fr;">
      <!-- 主目标 -->
      <Card title="六年目标：净资产 100 万" icon="🎯">
        <template v-if="mainGoal">
          <div class="row-between mb-8">
            <div>
              <div class="goal-big">{{ fmtMoneyShort(goalCurrent) }} <span class="muted small">/ {{ fmtWan(mainGoal.targetValue, 0) }} 万</span></div>
              <div class="small muted">还差 <b style="color:var(--red)">¥ {{ fmtMoneyShort(gapToGoal) }}</b> · {{ cnDate(mainGoal.endDate) }} 截止</div>
            </div>
            <div class="seal">{{ Math.floor(goalPct) }}%</div>
          </div>
          <ProgressBar :value="goalPct" color="gold" :height="14" />
          <div class="row-between small muted mt-8">
            <span>进度 {{ fmtPercent(goalPct) }}</span>
            <span>时间流逝 {{ fmtPercent(goalTimePct, 0) }}</span>
          </div>
          <div v-if="gapToGoal > 0" class="tips mt-12">
            💡 按当前结余测算，距目标还差 {{ fmtMoneyShort(gapToGoal) }}，继续加油！
          </div>
        </template>
        <EmptyState v-else emoji="🎯" text="还没有长期目标" sub="去「目标管理」创建你的 100 万目标吧" />
        <div class="mt-16">
          <button class="btn btn-sm btn-ghost" @click="go('/goals')">管理目标 →</button>
          <button class="btn btn-sm btn-ghost" style="margin-left:8px" @click="go('/assets')">查看资产 →</button>
        </div>
      </Card>

      <!-- 本月支出结构 -->
      <Card title="本月支出结构" icon="💰">
        <BaseChart v-if="monthExpense > 0" :option="catPie" height="220px" />
        <EmptyState v-else emoji="🍃" text="本月还没有消费记录" sub="去「消费财务」记一笔" />
        <div class="row-between small muted mt-8">
          <span>本月支出 ¥ {{ fmtMoney(monthExpense) }}</span>
          <span>结余率 {{ fmtPercent(savingRate, 0) }}</span>
        </div>
      </Card>
    </div>

    <div class="grid mb-16" style="grid-template-columns: 1fr 1fr;">
      <!-- 近期计划 -->
      <Card title="近期计划" icon="📜">
        <div v-if="store.plans.length" class="plan-mini-list">
          <div v-for="p in store.plans.slice(0, 5)" :key="p.id" class="plan-mini row-between">
            <div class="ellipsis" style="max-width: 70%">
              <span class="dot" :class="'s-' + p.status"></span>{{ p.name }}
            </div>
            <span class="small muted">{{ p.period }}</span>
          </div>
        </div>
        <EmptyState v-else emoji="📜" text="暂无计划" sub="去「计划制定」创建你的每日/每周计划" />
        <button class="btn btn-sm btn-ghost mt-12" @click="go('/plans')">全部计划 →</button>
      </Card>

      <!-- 今日记录快照 -->
      <Card title="今日记录" icon="✍️">
        <div v-if="doneToday" class="small muted">已完成：</div>
        <ul v-if="doneToday" class="done-list">
          <li v-for="(t, i) in (store.dailyRecords.find(r => r.date === today)?.tasksDone || []).slice(0, 5)" :key="i">☑ {{ t }}</li>
        </ul>
        <EmptyState v-else emoji="✍️" text="今天还没记录" sub="点击右上角「今日打卡」开始记录" />
      </Card>
    </div>

    <!-- 净资产趋势 -->
    <Card title="净资产趋势" icon="📈">
      <BaseChart v-if="store.assets.length" :option="assetLine" height="260px" />
      <EmptyState v-else emoji="📈" text="暂无资产快照" sub="去「资产追踪」按月记录总资产" />
    </Card>
  </div>
</template>

<style scoped>
.goal-big { font-size: 30px; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
.tips { background: var(--gold-soft); border-radius: 10px; padding: 8px 12px; font-size: 13px; color: #8a6a1f; }
.plan-mini { padding: 7px 0; border-bottom: 1px dashed var(--line-soft); }
.plan-mini:last-child { border-bottom: none; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 7px; }
.dot.s-进行中 { background: var(--gold); }
.dot.s-已完成 { background: var(--green); }
.dot.s-未开始 { background: var(--ink-3); }
.dot.s-已放弃 { background: var(--red); }
.done-list { list-style: none; }
.done-list li { padding: 5px 0; font-size: 14px; color: var(--ink-2); }
</style>
