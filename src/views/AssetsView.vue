<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/dataStore.js'
import { useUiStore } from '../stores/uiStore.js'
import Card from '../components/common/Card.vue'
import Modal from '../components/common/Modal.vue'
import EmptyState from '../components/common/EmptyState.vue'
import ProgressBar from '../components/common/ProgressBar.vue'
import BaseChart from '../components/charts/BaseChart.vue'
import { monthKey } from '../utils/date.js'
import { netWorth, assetCurve, annualGrowthRate, goalProgress, goalTimeRatio } from '../utils/calc.js'
import { fmtMoney, fmtMoneyShort, fmtPercent, confirmDelete } from '../utils/format.js'

const store = useDataStore()
const ui = useUiStore()

const showModal = ref(false)
const editing = ref(null)
const form = ref({})

const sorted = computed(() => [...store.assets].sort((a, b) => (a.month < b.month ? -1 : 1)))
const latest = computed(() => sorted.value[sorted.value.length - 1] || null)
const currentNet = computed(() => latest.value ? netWorth(latest.value) : 0)

const mainGoal = computed(() => store.goals.find(g => g.name.includes('100')) || store.goals[0] || null)
const gap = computed(() => mainGoal.value ? Math.max(0, mainGoal.value.targetValue - currentNet.value) : null)
const goalPct = computed(() => mainGoal.value ? goalProgress(mainGoal.value, currentNet.value) : 0)
const goalTime = computed(() => mainGoal.value ? goalTimeRatio(mainGoal.value) * 100 : 0)

const growth = computed(() => {
  if (sorted.value.length < 2) return 0
  const first = netWorth(sorted.value[0])
  const last = currentNet.value
  const months = Math.max(1, sorted.value.length - 1)
  return annualGrowthRate(first, last, months) * 100
})

const totalMonths = computed(() => sorted.value.length)

const curveOption = computed(() => {
  const curve = assetCurve(store.assets)
  const target = mainGoal.value?.targetValue
  const xData = [...curve.map(c => c.month)]
  if (target) xData.push('目标')
  return {
    tooltip: { trigger: 'axis', valueFormatter: v => '¥' + Number(v).toLocaleString() },
    legend: { data: ['净资产', '目标线'], textStyle: { color: '#6b6256', fontSize: 12 } },
    grid: { left: 8, right: 12, top: 36, bottom: 0, containLabel: true },
    xAxis: { type: 'category', data: xData, axisLabel: { color: '#9a8f7f' }, axisLine: { lineStyle: { color: '#eadfc8' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0e8d8' } }, axisLabel: { color: '#9a8f7f', formatter: v => (v / 10000).toFixed(1) + '万' } },
    series: [
      {
        name: '净资产', type: 'line', smooth: true, symbolSize: 8,
        data: [...curve.map(c => c.value), target ? target : null],
        itemStyle: { color: '#5b8c85' },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(91,140,133,.3)' }, { offset: 1, color: 'rgba(91,140,133,.02)' }] } }
      },
      { name: '目标线', type: 'line', data: Array(xData.length).fill(target), lineStyle: { type: 'dashed', color: '#d9a94e' }, symbol: 'none' }
    ]
  }
})

const stackOption = computed(() => {
  const s = sorted.value.slice(-12)
  return {
    tooltip: { trigger: 'axis', valueFormatter: v => '¥' + Number(v).toLocaleString() },
    legend: { data: ['现金', '基金', '股票', '其他'], bottom: 0, textStyle: { color: '#6b6256', fontSize: 12 } },
    grid: { left: 8, right: 12, top: 30, bottom: 6, containLabel: true },
    xAxis: { type: 'category', data: s.map(a => a.month), axisLabel: { color: '#9a8f7f' }, axisLine: { lineStyle: { color: '#eadfc8' } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0e8d8' } }, axisLabel: { color: '#9a8f7f' } },
    series: [
      { name: '现金', type: 'bar', stack: 'a', data: s.map(a => a.cash || 0), itemStyle: { color: '#7a9e6b' } },
      { name: '基金', type: 'bar', stack: 'a', data: s.map(a => a.fund || 0), itemStyle: { color: '#7b95b5' } },
      { name: '股票', type: 'bar', stack: 'a', data: s.map(a => a.stock || 0), itemStyle: { color: '#e0a1a1' } },
      { name: '其他', type: 'bar', stack: 'a', data: s.map(a => a.other || 0), itemStyle: { color: '#d9a94e' } }
    ]
  }
})

function openNew() {
  editing.value = null
  form.value = { month: monthKey(), cash: 0, fund: 0, stock: 0, other: 0, note: '' }
  showModal.value = true
}
function openEdit(a) {
  editing.value = a
  form.value = { month: a.month, cash: a.cash || 0, fund: a.fund || 0, stock: a.stock || 0, other: a.other || 0, note: a.note || '' }
  showModal.value = true
}
function save() {
  const payload = {
    month: form.value.month, cash: Number(form.value.cash) || 0, fund: Number(form.value.fund) || 0,
    stock: Number(form.value.stock) || 0, other: Number(form.value.other) || 0, note: form.value.note
  }
  // 同一月份已存在则更新
  const exist = store.assets.find(a => a.month === payload.month && (!editing.value || a.id !== editing.value.id))
  if (exist) store.updateItem('assets', exist.id, payload)
  else if (editing.value) store.updateItem('assets', editing.value.id, payload)
  else store.addItem('assets', payload)
  showModal.value = false
  ui.toast('资产快照已保存 🪙', 'success')
}
function remove(a) {
  if (!confirmDelete(a.month + ' 资产记录')) return
  store.removeItem('assets', a.id); ui.toast('已删除')
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h1 class="page-title">🪙 存款与资产追踪</h1>
      <div class="spacer"></div>
      <button class="btn btn-bounce" @click="openNew">＋ 记录本月资产</button>
    </div>
    <p class="page-sub">每月记录一次总资产，见证净资产一步步逼近目标。</p>

    <div class="grid grid-4 mb-16">
      <div class="stat-card"><div class="s-label">当前净资产</div><div class="s-value" style="color:#5b8c85">¥ {{ fmtMoneyShort(currentNet) }}</div><div class="s-sub">截至 {{ latest?.month || '—' }}</div></div>
      <div class="stat-card"><div class="s-label">距目标还差</div><div class="s-value" style="color:#c96a4a">¥ {{ fmtMoneyShort(gap ?? 0) }}</div><div class="s-sub">目标 ¥ {{ fmtMoneyShort(mainGoal?.targetValue || 0) }}</div></div>
      <div class="stat-card"><div class="s-label">已记录月份</div><div class="s-value" style="color:#7b95b5">{{ totalMonths }} 个月</div><div class="s-sub">月均净资产 {{ fmtMoneyShort(totalMonths ? currentNet / Math.max(totalMonths, 1) : 0) }}</div></div>
      <div class="stat-card"><div class="s-label">年化增长率</div><div class="s-value" :style="{ color: growth >= 0 ? '#6f9a5c' : '#c0553f' }">{{ fmtPercent(growth, 2) }}</div><div class="s-sub">按已有快照测算</div></div>
    </div>

    <Card v-if="mainGoal" title="与目标对比" icon="🎯" class="mb-16">
      <div class="row-between mb-4">
        <span class="bold">净资产 ¥ {{ fmtMoneyShort(currentNet) }} / ¥ {{ fmtMoneyShort(mainGoal.targetValue) }}</span>
        <span class="small muted">{{ fmtPercent(goalPct) }} · 时间流逝 {{ fmtPercent(goalTime, 0) }}</span>
      </div>
      <ProgressBar :value="goalPct" color="gold" :height="14" />
    </Card>

    <div class="grid mb-16" style="grid-template-columns: 1fr 1fr;">
      <Card title="净资产变化曲线" icon="📈">
        <BaseChart v-if="sorted.length" :option="curveOption" height="280px" />
        <EmptyState v-else emoji="📈" text="暂无资产快照" />
      </Card>
      <Card title="资产构成" icon="🏦">
        <BaseChart v-if="sorted.length" :option="stackOption" height="280px" />
        <EmptyState v-else emoji="🏦" text="暂无资产快照" />
      </Card>
    </div>

    <Card title="历史快照" icon="🗓️">
      <div v-if="sorted.length" class="snap-list">
        <div v-for="a in [...sorted].reverse()" :key="a.id" class="snap row-between">
          <div>
            <span class="bold">{{ a.month }}</span>
            <span v-if="a.note" class="small muted"> · {{ a.note }}</span>
          </div>
          <div class="row gap-12">
            <span class="small muted">现金 {{ fmtMoney(a.cash) }} · 基金 {{ fmtMoney(a.fund) }} · 股票 {{ fmtMoney(a.stock) }}</span>
            <span class="bold" style="color:var(--cyan-deep)">¥ {{ fmtMoney(netWorth(a)) }}</span>
            <button class="btn btn-sm btn-ghost" @click="openEdit(a)">改</button>
            <button class="btn btn-sm btn-ghost" @click="remove(a)">删</button>
          </div>
        </div>
      </div>
      <EmptyState v-else emoji="🗓️" text="还没有资产快照" sub="点击右上角「记录本月资产」" />
    </Card>

    <Modal :title="editing ? '编辑资产快照' : '记录本月资产'" icon="🪙" @close="showModal = false" v-if="showModal">
      <div class="form-grid">
        <div class="form-field"><label>月份</label><input type="month" v-model="form.month" /></div>
        <div class="form-field"><label>备注</label><input v-model="form.note" /></div>
        <div class="form-field"><label>现金</label><input type="number" v-model="form.cash" /></div>
        <div class="form-field"><label>基金</label><input type="number" v-model="form.fund" /></div>
        <div class="form-field"><label>股票</label><input type="number" v-model="form.stock" /></div>
        <div class="form-field"><label>其他</label><input type="number" v-model="form.other" /></div>
      </div>
      <div class="small bold mt-8" style="color:var(--cyan-deep)">净资产 = ¥ {{ fmtMoney((Number(form.cash)||0) + (Number(form.fund)||0) + (Number(form.stock)||0) + (Number(form.other)||0)) }}</div>
      <button class="btn btn-block mt-16" @click="save">保存快照</button>
    </Modal>
  </div>
</template>

<style scoped>
.snap-list { display: flex; flex-direction: column; }
.snap { padding: 10px 6px; border-bottom: 1px dashed var(--line-soft); }
@media (max-width: 640px) { .snap { flex-wrap: wrap; gap: 6px; } }
</style>
