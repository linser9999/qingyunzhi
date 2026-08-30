<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/dataStore.js'
import { useUiStore } from '../stores/uiStore.js'
import Modal from '../components/common/Modal.vue'
import EmptyState from '../components/common/EmptyState.vue'
import BaseChart from '../components/charts/BaseChart.vue'
import { todayStr } from '../utils/date.js'
import { fmtPercent, fmtDuration, confirmDelete } from '../utils/format.js'
import { PLAN_PERIODS, PLAN_STATUS } from '../utils/defaultData.js'

const store = useDataStore()
const ui = useUiStore()

const showModal = ref(false)
const editing = ref(null)
const form = ref({})
const filterStatus = ref('全部')
const filterPeriod = ref('全部')
const keyword = ref('')
const dragId = ref(null)

const statusColor = { 未开始: 'gray', 进行中: 'gold', 已完成: 'green', 已放弃: 'red' }

const filtered = computed(() => {
  let list = [...store.plans]
  if (filterStatus.value !== '全部') list = list.filter(p => p.status === filterStatus.value)
  if (filterPeriod.value !== '全部') list = list.filter(p => p.period === filterPeriod.value)
  if (keyword.value) list = list.filter(p => p.name.includes(keyword.value))
  return list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
})

/* —— 统计分析 —— */
const stats = computed(() => {
  const all = store.plans
  const byStatus = {}
  PLAN_STATUS.forEach(s => { byStatus[s] = all.filter(p => p.status === s).length })
  const byPriority = { 高: 0, 中: 0, 低: 0 }
  all.forEach(p => { const k = p.priority === 1 ? '高' : p.priority === 3 ? '低' : '中'; byPriority[k]++ })
  const byPeriod = {}
  PLAN_PERIODS.forEach(p => { byPeriod[p] = all.filter(x => x.period === p).length })
  const done = byStatus['已完成'] || 0
  const abandoned = byStatus['已放弃'] || 0
  const active = all.length - done - abandoned
  const completionRate = all.length ? (done / all.length) * 100 : 0
  const avgProgress = all.length ? all.reduce((s, p) => s + (p.progress || 0), 0) / all.length : 0
  const linkedGoals = all.filter(p => p.goalId).length
  return { total: all.length, byStatus, byPriority, byPeriod, done, abandoned, active, completionRate, avgProgress, linkedGoals }
})

const statusChartOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} 项 ({d}%)' },
  legend: { bottom: 0, textStyle: { color: '#6b6256', fontSize: 12 } },
  series: [{
    type: 'pie', radius: ['38%', '62%'], center: ['50%', '42%'],
    itemStyle: { borderRadius: 6, borderColor: '#fffdf7', borderWidth: 2 },
    label: { show: false },
    data: [
      { name: '已完成', value: stats.value.byStatus['已完成'] || 0, itemStyle: { color: '#7a9e6b' } },
      { name: '进行中', value: stats.value.byStatus['进行中'] || 0, itemStyle: { color: '#d9a94e' } },
      { name: '未开始', value: stats.value.byStatus['未开始'] || 0, itemStyle: { color: '#7b95b5' } },
      { name: '已放弃', value: stats.value.byStatus['已放弃'] || 0, itemStyle: { color: '#c96a4a' } }
    ].filter(d => d.value > 0)
  }]
}))

const priorityChartOption = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
  grid: { left: 8, right: 12, top: 20, bottom: 6, containLabel: true },
  xAxis: { type: 'category', data: ['高', '中', '低'], axisLabel: { color: '#9a8f7f' }, axisLine: { lineStyle: { color: '#eadfc8' } } },
  yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f0e8d8' } }, axisLabel: { color: '#9a8f7f' } },
  series: [{
    type: 'bar', barWidth: '40%',
    data: [
      { value: stats.value.byPriority['高'], itemStyle: { color: '#c96a4a', borderRadius: [6,6,0,0] } },
      { value: stats.value.byPriority['中'], itemStyle: { color: '#d9a94e', borderRadius: [6,6,0,0] } },
      { value: stats.value.byPriority['低'], itemStyle: { color: '#7a9e6b', borderRadius: [6,6,0,0] } }
    ]
  }]
}))

function openNew() {
  editing.value = null
  form.value = {
    name: '', goalId: '', period: '一次性', startDate: todayStr(), endDate: '',
    startTime: '', endTime: '', priority: 2, status: '未开始', progress: 0,
    repeat: { type: 'daily', weekDays: [], interval: 1 }
  }
  showModal.value = true
}
function openEdit(p) {
  editing.value = p
  form.value = {
    name: p.name, goalId: p.goalId || '', period: p.period || '一次性',
    startDate: p.startDate, endDate: p.endDate || '', startTime: p.startTime || '',
    endTime: p.endTime || '', priority: p.priority || 2, status: p.status || '未开始',
    progress: p.progress || 0, repeat: p.repeat || { type: 'daily', weekDays: [], interval: 1 }
  }
  showModal.value = true
}
function save() {
  if (!form.value.name) { ui.toast('请填写任务名称', 'warning'); return }
  const payload = {
    name: form.value.name, goalId: form.value.goalId, period: form.value.period,
    startDate: form.value.startDate, endDate: form.value.endDate || form.value.startDate,
    startTime: form.value.startTime, endTime: form.value.endTime,
    priority: Number(form.value.priority), status: form.value.status, progress: Number(form.value.progress) || 0,
    repeat: form.value.repeat
  }
  if (editing.value) store.updateItem('plans', editing.value.id, payload)
  else store.addItem('plans', { ...payload, sortOrder: store.plans.length })
  showModal.value = false
  ui.toast('计划已保存', 'success')
}
function remove(p) {
  if (!confirmDelete(p.name)) return
  store.removeItem('plans', p.id); ui.toast('计划已删除')
}
function cycleStatus(p) {
  const map = { 未开始: '进行中', 进行中: '已完成', 已完成: '未开始', 已放弃: '未开始' }
  store.updateItem('plans', p.id, { status: map[p.status] })
}
function goalName(id) { return store.goals.find(g => g.id === id)?.name || '' }

/* —— 拖拽排序 —— */
function onDragStart(p) { dragId.value = p.id }
function onDrop(target) {
  if (!dragId.value || dragId.value === target.id) return
  const list = [...store.plans]
  const from = list.findIndex(x => x.id === dragId.value)
  const to = list.findIndex(x => x.id === target.id)
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved)
  list.forEach((x, i) => { x.sortOrder = i })
  store.replaceAll('plans', list)
  ui.toast('已调整顺序', 'success')
  dragId.value = null
}
function move(dir, p) {
  const list = [...store.plans].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const i = list.findIndex(x => x.id === p.id)
  const j = i + dir
  if (j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j], list[i]]
  list.forEach((x, idx) => { x.sortOrder = idx })
  store.replaceAll('plans', list)
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h1 class="page-title">📜 计划制定</h1>
      <div class="spacer"></div>
      <button class="btn btn-pink btn-bounce" @click="openNew">＋ 新建计划</button>
    </div>

    <div class="toolbar">
      <select v-model="filterStatus" class="filter">
        <option>全部</option><option v-for="s in PLAN_STATUS" :key="s">{{ s }}</option>
      </select>
      <select v-model="filterPeriod" class="filter">
        <option>全部</option><option v-for="s in PLAN_PERIODS" :key="s">{{ s }}</option>
      </select>
      <input v-model="keyword" placeholder="搜索任务…" class="filter search" />
    </div>

    <!-- 统计分析 -->
    <div v-if="store.plans.length" class="mb-16">
      <div class="grid grid-4 mb-12">
        <div class="stat-card"><div class="s-label">总计划</div><div class="s-value" style="color:#5b8c85">{{ stats.total }}</div><div class="s-sub">活跃 {{ stats.active }} 项</div></div>
        <div class="stat-card"><div class="s-label">已完成</div><div class="s-value" style="color:#7a9e6b">{{ stats.done }}</div><div class="s-sub">完成率 {{ fmtPercent(stats.completionRate, 0) }}</div></div>
        <div class="stat-card"><div class="s-label">进行中</div><div class="s-value" style="color:#d9a94e">{{ stats.byStatus['进行中'] || 0 }}</div><div class="s-sub">平均进度 {{ fmtPercent(stats.avgProgress, 0) }}</div></div>
        <div class="stat-card"><div class="s-label">关联目标</div><div class="s-value" style="color:#7b95b5">{{ stats.linkedGoals }}</div><div class="s-sub">已放弃 {{ stats.abandoned }} 项</div></div>
      </div>
      <div class="grid" style="grid-template-columns: 1fr 1fr;">
        <div class="q-card">
          <h3 class="card-title">状态分布</h3>
          <BaseChart :option="statusChartOption" height="240px" />
        </div>
        <div class="q-card">
          <h3 class="card-title">优先级分布</h3>
          <BaseChart :option="priorityChartOption" height="240px" />
        </div>
      </div>
    </div>

    <Card v-if="filtered.length" title="任务清单" icon="🗂️">
      <div class="plan-head row small muted">
        <span style="flex:1">任务（可拖拽排序）</span>
        <span style="width:64px">状态</span>
        <span style="width:56px">优先级</span>
        <span style="width:80px">完成度</span>
        <span style="width:90px">操作</span>
      </div>
      <div
        v-for="p in filtered" :key="p.id"
        class="plan-row row"
        :class="{ dragging: dragId === p.id }"
        draggable="true"
        @dragstart="onDragStart(p)" @dragover.prevent @drop="onDrop(p)"
      >
        <div class="row gap-8" style="flex:1;min-width:0">
          <span class="drag-ico">⠿</span>
          <div style="min-width:0">
            <div class="ellipsis bold">{{ p.name }}</div>
            <div class="small muted">
              {{ p.period }} · {{ p.startDate }}{{ p.endDate && p.endDate !== p.startDate ? ' ~ ' + p.endDate : '' }}
              <span v-if="p.startTime">{{ ' ' + p.startTime }}<span v-if="p.endTime">-{{ p.endTime }}</span></span>
              <span v-if="goalName(p.goalId)"> · 🎯 {{ goalName(p.goalId) }}</span>
              <span v-if="p.repeat && p.repeat.type !== 'daily' && p.repeat.weekDays?.length" class="muted"> · 每周{{ p.repeat.weekDays.map(d => '一二三四五六日'[d]).join('、') }}</span>
            </div>
          </div>
        </div>
        <span style="width:64px">
          <span class="q-tag clickable" :class="'t-' + statusColor[p.status]" @click="cycleStatus(p)">{{ p.status }}</span>
        </span>
        <span style="width:56px" class="small">{{ ['', '🔴 高', '🟡 中', '🟢 低'][p.priority] || '' }}</span>
        <span style="width:80px" class="small">{{ fmtPercent(p.progress, 0) }}</span>
        <span style="width:90px" class="row gap-4">
          <button class="btn btn-sm btn-ghost" @click="openEdit(p)">改</button>
          <button class="btn btn-sm btn-ghost" @click="move(-1, p)">↑</button>
          <button class="btn btn-sm btn-ghost" @click="move(1, p)">↓</button>
          <button class="btn btn-sm btn-ghost" @click="remove(p)">删</button>
        </span>
      </div>
    </Card>
    <EmptyState v-else emoji="📜" text="暂无匹配计划" sub="点击右上角新建计划，支持每日/每周/每月重复任务" />

    <Modal :title="editing ? '编辑计划' : '新建计划'" icon="📜" @close="showModal = false" v-if="showModal">
      <div class="form-grid">
        <div class="form-field full">
          <label>任务名称 <span class="req">*</span></label>
          <input v-model="form.name" placeholder="如：每日 LeetCode 刷题 2 道" />
        </div>
        <div class="form-field">
          <label>所属目标</label>
          <select v-model="form.goalId">
            <option value="">不关联</option>
            <option v-for="g in store.goals" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
        </div>
        <div class="form-field">
          <label>周期</label>
          <select v-model="form.period">
            <option v-for="t in PLAN_PERIODS" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="form-field">
          <label>状态</label>
          <select v-model="form.status">
            <option v-for="s in PLAN_STATUS" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>
        <div class="form-field">
          <label>开始日期</label>
          <input type="date" v-model="form.startDate" />
        </div>
        <div class="form-field">
          <label>结束日期</label>
          <input type="date" v-model="form.endDate" />
        </div>
        <div class="form-field">
          <label>开始时间</label>
          <input type="time" v-model="form.startTime" />
        </div>
        <div class="form-field">
          <label>结束时间</label>
          <input type="time" v-model="form.endTime" />
        </div>
        <div class="form-field">
          <label>优先级</label>
          <select v-model="form.priority">
            <option :value="1">🔴 高</option>
            <option :value="2">🟡 中</option>
            <option :value="3">🟢 低</option>
          </select>
        </div>
        <div class="form-field">
          <label>完成度 (%)</label>
          <input type="number" v-model="form.progress" min="0" max="100" />
        </div>
        <div class="form-field">
          <label>重复类型</label>
          <select v-model="form.repeat.type">
            <option value="daily">每日</option>
            <option value="weekly">每周</option>
            <option value="monthly">每月</option>
          </select>
        </div>
        <div class="form-field" v-if="form.repeat.type === 'weekly'">
          <label>每周星期</label>
          <div class="row gap-4 wrap">
            <button
              v-for="(d, i) in ['一','二','三','四','五','六','日']" :key="i"
              class="wd-btn" :class="{ on: form.repeat.weekDays.includes(i) }"
              @click="form.repeat.weekDays.includes(i) ? form.repeat.weekDays.splice(form.repeat.weekDays.indexOf(i), 1) : form.repeat.weekDays.push(i)"
            >{{ d }}</button>
          </div>
        </div>
      </div>
      <button class="btn btn-block mt-16" @click="save">保存计划</button>
    </Modal>
  </div>
</template>

<style scoped>
.filter { width: 110px; }
.filter.search { width: 160px; }
.plan-head { padding: 6px 10px; border-bottom: 1px solid var(--line); }
.plan-row {
  padding: 10px; border-bottom: 1px dashed var(--line-soft);
  transition: background .2s, opacity .2s;
}
.plan-row:hover { background: rgba(91,140,133,.05); }
.plan-row.dragging { opacity: .4; background: var(--cyan-soft); }
.drag-ico { color: var(--ink-3); cursor: grab; }
.wd-btn {
  width: 30px; height: 30px; border-radius: 50%;
  border: 1px solid var(--line); background: #fff; color: var(--ink-2);
  font-size: 13px;
}
.wd-btn.on { background: var(--cyan); color: #fff; border-color: var(--cyan); }
@media (max-width: 640px) {
  .plan-head { display: none; }
  .plan-row { flex-wrap: wrap; gap: 8px; }
  .plan-row > span { width: auto !important; }
}
</style>
