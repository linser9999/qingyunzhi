<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/dataStore.js'
import { useUiStore } from '../stores/uiStore.js'
import Card from '../components/common/Card.vue'
import Modal from '../components/common/Modal.vue'
import EmptyState from '../components/common/EmptyState.vue'
import { todayStr } from '../utils/date.js'
import { bookStats } from '../utils/calc.js'
import { confirmDelete } from '../utils/format.js'
import { BOOK_STATUS } from '../utils/defaultData.js'

const store = useDataStore()
const ui = useUiStore()

const showModal = ref(false)
const editing = ref(null)
const form = ref({})
const keyword = ref('')
const filterStatus = ref('全部')
const filterTag = ref('全部')

const statusColor = { 在读: 'gold', 已读: 'green', 放弃: 'red' }
const allTags = computed(() => [...new Set(store.books.flatMap(b => b.tags || []))])

const filtered = computed(() => store.books
  .filter(b => filterStatus.value === '全部' || b.status === filterStatus.value)
  .filter(b => filterTag.value === '全部' || (b.tags || []).includes(filterTag.value))
  .filter(b => !keyword.value || b.title.includes(keyword.value) || (b.author || '').includes(keyword.value))
  .sort((a, b) => (a.status === 'read' ? 1 : 0) - (b.status === 'read' ? 1 : 0)))

const stats = computed(() => bookStats(store.books))

function openNew() {
  editing.value = null
  form.value = { title: '', author: '', startDate: todayStr(), finishDate: '', notes: '', rating: 0, status: '在读', tags: [] }
  showModal.value = true
}
function openEdit(b) {
  editing.value = b
  form.value = { title: b.title, author: b.author || '', startDate: b.startDate || '', finishDate: b.finishDate || '',
    notes: b.notes || '', rating: b.rating || 0, status: b.status || '在读', tags: b.tags ? [...b.tags] : [] }
  showModal.value = true
}
function save() {
  if (!form.value.title) { ui.toast('请填写书名', 'warning'); return }
  const payload = {
    title: form.value.title, author: form.value.author, startDate: form.value.startDate,
    finishDate: form.value.status === '已读' && !form.value.finishDate ? todayStr() : form.value.finishDate,
    notes: form.value.notes, rating: Number(form.value.rating) || 0,
    status: form.value.status, tags: form.value.tags
  }
  if (editing.value) store.updateItem('books', editing.value.id, payload)
  else store.addItem('books', payload)
  showModal.value = false
  ui.toast('书目已保存 📚', 'success')
}
function remove(b) {
  if (!confirmDelete(b.title || b.name || '这本书')) return
  store.removeItem('books', b.id); ui.toast('已删除')
}
function cycleStatus(b) {
  const map = { 在读: '已读', 已读: '在读', 放弃: '在读' }
  store.updateItem('books', b.id, { status: map[b.status], finishDate: map[b.status] === '已读' ? todayStr() : b.finishDate })
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h1 class="page-title">📚 读书清单</h1>
      <div class="spacer"></div>
      <button class="btn btn-bounce" @click="openNew">＋ 添加书目</button>
    </div>

    <div class="grid grid-3 mb-16">
      <div class="stat-card"><div class="s-label">在读</div><div class="s-value" style="color:#d9a94e">{{ stats.reading }}</div><div class="s-sub">正在啃</div></div>
      <div class="stat-card"><div class="s-label">已读</div><div class="s-value" style="color:#6f9a5c">{{ stats.read }}</div><div class="s-sub">读过的书</div></div>
      <div class="stat-card"><div class="s-label">全部</div><div class="s-value" style="color:#5b8c85">{{ stats.total }}</div><div class="s-sub">书架上</div></div>
    </div>

    <div class="toolbar">
      <input v-model="keyword" placeholder="搜索书名 / 作者…" class="search" />
      <select v-model="filterStatus" class="mini"><option>全部</option><option v-for="s in BOOK_STATUS" :key="s">{{ s }}</option></select>
      <select v-model="filterTag" class="mini"><option>全部</option><option v-for="t in allTags" :key="t">{{ t }}</option></select>
    </div>

    <div v-if="filtered.length" class="grid" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))">
      <Card v-for="b in filtered" :key="b.id">
        <div class="row-between wrap gap-8">
          <h3 class="card-title" style="margin-bottom:4px">{{ b.title }}</h3>
          <span class="q-tag clickable" :class="'t-' + statusColor[b.status]" @click="cycleStatus(b)">{{ b.status }}</span>
        </div>
        <div class="small muted mb-8">{{ b.author || '佚名' }}<span v-if="b.startDate"> · 始于 {{ b.startDate }}</span><span v-if="b.finishDate"> · 完成于 {{ b.finishDate }}</span></div>
        <div class="row gap-4 mb-8">
          <span v-for="i in 5" :key="i" :style="{ color: i <= b.rating ? '#d9a94e' : '#e8dfce' }">★</span>
          <span v-if="!b.rating" class="small muted">未评分</span>
        </div>
        <p v-if="b.notes" class="small muted note">{{ b.notes }}</p>
        <div class="row gap-8 wrap mt-8">
          <span v-for="t in (b.tags || [])" :key="t" class="q-tag t-blue">{{ t }}</span>
        </div>
        <div class="row gap-8 mt-12">
          <button class="btn btn-sm btn-ghost" @click="openEdit(b)">编辑 / 笔记</button>
          <button class="btn btn-sm btn-ghost" @click="remove(b)">删除</button>
        </div>
      </Card>
    </div>
    <EmptyState v-else emoji="📚" text="暂无书目" sub="记录读过的每一本书，让知识沉淀下来" />

    <Modal :title="editing ? '编辑书目' : '添加书目'" icon="📚" @close="showModal = false" v-if="showModal">
      <div class="form-grid">
        <div class="form-field full"><label>书名 <span class="req">*</span></label><input v-model="form.title" /></div>
        <div class="form-field"><label>作者</label><input v-model="form.author" /></div>
        <div class="form-field"><label>状态</label><select v-model="form.status"><option v-for="s in BOOK_STATUS" :key="s" :value="s">{{ s }}</option></select></div>
        <div class="form-field"><label>开始日期</label><input type="date" v-model="form.startDate" /></div>
        <div class="form-field"><label>完成日期</label><input type="date" v-model="form.finishDate" /></div>
        <div class="form-field"><label>评分（1-5）</label><input type="number" v-model="form.rating" min="0" max="5" /></div>
        <div class="form-field full"><label>标签（逗号分隔）</label><input :value="form.tags.join('，')" @input="form.tags = $event.target.value.split(/[，,]/).map(s => s.trim()).filter(Boolean)" placeholder="理财, 技术" /></div>
        <div class="form-field full"><label>读书笔记</label><textarea v-model="form.notes" rows="4" placeholder="你的思考、摘录、感受…" /></div>
      </div>
      <button class="btn btn-block mt-16" @click="save">保存</button>
    </Modal>
  </div>
</template>

<style scoped>
.search { width: 200px; }
.mini { width: 110px; }
.note {
  background: #fbf6ec; border-radius: 8px; padding: 8px 10px;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
</style>
