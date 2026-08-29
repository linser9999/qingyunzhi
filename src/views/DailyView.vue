<script setup>
import { ref, computed, watch } from 'vue'
import { useDataStore } from '../stores/dataStore.js'
import { useUiStore } from '../stores/uiStore.js'
import Card from '../components/common/Card.vue'
import EmptyState from '../components/common/EmptyState.vue'
import { todayStr, weekdayCn, cnDate } from '../utils/date.js'
import { fmtDuration } from '../utils/format.js'

const store = useDataStore()
const ui = useUiStore()

const date = ref(todayStr())
const moodOptions = [1, 2, 3, 4, 5]
const moodLabel = { 1: '😞 低落', 2: '🙁 一般', 3: '😐 平静', 4: '🙂 不错', 5: '😄 元气满满' }
const presets = ['今日已定投', '今日已刷题', '今日已运动', '今日已阅读 30 分钟', '今日无冲动消费']

const form = ref({})
const saved = ref(false)

function getRecord(d) { return store.dailyRecords.find(r => r.date === d) }

function initForm(d) {
  const rec = getRecord(d)
  if (rec) {
    form.value = {
      tasksDone: (rec.tasksDone || []).join('\n'),
      studyMinutes: rec.studyMinutes || 0,
      booksRead: (rec.booksRead || []).join('，'),
      exercise: rec.exercise || '',
      mood: rec.mood || 3,
      summary: rec.summary || '',
      reflection: rec.reflection || '',
      tags: rec.tags ? [...rec.tags] : [],
      checkins: rec.checkins ? rec.checkins.map(c => ({ ...c })) : []
    }
  } else {
    form.value = { tasksDone: '', studyMinutes: '', booksRead: '', exercise: '', mood: 3, summary: '', reflection: '', tags: [], checkins: presets.map(p => ({ label: p, done: false })) }
  }
}

watch(date, (d) => { initForm(d); saved.value = false })

const record = computed(() => getRecord(date.value))
const isToday = computed(() => date.value === todayStr())
const isDone = computed(() => !!record.value && record.value.checkins && record.value.checkins.length)

function save() {
  const payload = {
    date: date.value,
    tasksDone: form.value.tasksDone.split('\n').map(s => s.trim()).filter(Boolean),
    studyMinutes: Number(form.value.studyMinutes) || 0,
    booksRead: form.value.booksRead.split(/[，,、]/).map(s => s.trim()).filter(Boolean),
    exercise: form.value.exercise,
    mood: Number(form.value.mood),
    summary: form.value.summary,
    reflection: form.value.reflection,
    tags: form.value.tags,
    checkins: form.value.checkins
  }
  if (record.value) store.updateItem('dailyRecords', record.value.id, payload)
  else store.addItem('dailyRecords', payload)
  ui.toast('今日记录已保存 ✨', 'success')
}

function toggleCheckin(c) { c.done = !c.done }

const recentRecords = computed(() => [...store.dailyRecords].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 14))
</script>

<template>
  <div>
    <div class="toolbar">
      <h1 class="page-title">✍️ 每日记录与打卡</h1>
      <div class="spacer"></div>
      <input type="date" v-model="date" class="filter" />
    </div>

    <div class="grid" style="grid-template-columns: 1.15fr 1fr;">
      <Card :title="'记录 ' + cnDate(date) + ' · ' + weekdayCn(date)" icon="🖌️">
        <div class="form-field mb-12">
          <label>完成了哪些任务（每行一项）</label>
          <textarea v-model="form.tasksDone" rows="4" placeholder="☑ 完成 LeetCode 2 题&#10;☑ 读完一章书" />
        </div>
        <div class="grid grid-3 mb-12">
          <div class="form-field">
            <label>学习时长（分钟）</label>
            <input type="number" v-model="form.studyMinutes" placeholder="120" />
          </div>
          <div class="form-field">
            <label>运动</label>
            <input v-model="form.exercise" placeholder="跑步 3 公里" />
          </div>
          <div class="form-field">
            <label>读了什么书</label>
            <input v-model="form.booksRead" placeholder="书名，逗号分隔" />
          </div>
        </div>
        <div class="form-field mb-12">
          <label>心情</label>
          <div class="row gap-8 wrap">
            <button
              v-for="m in moodOptions" :key="m"
              class="mood-btn" :class="{ on: form.mood === m }" @click="form.mood = m"
            >{{ moodLabel[m] }}</button>
          </div>
        </div>
        <div class="form-field mb-12">
          <label>今日反思（哪里做得好 / 哪里要改进）</label>
          <textarea v-model="form.reflection" rows="2" placeholder="写给自己的一句话" />
        </div>
        <div class="form-field mb-12">
          <label>今日小结</label>
          <textarea v-model="form.summary" rows="2" placeholder="今天最重要的事" />
        </div>

        <div class="form-field mb-16">
          <label>打卡</label>
          <div class="row gap-8 wrap">
            <button
              v-for="c in form.checkins" :key="c.label"
              class="checkin-btn" :class="{ done: c.done }" @click="toggleCheckin(c)"
            >{{ c.done ? '✔' : '○' }} {{ c.label }}</button>
          </div>
        </div>

        <button class="btn btn-block btn-bounce" @click="save">{{ record ? '更新记录' : '保存今日记录' }}</button>
      </Card>

      <!-- 历史记录 -->
      <Card title="记录史册" icon="📖">
        <div v-if="recentRecords.length" class="rec-list">
          <div v-for="r in recentRecords" :key="r.id" class="rec-item" :class="{ today: r.date === todayStr() }">
            <div class="row-between">
              <span class="bold small">{{ r.date }} · {{ weekdayCn(r.date) }}</span>
              <span class="small">{{ moodLabel[r.mood] }}</span>
            </div>
            <div class="small muted mt-4">
              <span v-if="r.tasksDone?.length">☑ {{ r.tasksDone.length }} 项</span>
              <span v-if="r.studyMinutes"> · 🎓 {{ fmtDuration(r.studyMinutes) }}</span>
              <span v-if="r.exercise"> · 🏃 {{ r.exercise }}</span>
            </div>
            <div v-if="r.checkins?.some(c => c.done)" class="row gap-4 wrap mt-4">
              <span v-for="c in r.checkins.filter(c => c.done)" :key="c.label" class="q-tag t-green small">{{ c.label }}</span>
            </div>
          </div>
        </div>
        <EmptyState v-else emoji="📖" text="还没有任何记录" sub="从今天开始，写下一笔吧" />
      </Card>
    </div>
  </div>
</template>

<style scoped>
.filter { width: 160px; }
.mood-btn { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line); background: #fff; color: var(--ink-2); font-size: 13px; }
.mood-btn.on { background: var(--pink); border-color: var(--pink); color: #fff; }
.checkin-btn { padding: 7px 12px; border-radius: 999px; border: 1px solid var(--line); background: #fff; color: var(--ink-2); font-size: 13px; transition: all .2s; }
.checkin-btn.done { background: var(--green-soft); border-color: var(--green); color: var(--green); }
.rec-list { display: flex; flex-direction: column; gap: 8px; }
.rec-item { background: #fdfaf2; border: 1px solid var(--line-soft); border-radius: 12px; padding: 10px 12px; }
.rec-item.today { border-color: var(--pink); background: #fdf5f2; }
</style>
