<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/dataStore.js'
import { useUiStore } from '../stores/uiStore.js'
import Card from '../components/common/Card.vue'
import EmptyState from '../components/common/EmptyState.vue'
import BaseChart from '../components/charts/BaseChart.vue'
import { todayStr, addDays, weekRange, monthRange, quarterRange, yearRange } from '../utils/date.js'
import { sumAmount, sumBy, categoryByWeekday, studyHours, planCompletion, bookStats } from '../utils/calc.js'
import { fmtMoney, fmtDuration, fmtPercent } from '../utils/format.js'
import { exportMarkdown } from '../utils/export.js'
import { CATEGORY_COLORS } from '../utils/defaultData.js'

const store = useDataStore()
const ui = useUiStore()

const start = ref('')
const end = ref('')
const rangeLabel = ref('')

function setRange(s, e, label) { start.value = s; end.value = e; rangeLabel.value = label }
function initRange() {
  const m = monthRange()
  setRange(m.start, m.end, '本月')
}
initRange()

const consumptions = computed(() => store.consumptions.filter(c => c.date >= start.value && c.date <= end.value))
const incomes = computed(() => store.incomes.filter(i => i.date >= start.value && i.date <= end.value))
const learnings = computed(() => store.learnings.filter(l => l.date >= start.value && l.date <= end.value))

const expense = computed(() => sumAmount(consumptions.value))
const income = computed(() => sumAmount(incomes.value))
const balance = computed(() => income.value - expense.value)
const hours = computed(() => studyHours(learnings.value))
const books = computed(() => bookStats(store.books))
const taskRate = computed(() => planCompletion(store.plans.filter(p => p.status === 'done' || p.status === '进行中')))
const spendingCount = computed(() => consumptions.value.length)
const avgPerDay = computed(() => {
  const days = Math.max(1, Math.round((new Date(end.value) - new Date(start.value)) / 86400000) + 1)
  return expense.value / days
})

/* —— 图表 —— */
const pieOption = computed(() => {
  const map = sumBy(consumptions.value, 'category')
  return {
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: '#6b6256', fontSize: 12 } },
    series: [{
      type: 'pie', radius: ['38%', '64%'], center: ['50%', '42%'],
      itemStyle: { borderRadius: 6, borderColor: '#fffdf7', borderWidth: 2 }, label: { show: false },
      data: Object.entries(map).map(([name, value]) => ({ name, value, itemStyle: { color: CATEGORY_COLORS[name] || '#9a8f7f' } }))
    }]
  }
})

// 交叉分析：周末 vs 工作日的冲动消费
const weekdayImpulse = computed(() => {
  const week = { 工作日: 0, 周末: 0 }
  const impul = { 工作日: 0, 周末: 0 }
  for (const c of consumptions.value) {
    if (!c.mode || c.mode !== '冲动') continue
    const d = new Date(c.date)
    const isWeekend = d.getDay() === 0 || d.getDay() === 6
    const key = isWeekend ? '周末' : '工作日'
    week[key]++
    impul[key] += Number(c.amount) || 0
  }
  return { week, impul }
})

const weekdayBarOption = computed(() => {
  const cats = ['餐饮', '娱乐', '学习', '交通', '其他']
  const data = cats.map(c => categoryByWeekday(consumptions.value, c))
  const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: v => '¥' + Number(v).toLocaleString() },
    legend: { bottom: 0, textStyle: { color: '#6b6256', fontSize: 12 } },
    grid: { left: 8, right: 12, top: 30, bottom: 6, containLabel: true },
    xAxis: { type: 'category', data: weekdays, axisLabel: { color: '#9a8f7f' }, axisLine: { lineStyle: { color: '#eadfc8' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0e8d8' } }, axisLabel: { color: '#9a8f7f' } },
    series: cats.map((c, i) => ({
      name: c, type: 'bar',
      itemStyle: { color: [CATEGORY_COLORS[c] || '#9a8f7f'][0], borderRadius: i === 0 ? [4, 4, 0, 0] : undefined },
      data: weekdays.map(w => data[i][w] || 0)
    }))
  }
})

// 交叉分析：学习时长 × 每日（观察学习与副业收入是否相关——按周聚合）
const studyIncomeScatter = computed(() => {
  // 按月汇总学习时长与副业收入
  const map = {}
  for (const l of learnings.value) {
    const k = l.date.slice(0, 7)
    map[k] = map[k] || { month: k, hours: 0, sideIncome: 0 }
    map[k].hours += Number(l.minutes || 0) / 60
  }
  for (const i of incomes.value) {
    if (i.type !== '副业') continue
    const k = i.date.slice(0, 7)
    if (!map[k]) map[k] = { month: k, hours: 0, sideIncome: 0 }
    map[k].sideIncome += Number(i.amount || 0)
  }
  return Object.values(map).sort((a, b) => (a.month < b.month ? -1 : 1))
})
const scatterOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: p => `${p.data[2]}<br/>学习 ${p.data[0].toFixed(1)}h · 副业 ¥${p.data[1].toLocaleString()}` },
  grid: { left: 8, right: 12, top: 20, bottom: 0, containLabel: true },
  xAxis: { name: '学习时长(h)', type: 'value', axisLabel: { color: '#9a8f7f' }, splitLine: { lineStyle: { color: '#f0e8d8' } } },
  yAxis: { name: '副业收入(元)', type: 'value', axisLabel: { color: '#9a8f7f' }, splitLine: { lineStyle: { color: '#f0e8d8' } } },
  series: [{
    type: 'scatter', symbolSize: 14,
    data: studyIncomeScatter.value.map(d => [Math.round(d.hours * 10) / 10, d.sideIncome, d.month]),
    itemStyle: { color: '#5b8c85', opacity: .75 }
  }]
}))

/* —— 报告生成 —— */
function buildReportSections() {
  const catMap = sumBy(consumptions.value, 'category')
  const modeMap = sumBy(consumptions.value, 'mode')
  return [
    { heading: '核心指标', items: [
      `统计区间：${start.value} ~ ${end.value}`,
      `总支出：¥${fmtMoney(expense.value)}（${spendingCount.value} 笔，日均 ¥${fmtMoney(avgPerDay.value)}）`,
      `总收入：¥${fmtMoney(income.value)}`,
      `结余：¥${fmtMoney(balance.value)}`,
      `学习时长：${fmtDuration(hours.value * 60)}`,
      `读书：已读 ${books.value.read} 本，在读 ${books.value.reading} 本`,
      `计划完成率：${fmtPercent(taskRate.value, 0)}`
    ] },
    { heading: '支出结构', items: Object.entries(catMap).map(([k, v]) => `${k}：¥${fmtMoney(v)}（${expense.value ? ((v / expense.value) * 100).toFixed(1) : 0}%）`) },
    { heading: '消费模式', items: Object.entries(modeMap).map(([k, v]) => `${k}：¥${fmtMoney(v)}`) },
    { heading: '周末冲动消费', items: [
      `周末冲动消费 ¥${fmtMoney(weekdayImpulse.value.impul['周末'])} / ${weekdayImpulse.value.week['周末']} 笔`,
      `工作日冲动消费 ¥${fmtMoney(weekdayImpulse.value.impul['工作日'])} / ${weekdayImpulse.value.week['工作日']} 笔`
    ] },
    { heading: '学习 × 副业（按月）', table: studyIncomeScatter.value.map(d => ({ 月份: d.month, 学习时长小时: d.hours.toFixed(1), 副业收入: d.sideIncome })) }
  ]
}
function exportReport() {
  const label = rangeLabel.value || `${start.value}~${end.value}`
  exportMarkdown(`人生数据报告-${label}.md`, `人生数据报告（${label}）`, buildReportSections())
  ui.toast('已导出 Markdown 报告', 'success')
}
function printReport() {
  window.print()
  ui.toast('可通过浏览器「另存为 PDF」导出报告', 'success')
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h1 class="page-title">📊 数据统计与分析</h1>
      <div class="spacer"></div>
      <button class="btn btn-sm btn-ghost" @click="exportReport">导出 Markdown 报告</button>
      <button class="btn btn-sm btn-ghost" @click="printReport">打印 / 存为 PDF</button>
    </div>

    <Card class="mb-16">
      <div class="row gap-8 wrap">
        <span class="small muted">统计区间：</span>
        <button v-for="q in [['近7天', weekRange(todayStr()).end, null], ['本月', null, null]]" :key="q[0]" class="btn btn-sm" :class="rangeLabel === q[0] ? '' : 'btn-ghost'" @click="initRange()">本月</button>
        <button class="btn btn-sm" :class="rangeLabel === '本季' ? '' : 'btn-ghost'" @click="setRange(quarterRange().start, quarterRange().end, '本季')">本季</button>
        <button class="btn btn-sm" :class="rangeLabel === '本年' ? '' : 'btn-ghost'" @click="setRange(yearRange().start, yearRange().end, '本年')">本年</button>
        <button class="btn btn-sm" :class="rangeLabel === '近30天' ? '' : 'btn-ghost'" @click="setRange(addDays(todayStr(), -29), todayStr(), '近30天')">近30天</button>
        <button class="btn btn-sm" :class="rangeLabel === '全部' ? '' : 'btn-ghost'" @click="setRange('0000-01-01', todayStr(), '全部')">全部</button>
        <input type="date" v-model="start" style="width:140px" @change="rangeLabel = start + '~' + end" />
        <span class="muted">至</span>
        <input type="date" v-model="end" style="width:140px" @change="rangeLabel = start + '~' + end" />
      </div>
    </Card>

    <div class="grid grid-4 mb-16">
      <div class="stat-card"><div class="s-label">区间支出</div><div class="s-value" style="color:#c96a4a">¥ {{ fmtMoney(expense) }}</div><div class="s-sub">日均 ¥ {{ fmtMoney(avgPerDay) }}</div></div>
      <div class="stat-card"><div class="s-label">区间收入</div><div class="s-value" style="color:#6f9a5c">¥ {{ fmtMoney(income) }}</div><div class="s-sub">结余 ¥ {{ fmtMoney(balance) }}</div></div>
      <div class="stat-card"><div class="s-label">学习时长</div><div class="s-value" style="color:#7b95b5">{{ fmtDuration(hours * 60) }}</div><div class="s-sub">{{ learnings.length }} 条记录</div></div>
      <div class="stat-card"><div class="s-label">读书 / 任务</div><div class="s-value" style="color:#d9a94e">{{ books.read }} 本 · {{ fmtPercent(taskRate, 0) }}</div><div class="s-sub">计划完成率</div></div>
    </div>

    <div class="grid mb-16" style="grid-template-columns: 1fr 1fr;">
      <Card title="支出结构" icon="🥧">
        <BaseChart v-if="expense > 0" :option="pieOption" height="260px" />
        <EmptyState v-else emoji="🍃" text="区间内暂无支出" />
      </Card>
      <Card title="分类 × 星期（观察周末消费规律）" icon="📆">
        <BaseChart v-if="expense > 0" :option="weekdayBarOption" height="260px" />
        <EmptyState v-else emoji="📆" text="暂无数据" />
      </Card>
    </div>

    <div class="grid mb-16" style="grid-template-columns: 1fr 1fr;">
      <Card title="交叉分析：冲动消费 · 工作日 vs 周末" icon="🔍">
        <div class="row gap-12 wrap">
          <div class="cross-box">
            <div class="small muted">周末冲动消费</div>
            <div class="cross-num" style="color:#c96a4a">¥ {{ fmtMoney(weekdayImpulse.impul['周末']) }}</div>
            <div class="small muted">{{ weekdayImpulse.week['周末'] }} 笔 · 占比 {{ (weekdayImpulse.impul['周末'] + weekdayImpulse.impul['工作日']) ? ((weekdayImpulse.impul['周末'] / (weekdayImpulse.impul['周末'] + weekdayImpulse.impul['工作日'])) * 100).toFixed(0) : 0 }}%</div>
          </div>
          <div class="cross-box">
            <div class="small muted">工作日冲动消费</div>
            <div class="cross-num" style="color:#5b8c85">¥ {{ fmtMoney(weekdayImpulse.impul['工作日']) }}</div>
            <div class="small muted">{{ weekdayImpulse.week['工作日'] }} 笔</div>
          </div>
        </div>
        <div class="tips mt-12" v-if="weekdayImpulse.impul['周末'] > weekdayImpulse.impul['工作日']">
          💡 周末冲动消费高于工作日，试着周末外出前先列清单、延迟 24 小时再买。
        </div>
      </Card>
      <Card title="交叉分析：副业收入 × 学习时长（按月）" icon="🧠">
        <BaseChart v-if="studyIncomeScatter.length" :option="scatterOption" height="260px" />
        <EmptyState v-else emoji="🧠" text="暂无学习或副业数据" sub="记录学习与副业收入后，这里会展示相关性" />
      </Card>
    </div>
  </div>
</template>

<style scoped>
.cross-box { background: #fdfaf2; border: 1px solid var(--line-soft); border-radius: 12px; padding: 12px 16px; flex: 1; }
.cross-num { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; }
.tips { background: var(--gold-soft); border-radius: 10px; padding: 8px 12px; font-size: 13px; color: #8a6a1f; }
</style>
