<script setup>
import { ref, computed } from 'vue'
import { useDataStore } from '../stores/dataStore.js'
import { useUiStore } from '../stores/uiStore.js'
import Card from '../components/common/Card.vue'
import Modal from '../components/common/Modal.vue'
import EmptyState from '../components/common/EmptyState.vue'
import { renderMarkdown } from '../utils/markdown.js'
import { todayStr, weekRange, monthRange, quarterRange, yearRange, monthKey, monthLabel } from '../utils/date.js'
import { monthlyExpense, monthlyIncome, sumAmount, studyHours, planCompletion, bookStats, netWorth } from '../utils/calc.js'
import { fmtMoneyShort, confirmDelete } from '../utils/format.js'
import { REVIEW_TYPES, REVIEW_TYPE_LABEL } from '../utils/defaultData.js'

const store = useDataStore()
const ui = useUiStore()

const showModal = ref(false)
const editing = ref(null)
const form = ref({ title: '', type: 'day', content: '', tags: [] })
const filterType = ref('全部')
const view = ref('list') // list | timeline

const typeOrder = { day: 0, week: 1, month: 2, quarter: 3, year: 4 }
const filtered = computed(() => store.reviews
  .filter(r => filterType.value === '全部' || r.type === filterType.value)
  .sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1)))
const timeline = computed(() => [...store.reviews].sort((a, b) => (a.periodStart < b.periodStart ? -1 : 1)))

function openNew() {
  editing.value = null
  form.value = { title: '', type: 'day', content: '', tags: [] }
  showModal.value = true
}
function openEdit(r) {
  editing.value = r
  form.value = { title: r.title, type: r.type, content: r.content || '', tags: r.tags ? [...r.tags] : [] }
  showModal.value = true
}
function save() {
  if (!form.value.content && !form.value.title) { ui.toast('请填写内容', 'warning'); return }
  let start = todayStr(), end = todayStr()
  if (form.value.type === 'week') { const w = weekRange(); start = w.start; end = w.end }
  if (form.value.type === 'month') { const m = monthRange(); start = m.start; end = m.end }
  if (form.value.type === 'quarter') { const q = quarterRange(); start = q.start; end = q.end }
  if (form.value.type === 'year') { const y = yearRange(); start = y.start; end = y.end }
  const title = form.value.title || `${REVIEW_TYPE_LABEL[form.value.type]} · ${start}`
  const payload = { title, type: form.value.type, periodStart: start, periodEnd: end, content: form.value.content, tags: form.value.tags }
  if (editing.value) store.updateItem('reviews', editing.value.id, payload)
  else store.addItem('reviews', payload)
  showModal.value = false
  ui.toast('复盘已保存 🧘', 'success')
}
function remove(r) {
  if (!confirmDelete(r.title || r.type + '复盘')) return
  store.removeItem('reviews', r.id); ui.toast('已删除')
}

/** 自动生成基于真实数据的复盘报告 */
function autoFill() {
  const t = form.value.type
  let range
  if (t === 'week') range = weekRange()
  else if (t === 'month') range = monthRange()
  else if (t === 'quarter') range = quarterRange()
  else if (t === 'year') range = yearRange()
  else range = { start: todayStr(), end: todayStr() }

  const cs = store.consumptions.filter(c => c.date >= range.start && c.date <= range.end)
  const is = store.incomes.filter(i => i.date >= range.start && i.date <= range.end)
  const expense = sumAmount(cs)
  const income = sumAmount(is)
  const hours = studyHours(store.learnings.filter(l => l.date >= range.start && l.date <= range.end))
  const books = bookStats(store.books)
  const taskRate = planCompletion(store.plans.filter(p => p.status !== '未开始'))

  form.value.content = `## ${REVIEW_TYPE_LABEL[t]}（${range.start} ~ ${range.end}）

### 📊 本阶段数据
- 总支出：**¥${expense.toLocaleString()}**（${cs.length} 笔）
- 总收入：**¥${income.toLocaleString()}**（${is.length} 笔）
- 结余：¥${(income - expense).toLocaleString()}
- 学习时长：${Math.round(hours * 10) / 10} 小时
- 读书：已读 ${books.read} 本 / 在读 ${books.reading} 本
- 计划完成率：${taskRate.toFixed(0)}%

### ✅ 本阶段完成了什么
- （自动生成后请补充你的具体成果）

### 🎉 做得好的地方
-

### 💡 需要改进的地方
-

### 🚀 下一阶段最重要的一件事
-
`
  form.value.title = `${REVIEW_TYPE_LABEL[t]} · ${range.start}`
  ui.toast('已根据真实数据生成草稿，可继续编辑', 'success')
}
</script>

<template>
  <div>
    <div class="toolbar">
      <h1 class="page-title">🧘 复盘总结</h1>
      <div class="spacer"></div>
      <div class="row gap-8">
        <button class="btn btn-sm" :class="view === 'list' ? '' : 'btn-ghost'" @click="view = 'list'">列表</button>
        <button class="btn btn-sm" :class="view === 'timeline' ? '' : 'btn-ghost'" @click="view = 'timeline'">时间线</button>
      </div>
      <select v-model="filterType" class="mini"><option>全部</option><option v-for="t in REVIEW_TYPES" :key="t" :value="t">{{ REVIEW_TYPE_LABEL[t] }}</option></select>
      <button class="btn btn-bounce" @click="openNew">＋ 新建复盘</button>
    </div>

    <!-- 列表视图 -->
    <div v-if="view === 'list'" class="grid mb-16" style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))">
      <Card v-for="r in filtered" :key="r.id">
        <div class="row-between wrap gap-8 mb-8">
          <h3 class="card-title" style="margin-bottom:0">{{ r.title }}</h3>
          <span class="q-tag t-purple">{{ REVIEW_TYPE_LABEL[r.type] }}</span>
        </div>
        <div class="small muted mb-8">{{ r.periodStart }} ~ {{ r.periodEnd }}</div>
        <div class="rich-content preview" v-html="renderMarkdown(r.content)"></div>
        <div class="row gap-4 mt-8">
          <span v-for="t in (r.tags || [])" :key="t" class="q-tag t-blue small">{{ t }}</span>
        </div>
        <div class="row gap-8 mt-12">
          <button class="btn btn-sm btn-ghost" @click="openEdit(r)">编辑</button>
          <button class="btn btn-sm btn-ghost" @click="remove(r)">删除</button>
        </div>
      </Card>
    </div>

    <!-- 时间线视图 -->
    <div v-else-if="view === 'timeline'">
      <div v-if="timeline.length" class="tl">
        <div v-for="r in timeline" :key="r.id" class="tl-item">
          <div class="tl-dot" :class="'ty-' + r.type"></div>
          <Card class="tl-card">
            <div class="row-between wrap gap-8">
              <h3 class="card-title" style="margin-bottom:2px">{{ r.title }}</h3>
              <span class="q-tag t-purple">{{ REVIEW_TYPE_LABEL[r.type] }}</span>
            </div>
            <div class="small muted mb-8">{{ r.periodStart }} ~ {{ r.periodEnd }}</div>
            <div class="rich-content preview" v-html="renderMarkdown(r.content)"></div>
          </Card>
        </div>
      </div>
      <EmptyState v-else emoji="🧘" text="还没有复盘" sub="从每日复盘开始，养成反思的习惯" />
    </div>

    <EmptyState v-if="view === 'list' && !filtered.length" emoji="🧘" text="暂无该类型复盘" sub="点击「新建复盘」开始记录" />

    <Modal :title="editing ? '编辑复盘' : '新建复盘'" icon="🧘" lg @close="showModal = false" v-if="showModal">
      <div class="form-grid mb-12">
        <div class="form-field">
          <label>类型</label>
          <select v-model="form.type" @change="editing ? null : autoFill()">
            <option v-for="t in REVIEW_TYPES" :key="t" :value="t">{{ REVIEW_TYPE_LABEL[t] }}</option>
          </select>
        </div>
        <div class="form-field">
          <label>标题</label>
          <input v-model="form.title" placeholder="复盘标题" />
        </div>
        <div class="form-field full">
          <label>正文（支持 Markdown：标题 / 列表 / 表格 / 引用）</label>
          <div class="row gap-8 mb-8">
            <button class="btn btn-sm btn-gold" @click="autoFill">✨ 根据数据自动生成草稿</button>
          </div>
          <textarea v-model="form.content" rows="10" placeholder="## 今天完成了什么&#10;..." />
        </div>
      </div>
      <div class="row gap-16">
        <div class="form-field" style="flex:1">
          <label>实时预览</label>
          <div class="preview-pane rich-content" v-html="renderMarkdown(form.content)"></div>
        </div>
      </div>
      <button class="btn btn-block mt-16" @click="save">保存复盘</button>
    </Modal>
  </div>
</template>

<style scoped>
.mini { width: 120px; }
.preview { max-height: 160px; overflow: hidden; position: relative; }
.preview::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 30px; background: linear-gradient(transparent, #fffdf7); }
.preview-pane { border: 1px dashed var(--line); border-radius: 10px; padding: 10px 14px; min-height: 120px; max-height: 260px; overflow-y: auto; }
.tl { position: relative; padding-left: 26px; }
.tl::before { content: ""; position: absolute; left: 8px; top: 6px; bottom: 6px; width: 2px; background: linear-gradient(var(--cyan-soft), var(--pink-soft)); }
.tl-item { position: relative; margin-bottom: 18px; }
.tl-dot { position: absolute; left: -22px; top: 18px; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 2px var(--cyan); }
.tl-dot.ty-week { box-shadow: 0 0 0 2px var(--gold); }
.tl-dot.ty-month { box-shadow: 0 0 0 2px var(--pink); }
.tl-dot.ty-quarter { box-shadow: 0 0 0 2px var(--purple); }
.tl-dot.ty-year { box-shadow: 0 0 0 2px var(--red); }
</style>
