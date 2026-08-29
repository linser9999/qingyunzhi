<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/dataStore.js'
import { useUiStore } from '../stores/uiStore.js'
import Card from '../components/common/Card.vue'
import Modal from '../components/common/Modal.vue'
import EmptyState from '../components/common/EmptyState.vue'
import { todayStr, cnDate } from '../utils/date.js'
import { ageAt } from '../utils/date.js'
import { MILESTONE_PHASES } from '../utils/defaultData.js'

const store = useDataStore()
const ui = useUiStore()

const showModal = ref(false)
const editing = ref(null)
const form = ref({})
const dragId = ref(null)

const milestones = computed(() => [...store.milestones].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)))
const birthday = computed(() => store.user.birthday)

const progressPct = computed(() => {
  if (!milestones.value.length) return 0
  const done = milestones.value.filter(m => m.achieved).length
  return Math.round((done / milestones.value.length) * 100)
})

function openNew() {
  editing.value = null
  form.value = { name: MILESTONE_PHASES[milestones.value.length] || '新阶段', startDate: todayStr(), endDate: '', goalStatus: '', keyActions: [], achieved: false }
  showModal.value = true
}
function openEdit(m) {
  editing.value = m
  form.value = { name: m.name, startDate: m.startDate, endDate: m.endDate || '', goalStatus: m.goalStatus || '',
    keyActions: m.keyActions ? [...m.keyActions] : [], achieved: m.achieved }
  showModal.value = true
}
function save() {
  if (!form.value.name) { ui.toast('请填写阶段名称', 'warning'); return }
  const payload = {
    name: form.value.name, startDate: form.value.startDate, endDate: form.value.endDate || form.value.startDate,
    goalStatus: form.value.goalStatus, keyActions: form.value.keyActions.filter(Boolean),
    achieved: form.value.achieved, achievedDate: form.value.achieved && !editing.value?.achieved ? todayStr() : undefined
  }
  if (editing.value) store.updateItem('milestones', editing.value.id, payload)
  else store.addItem('milestones', { ...payload, sortOrder: store.milestones.length })
  showModal.value = false
  ui.toast('路线图已更新 🗺️', 'success')
}
function remove(m) { store.removeItem('milestones', m.id); ui.toast('已删除') }
function toggleAchieved(m) {
  const next = !m.achieved
  store.updateItem('milestones', m.id, { achieved: next, achievedDate: next ? todayStr() : '' })
  if (next) ui.toast(`达成「${m.name}」🎉`, 'success')
}

/* 拖拽排序 */
function onDragStart(m) { dragId.value = m.id }
function onDrop(target) {
  if (!dragId.value || dragId.value === target.id) return
  const list = [...store.milestones]
  const from = list.findIndex(x => x.id === dragId.value)
  const to = list.findIndex(x => x.id === target.id)
  const [moved] = list.splice(from, 1)
  list.splice(to, 0, moved)
  list.forEach((x, i) => { x.sortOrder = i })
  store.replaceAll('milestones', list)
  ui.toast('已调整阶段顺序', 'success')
  dragId.value = null
}

function actionText(m) { return (m.keyActions || []).join(' / ') }
</script>

<template>
  <div>
    <div class="toolbar">
      <h1 class="page-title">🗺️ 路线图与里程碑</h1>
      <div class="spacer"></div>
      <button class="btn btn-bounce" @click="openNew">＋ 添加阶段</button>
    </div>
    <p class="page-sub">从当前到 {{ store.user.targetAge || 40 }} 岁的人生阶段规划，可拖拽调整顺序。</p>

    <Card title="整体进度" icon="🧭" class="mb-16">
      <div class="row-between small muted mb-4">
        <span>已达成 {{ milestones.filter(m => m.achieved).length }} / {{ milestones.length }} 个阶段</span>
        <span>{{ progressPct }}%</span>
      </div>
      <div class="q-progress p-gold" style="height:12px"><div class="bar bar-shine" :style="{ width: progressPct + '%' }" /></div>
    </Card>

    <div v-if="milestones.length" class="tl">
      <div
        v-for="(m, i) in milestones" :key="m.id"
        class="tl-item" :class="{ done: m.achieved, dragging: dragId === m.id }"
        draggable="true" @dragstart="onDragStart(m)" @dragover.prevent @drop="onDrop(m)"
      >
        <div class="tl-line">
          <span class="tl-node" :class="{ done: m.achieved }">{{ m.achieved ? '✔' : i + 1 }}</span>
        </div>
        <Card class="tl-card">
          <div class="row-between wrap gap-8">
            <h3 class="card-title" style="margin-bottom:2px">
              <span class="drag-handle">⠿</span>{{ m.name }}
              <span v-if="m.achieved" class="q-tag t-green">已达成{{ m.achievedDate ? ' · ' + m.achievedDate : '' }}</span>
            </h3>
            <div class="row gap-8">
              <button class="btn btn-sm btn-ghost" @click="openEdit(m)">编辑</button>
              <button class="btn btn-sm" :class="m.achieved ? 'btn-ghost' : 'btn-pink'" @click="toggleAchieved(m)">{{ m.achieved ? '撤销达成' : '标记达成' }}</button>
              <button class="btn btn-sm btn-ghost" @click="remove(m)">删除</button>
            </div>
          </div>
          <div class="small muted mb-8">
            🗓 {{ cnDate(m.startDate) }} ~ {{ cnDate(m.endDate) }}
            <span v-if="m.goalStatus"> · 🎯 {{ m.goalStatus }}</span>
            <span v-if="birthday"> · {{ ageAt(birthday, m.startDate) }}~{{ ageAt(birthday, m.endDate) }} 岁</span>
          </div>
          <div v-if="m.keyActions?.length" class="row gap-4 wrap">
            <span v-for="(a, ai) in m.keyActions" :key="ai" class="q-tag t-cyan">🔸 {{ a }}</span>
          </div>
        </Card>
      </div>
    </div>
    <EmptyState v-else emoji="🗺️" text="还没有规划路线" sub="添加「秋招 → 毕业入职 → 跳槽涨薪 → 副业起步 → 资产积累 → 财富自由」的阶段" />

    <Modal v-if="showModal" :title="editing ? '编辑阶段' : '添加阶段'" icon="🗺️" @close="showModal = false">
      <div class="form-grid">
        <div class="form-field full"><label>阶段名称 *</label><input v-model="form.name" placeholder="如：秋招冲刺" /></div>
        <div class="form-field"><label>开始日期</label><input type="date" v-model="form.startDate" /></div>
        <div class="form-field"><label>结束日期</label><input type="date" v-model="form.endDate" /></div>
        <div class="form-field full"><label>目标状态</label><input v-model="form.goalStatus" placeholder="如：拿到 offer 并入职 / 薪资提升 30%" /></div>
        <div class="form-field full"><label>关键行动（每行一项）</label><textarea :value="form.keyActions.join('\n')" @input="form.keyActions = $event.target.value.split('\n').map(s => s.trim()).filter(Boolean)" rows="4" placeholder="完善简历&#10;刷题 100 道&#10;复习八股"></textarea></div>
        <div class="form-field full"><label class="checkbox-label"><input type="checkbox" v-model="form.achieved" /> 标记为已达成</label></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" @click="showModal = false">取消</button>
        <button class="btn btn-primary" @click="save">{{ editing ? '保存修改' : '添加阶段' }}</button>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.tl { position: relative; padding-left: 34px; }
.tl::before { content: ""; position: absolute; left: 12px; top: 8px; bottom: 8px; width: 3px; background: linear-gradient(180deg, var(--cyan), var(--gold), var(--pink)); border-radius: 3px; }
.tl-item { position: relative; margin-bottom: 20px; transition: opacity .2s; }
.tl-item.dragging { opacity: .4; }
.tl-node {
  position: absolute; left: -34px; top: 16px; width: 28px; height: 28px;
  border-radius: 50%; background: #fff; border: 2px solid var(--cyan);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; color: var(--cyan-deep); z-index: 2;
}
.tl-node.done { background: var(--green); border-color: var(--green); color: #fff; }
.drag-handle { color: var(--ink-3); cursor: grab; margin-right: 4px; }
</style>
