/**
 * 导出工具：Markdown 报告 / CSV / JSON 备份 / 打印（可另存为 PDF）
 */

function download(filename, content, mime = 'text/plain') {
  const blob = new Blob(['\uFEFF' + content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** 导出 Markdown 报告 */
export function exportMarkdown(filename, title, sections) {
  const lines = [`# ${title}`, '', `> 由《青云志 · 人生进度簿》自动生成 · ${new Date().toLocaleString('zh-CN')}`, '']
  for (const s of sections) {
    if (!s) continue
    if (s.heading) lines.push(`## ${s.heading}`, '')
    if (s.items && s.items.length) {
      for (const it of s.items) {
        if (it) lines.push(typeof it === 'string' ? `- ${it}` : `- **${it.name}**${it.value !== undefined ? `：${it.value}` : ''}`)
      }
      lines.push('')
    }
    if (s.table && s.table.length) {
      const heads = Object.keys(s.table[0])
      lines.push('| ' + heads.join(' | ') + ' |')
      lines.push('| ' + heads.map(() => '---').join(' | ') + ' |')
      for (const row of s.table) lines.push('| ' + heads.map(h => row[h] ?? '').join(' | ') + ' |')
      lines.push('')
    }
  }
  download(filename, lines.join('\n'), 'text/markdown')
}

/** 导出 CSV */
export function exportCSV(filename, rows) {
  if (!rows.length) return
  const heads = Object.keys(rows[0])
  const esc = v => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [heads.map(esc).join(',')]
  for (const r of rows) lines.push(heads.map(h => esc(r[h])).join(','))
  download(filename, lines.join('\n'), 'text/csv')
}

/** 导出 JSON 备份 */
export function exportJSON(filename, data) {
  download(filename, JSON.stringify(data, null, 2), 'application/json')
}

/** 打印当前窗口内容（浏览器"另存为 PDF"即可导出 PDF） */
export function printPage() {
  window.print()
}
