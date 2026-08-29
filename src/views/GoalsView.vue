<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/dataStore.js'
import { useUiStore } from '../stores/uiStore.js'
import Modal from '../components/common/Modal.vue'
import EmptyState from '../components/common/EmptyState.vue'
import GoalCard from '../components/common/GoalCard.vue'
import { todayStr } from '../utils/date.js'
import { uid } from '../utils/format.js'
import { GOAL_TYPES } from '../utils/defaultData.js'

const store = useDataStore()
const ui = useUiStore()

const showModal = ref(false)
const editing = ref(null) // null 表示新建
const form = ref({})

const goals = computed(() => store.goals)
const topGoals = computed(() => goals.value.filter(g => !g.parentId))
const childMap = computed(() => {
  const m = {}
  for (const g of goals.value) {
    if (g.parentId) (m[g.parentId] = m[g.parentId] || []).push(g)
  }
  return m
})
const goalWithChildren = computed(() =>
  topGoals.value.map(g => ({ ...g, children: childMap.value[g.id] || [] }))
)

function openNew() {
  editing.value = null
  form.value = {
    name: '', description: '', type: '年度', startDate: todayStr(),
    endDate: '', targetValue: '', currentValue: 0, unit: '元',
    progressMode: 'auto', status: 'active', parentId: '', tags: [], milestones: []
  }
  showModal.value = true
}
function openEdit(g) {
  editing.value = g
  form.value = {
    name: g.name, description: g.description || '', type: g.type || '长期',
    startDate: g.startDate, endDate: g.endDate, targetValue: g.targetValue,
    currentValue: g.currentValue ?? 0, unit: g.unit || '元',
    progressMode: g.progressMode || 'auto', status: g.status || 'active',
    parentId: g.parentId || '', tags: g.tags ? [...g.tags] : [],
    milestones: g.milestones ? g.milestones.map(m => ({ ...m })) : []
  }
  showModal.value = true
}
function save() {
  if (!form.value.name) { ui.toast('请填写目标名称', 'warning'); return }
  const payload = {
    name: form.value.name, description: form.value.description, type: form.value.type,
    startDate: form.value.startDate, endDate: form.value.endDate || form.value.startDate,
    targetValue: Number(form.value.targetValue) || 0, currentValue: Number(form.value.currentValue) || 0,
    unit: form.value.unit, progressMode: form.value.progressMode, status: form.value.status,
    parentId: form.value.parentId, tags: form.value.tags,
    milestones: form.value.milestones.filter(m => m.name)
  }
  if (editing.value) store.updateItem('goals', editing.value.id, payload)
  else store.addItem('goals', payload)
  showModal.value = false
  ui.toast('目标已保存', 'success')
}
function remove(g) {
  store.removeItem('goals', g.id)
  // 顺带删除其子目标
  for (const c of store.goals.filter(x => x.parentId === g.id)) store.removeItem('goals', c.id)
  ui.toast('目标已删除')
}
function toggleStatus(g) {
  store.updateItem('goals', g.id, { status: g.status === 'active' ? 'paused' : 'active' })
}
function toggleMilestone(goal, m) {
  const ms = goal.milestones.map(x => x.id === m.id ? { ...x, achieved: !x.achieved } : x)
  store.updateItem('goals', goal.id, { milestones: ms })
}
function addMilestone() {
  form.value.milestones.push({ id: uid('gm'), name: '', date: '', targetValue: '', achieved: false })
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h1 class="page-title">🎯 目标管理</h1>
      <div class="spacer"></div>
      <button class="btn btn-pink btn-bounce" @click="openNew">＋ 新建目标</button>
    </div>
    <p class="page-sub">长期目标可拆解为年度 / 季度 / 月度 / 周度 / 每日目标，逐级达成，步步生花。</p>

    <div v-if="goals.length" class="grid mb-16" style="grid-template-columns: repeat(auto-fill, minmax(340px, 1fr))">
      <GoalCard
        v-for="g in goalWithChildren" :key="g.id"
        :goal="g"
        @edit="openEdit" @toggle="toggleStatus" @remove="remove"
        @toggle-ms="toggleMilestone"
      />
    </div>
    <EmptyState v-else emoji="🎯" text="还没有目标" sub="点击右上角「新建目标」，例如：六年净资产 100 万" />

    <Modal :title="editing ? '编辑目标' : '新建目标'" icon="🎯" @close="showModal = false" v-if="showModal">
      <div class="form-grid">
        <div class="form-field full">
          <label>目标名称 <span class="req">*</span></label>
          <input v-model="form.name" placeholder="如：六年净资产 100 万" />
        </div>
        <div class="form-field full">
          <label>目标描述</label>
          <textarea v-model="form.description" placeholder="写清楚为什么、怎么做" />
        </div>
        <div class="form-field">
          <label>类型</label>
          <select v-model="form.type">
            <option v-for="t in GOAL_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="form-field">
          <label>状态</label>
          <select v-model="form.status">
            <option value="active">进行中</option>
            <option value="paused">已暂停</option>
            <option value="achieved">已达成</option>
            <option value="abandoned">已放弃</option>
          </select>
        </div>
        <div class="form-field">
          <label>开始日期</label>
          <input type="date" v-model="form.startDate" />
        </div>
        <div class="form-field">
          <label>截止日期</label>
          <input type="date" v-model="form.endDate" />
        </div>
        <div class="form-field">
          <label>目标金额 / 数值</label>
          <input type="number" v-model="form.targetValue" placeholder="如 1000000" />
        </div>
        <div class="form-field">
          <label>当前进度</label>
          <input type="number" v-model="form.currentValue" placeholder="当前值" />
        </div>
        <div class="form-field full">
          <label>关联父目标（可选，用于拆解）</label>
          <select v-model="form.parentId">
            <option value="">无（顶级目标）</option>
            <option v-for="g in goals.filter(x => !x.parentId && x.id !== (editing && editing.id))" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
        </div>
        <div class="form-field full">
          <label>里程碑</label>
          <div v-for="(m, i) in form.milestones" :key="m.id" class="row gap-8 mb-8">
            <input v-model="m.name" placeholder="里程碑名称" style="flex:2" />
            <input v-model="m.targetValue" placeholder="数值" type="number" style="flex:1" />
            <input v-model="m.date" type="date" style="flex:1.2" />
            <button class="btn btn-sm btn-ghost" @click="form.milestones.splice(i, 1)">✕</button>
          </div>
          <button class="btn btn-sm btn-ghost" @click="addMilestone">＋ 添加里程碑</button>
        </div>
      </div>
      <div class="row gap-12 mt-16">
        <button class="btn btn-block" @click="save">保存目标</button>
      </div>
    </Modal>
  </div>
</template>
