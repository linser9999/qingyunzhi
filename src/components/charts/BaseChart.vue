<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { PieChart, BarChart, LineChart, ScatterChart } from 'echarts/charts'
import { TooltipComponent, GridComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

// 按需注册，显著减小打包体积
echarts.use([PieChart, BarChart, LineChart, ScatterChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer])

const props = defineProps({
  option: { type: Object, required: true },
  height: { type: String, default: '300px' },
  autoresize: { type: Boolean, default: true }
})

const el = ref(null)
let chart = null
let ro = null

function render() {
  if (!chart) return
  chart.setOption(props.option, true)
}

onMounted(() => {
  chart = echarts.init(el.value)
  render()
  if (props.autoresize) {
    ro = new ResizeObserver(() => chart && chart.resize())
    ro.observe(el.value)
    window.addEventListener('resize', resize)
  }
})

function resize() { chart && chart.resize() }

onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  window.removeEventListener('resize', resize)
  if (chart) { chart.dispose(); chart = null }
})

watch(() => props.option, render, { deep: true })
</script>

<template>
  <div ref="el" :style="{ width: '100%', height }"></div>
</template>
