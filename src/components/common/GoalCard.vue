<script setup>
import { computed } from 'vue'
import ProgressBar from '../common/ProgressBar.vue'
import { cnDate } from '../../utils/date.js'
import { goalProgress, goalTimeRatio } from '../../utils/calc.js'
import { fmtMoneyShort, fmtPercent } from '../../utils/format.js'

const props = defineProps({
  goal: { type: Object, required: true },
  isChild: { type: Boolean, default: false }
})
const emit = defineEmits(['edit', 'toggle', 'remove', 'toggleMs'])

const statusColor = { active: 'green', paused: 'gold', achieved: 'cyan', abandoned: 'red' }
const statusLabel = { active: '进行中', paused: '已暂停', achieved: '已达成', abandoned: '已放弃' }
const children = computed(() => props.goal.children || [])

function pct(g) { return goalProgress(g, g.currentValue ?? 0) }
function timePct(g) { return goalTimeRatio(g) * 100 }
</script>

<template>
  <div class="q-card" :class="{ 'goal-child': isChild }">
    <div class="row-between wrap gap-12">
      <div class="goal-head">
        <h3 class="card-title" style="margin-bottom:2px">{{ goal.name }}</h3>
        <div class="small muted">
          {{ goal.description }}
          <span class="q-tag t-cyan" style="margin-left:6px">{{ goal.type }}</span>
          <span class="q-tag" :class="'t-' + statusColor[goal.status]" style="margin-left:4px">{{ statusLabel[goal.status] }}</span>
        </div>
      </div>
      <div class="row gap-8">
        <button class="btn btn-sm btn-ghost" @click="emit('edit', goal)">编辑</button>
        <button class="btn btn-sm btn-ghost" @click="emit('toggle', goal)">{{ goal.status === 'active' ? '暂停' : '继续' }}</button>
        <button class="btn btn-sm btn-ghost" @click="emit('remove', goal)">删除</button>
      </div>
    </div>
    <div class="row-between mt-12">
      <span class="goal-value">¥ {{ fmtMoneyShort(goal.targetValue) }}</span>
      <span class="small muted">当前 ¥ {{ fmtMoneyShort(goal.currentValue) }}</span>
    </div>
    <ProgressBar :value="pct(goal)" :color="pct(goal) >= 100 ? 'green' : 'gold'" :height="12" />
    <div class="row-between small muted mt-8">
      <span>数值进度 {{ fmtPercent(pct(goal)) }}</span>
      <span>{{ cnDate(goal.startDate) }} ~ {{ cnDate(goal.endDate) }}</span>
      <span>时间 {{ fmtPercent(timePct(goal), 0) }}</span>
    </div>

    <div v-if="goal.milestones && goal.milestones.length" class="ms-list mt-12">
      <button v-for="m in goal.milestones" :key="m.id" class="ms-item" :class="{ done: m.achieved }" @click="emit('toggleMs', goal, m)">
        <span class="ms-box">{{ m.achieved ? '✔' : '' }}</span>
        <span class="ellipsis" style="flex:1;text-align:left">{{ m.name }}</span>
        <span class="small muted">{{ m.targetValue ? '¥' + fmtMoneyShort(m.targetValue) : '' }}{{ m.date ? ' · ' + m.date : '' }}</span>
      </button>
    </div>

    <div v-if="children.length" class="children mt-12">
      <div class="small bold muted mb-8">📎 拆解子目标</div>
      <GoalCard
        v-for="c in children" :key="c.id"
        :goal="c" is-child
        @edit="emit('edit', $event)" @toggle="emit('toggle', $event)"
        @remove="emit('remove', $event)" @toggle-ms="emit('toggleMs', goal, $event)"
      />
    </div>
  </div>
</template>

<script>
// 递归渲染自身：子组件引用自己
export default { name: 'GoalCard' }
</script>

<style scoped>
.goal-value { font-size: 22px; font-weight: 800; color: var(--cyan-deep); font-variant-numeric: tabular-nums; }
.ms-list { display: flex; flex-direction: column; gap: 6px; }
.ms-item {
  display: flex; align-items: center; gap: 8px;
  background: #fbf6ec; border: 1px solid var(--line-soft);
  border-radius: 10px; padding: 6px 10px; font-size: 13px; color: var(--ink-2);
  transition: background .2s;
}
.ms-item:hover { background: var(--gold-soft); }
.ms-item.done { opacity: .7; }
.ms-item.done .ms-box { background: var(--green); color: #fff; }
.ms-box { width: 18px; height: 18px; border-radius: 5px; border: 1px solid var(--line); display: inline-flex; align-items: center; justify-content: center; font-size: 11px; background: #fff; flex-shrink: 0; }
.children { border-left: 2px dashed var(--cyan-soft); padding-left: 14px; }
.goal-child { box-shadow: none; background: #fdfaf2; }
</style>
