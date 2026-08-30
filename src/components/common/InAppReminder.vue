<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { REMINDER_EVENT } from '../../utils/reminders.js'

const visible = ref(false)
const current = ref({ title: '', body: '' })
let hideTimer = null

function show(e) {
  const { title, body } = e.detail || {}
  current.value = { title, body }
  visible.value = true
  if (hideTimer) clearTimeout(hideTimer)
  // 10 秒后自动关闭
  hideTimer = setTimeout(() => { visible.value = false }, 10000)
}

function close() {
  visible.value = false
  if (hideTimer) clearTimeout(hideTimer)
}

onMounted(() => {
  window.addEventListener(REMINDER_EVENT, show)
})
onBeforeUnmount(() => {
  window.removeEventListener(REMINDER_EVENT, show)
  if (hideTimer) clearTimeout(hideTimer)
})
</script>

<template>
  <Transition name="reminder-pop">
    <div v-if="visible" class="in-app-reminder" @click="close">
      <div class="reminder-icon">🔔</div>
      <div class="reminder-content">
        <div class="reminder-title">{{ current.title }}</div>
        <div class="reminder-body">{{ current.body }}</div>
      </div>
      <button class="reminder-close" @click.stop="close">✕</button>
    </div>
  </Transition>
</template>

<style scoped>
.in-app-reminder {
  position: fixed;
  top: 70px;
  right: 16px;
  z-index: 200;
  max-width: 340px;
  background: linear-gradient(135deg, #fffdf7, #f9f1e0);
  border: 2px solid var(--gold);
  border-radius: var(--radius);
  box-shadow: var(--shadow-float);
  padding: 14px 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  animation: reminderSlideIn .4s cubic-bezier(.34,1.56,.64,1);
}
@keyframes reminderSlideIn {
  from { opacity: 0; transform: translateX(40px) scale(.9); }
  to { opacity: 1; transform: translateX(0) scale(1); }
}
.reminder-icon {
  font-size: 28px;
  flex-shrink: 0;
  animation: ring 1s ease-in-out infinite;
}
@keyframes ring {
  0%, 100% { transform: rotate(0); }
  25% { transform: rotate(15deg); }
  75% { transform: rotate(-15deg); }
}
.reminder-content { flex: 1; min-width: 0; }
.reminder-title {
  font-family: var(--font-title);
  font-size: 15px;
  color: var(--ink);
  margin-bottom: 4px;
  font-weight: 600;
}
.reminder-body {
  font-size: 13px;
  color: var(--ink-2);
  line-height: 1.5;
  white-space: pre-line;
}
.reminder-close {
  background: none;
  border: none;
  color: var(--ink-3);
  font-size: 14px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  flex-shrink: 0;
}
.reminder-close:hover { background: var(--line-soft); color: var(--ink); }

.reminder-pop-enter-active, .reminder-pop-leave-active {
  transition: opacity .3s, transform .3s;
}
.reminder-pop-enter-from, .reminder-pop-leave-to {
  opacity: 0;
  transform: translateX(40px) scale(.9);
}

/* 手机端：底部弹出，不被底部导航遮挡 */
@media (max-width: 900px) {
  .in-app-reminder {
    top: auto;
    bottom: calc(var(--bottomnav-h) + 16px);
    right: 12px;
    left: 12px;
    max-width: none;
  }
}
</style>
