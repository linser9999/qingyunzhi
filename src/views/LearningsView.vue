<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/dataStore.js'
import { useUiStore } from '../stores/uiStore.js'
import Card from '../components/common/Card.vue'
import Modal from '../components/common/Modal.vue'
import EmptyState from '../components/common/EmptyState.vue'
import { todayStr } from '../utils/date.js'
import { studyHours } from '../utils/calc.js'
import { fmtDuration } from '../utils/format.js'
import { exportCSV } from '../utils/export.js'

const store = useDataStore()
const ui = useUiStore()

const showModal = ref(false)
const editing = ref(null)
const form = ref({})
const keyword = ref('')
const filterTag = ref('全部')

const allTags = computed(() => [...new Set(store.learnings.flatMap(l => l.tags || []))])
const filtered = computed(() => store.learnings
  .filter(l => filterTag.value === '全部' || (l.tags || []).includes(filterTag.value))
  .filter(l => !keyword.value || l.subject.includes(keyword.value) || (l.note || '').includes(keyword.value))
  .sort((a, b) => (a.date < b.date ? 1 : -1)))

const hours = computed(() => studyHours(store.learnings))
const bySubject = computed(() => {
  const m = {}
  for (const l of store.learnings) m[l.subject] = (m[l.subject] || 0) + Number(l.minutes || 0)
  return Object.entries(m).sort((a, b) => b[1] - a[1])
})

function openNew() {
  editing.value = null
  form.value = { date: todayStr(), subject: '', minutes: '', note: '', link: '', tags: [] }
  showModal.value = true
}
function openEdit(l) {
  editing.value = l
  form.value = { date: l.date, subject: l.subject, minutes: l.minutes, note: l.note || '', link: l.link || '', tags: l.tags ? [...l.tags] : [] }
  showModal.value = true
}
function save() {
  if (!form.value.subject) { ui.toast('请填写学习内容', 'warning'); return }
  const payload = {
    date: form.value.date, subject: form.value.subject, minutes: Number(form.value.minutes) || 0,
    note: form.value.note, link: form.value.link, tags: form.value.tags
  }
  if (editing.value) store.updateItem('learnings', editing.value.id, payload)
  else store.addItem('learnings', payload)
  showModal.value = false
  ui.toast('学习记录已保存 🎓', 'success')
}
function remove(l) { store.removeItem('learnings', l.id); ui.toast('已删除') }

function exportAll() {
  exportCSV('学习记录.csv', filtered.value.map(l => ({
    日期: l.date, 内容: l.subject, 时长分钟: l.minutes, 笔记: l.note, 链接: l.link, 标签: (l.tags || []).join('、')
  })))
  ui.toast('已导出 CSV', 'success')
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h1 class="page-title">🎓 学习记录</h1>
      <div class="spacer"></div>
      <button class="btn btn-sm btn-ghost" @click="exportAll">导出 CSV</button>
      <button class="btn btn-bounce" @click="openNew">＋ 记录学习</button>
    </div>

    <div class="grid mb-16" style="grid-template-columns: 1fr 1.2fr;">
      <Card title="学习总览" icon="⏳">
        <div class="big-hours">{{ fmtDuration(hours * 60) }}</div>
        <div class="small muted mb-12">累计 {{ store.learnings.length }} 条学习记录</div>
        <div v-if="bySubject.length" class="subject-list">
          <div v-for="(s, i) in bySubject.slice(0, 6)" :key="s[0]" class="subject-row row-between">
            <span class="small">{{ s[0] }}</span>
            <span class="row gap-8" style="flex:1;margin:0 8px">
              <span class="mini-bar"><span :style="{ width: Math.min(100, (s[1] / bySubject[0][1]) * 100) + '%' }" /></span>
            </span>
            <span class="small muted">{{ fmtDuration(s[1]) }}</span>
          </div>
        </div>
      </Card>
      <Card title="记录列表" icon="🗂️">
        <div class="toolbar" style="margin-bottom:8px">
          <input v-model="keyword" placeholder="搜索内容…" class="search" />
          <select v-model="filterTag" class="mini"><option>全部</option><option v-for="t in allTags" :key="t">{{ t }}</option></select>
        </div>
        <div v-if="filtered.length" class="learn-list">
          <div v-for="l in filtered" :key="l.id" class="learn row-between">
            <div style="min-width:0">
              <div class="bold small">{{ l.subject }} <span class="q-tag t-cyan small">{{ fmtDuration(l.minutes) }}</span></div>
              <div class="small muted">{{ l.date }}<span v-if="l.note"> · {{ l.note }}</span></div>
              <div v-if="l.tags?.length" class="row gap-4 mt-4">
                <span v-for="t in l.tags" :key="t" class="q-tag t-blue small">{{ t }}</span>
              </div>
            </div>
            <div class="row gap-4">
              <a v-if="l.link" :href="l.link" target="_blank" rel="noopener" class="btn btn-sm btn-ghost">链接</a>
              <button class="btn btn-sm btn-ghost" @click="openEdit(l)">改</button>
              <button class="btn btn-sm btn-ghost" @click="remove(l)">删</button>
            </div>
          </div>
        </div>
        <EmptyState v-else emoji="🎓" text="暂无学习记录" />
      </Card>
    </div>

    <Modal :title="editing ? '编辑学习记录' : '记录学习'" icon="🎓" @close="showModal = false" v-if="showModal">
      <div class="form-grid">
        <div class="form-field"><label>日期</label><input type="date" v-model="form.date" /></div>
        <div class="form-field"><label>学习时长（分钟）</label><input type="number" v-model="form.minutes" placeholder="60" /></div>
        <div class="form-field full"><label>学习内容 <span class="req">*</span></label><input v-model="form.subject" placeholder="如：Java 并发编程" /></div>
        <div class="form-field full"><label>笔记 / 收获</label><textarea v-model="form.note" rows="3" placeholder="学到了什么？" /></div>
        <div class="form-field full"><label>笔记链接</label><input v-model="form.link" placeholder="https://…" /></div>
        <div class="form-field full"><label>标签（逗号分隔）</label><input :value="form.tags.join('，')" @input="form.tags = $event.target.value.split(/[，,]/).map(s => s.trim()).filter(Boolean)" placeholder="技术, 理财" /></div>
      </div>
      <button class="btn btn-block mt-16" @click="save">保存</button>
    </Modal>
  </div>
</template>

<style scoped>
.big-hours { font-size: 34px; font-weight: 800; color: var(--cyan-deep); font-variant-numeric: tabular-nums; }
.subject-row { padding: 5px 0; }
.mini-bar { flex: 1; height: 6px; background: #f0e8d8; border-radius: 99px; overflow: hidden; display: block; }
.mini-bar span { display: block; height: 100%; background: linear-gradient(90deg, #7b95b5, #a8c2e0); border-radius: 99px; }
.learn-list { display: flex; flex-direction: column; }
.learn { padding: 8px 4px; border-bottom: 1px dashed var(--line-soft); }
.search { width: 150px; }
.mini { width: 100px; }
</style>
