/**
 * UI Store：轻提示（toast）、全局模态、页面过渡状态
 */
import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', {
  state: () => ({
    toasts: [],
    toastId: 0
  }),
  actions: {
    toast(message, type = 'info', duration = 2600) {
      const id = ++this.toastId
      this.toasts.push({ id, message, type })
      setTimeout(() => this.dismiss(id), duration)
    },
    dismiss(id) {
      const i = this.toasts.findIndex(t => t.id === id)
      if (i >= 0) this.toasts.splice(i, 1)
    }
  }
})
