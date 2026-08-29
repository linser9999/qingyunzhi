/**
 * 轻量 Markdown 渲染（无外部依赖）
 * 支持：标题、粗体、斜体、列表、引用、分隔线、代码块、链接、表格（基础）
 * 仅供复盘富文本预览使用，输出为 HTML 字符串。
 */

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inline(md) {
  let s = esc(md)
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>')
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  return s
}

export function renderMarkdown(md) {
  if (!md) return ''
  const lines = String(md).split(/\r?\n/)
  const out = []
  let inList = false
  let inCode = false
  let codeBuf = []
  let tableBuf = []

  const closeList = () => { if (inList) { out.push('</ul>'); inList = false } }
  const flushTable = () => {
    if (!tableBuf.length) return
    const isHeader = tableBuf[1] && /^\s*\|?\s*:?-{2,}/.test(tableBuf[1])
    const rows = isHeader ? [tableBuf[0], ...tableBuf.slice(2)] : tableBuf
    out.push('<table>')
    rows.forEach((r, i) => {
      const cells = r.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
      const tag = i === 0 ? 'th' : 'td'
      out.push('<tr>' + cells.map(c => `<${tag}>${inline(c)}</${tag}>`).join('') + '</tr>')
    })
    out.push('</table>')
    tableBuf = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    // 代码块
    if (line.trim().startsWith('```')) {
      if (!inCode) { closeList(); flushTable(); inCode = true; codeBuf = [] }
      else { out.push(`<pre><code>${esc(codeBuf.join('\n'))}</code></pre>`); inCode = false }
      continue
    }
    if (inCode) { codeBuf.push(line); continue }

    // 表格（行以 | 开头）
    if (/^\s*\|/.test(line)) { closeList(); tableBuf.push(line); continue }
    flushTable()

    if (/^#{1,6}\s+/.test(line)) {
      closeList()
      const level = line.match(/^#+/)[0].length
      out.push(`<h${level}>${inline(line.replace(/^#+\s*/, ''))}</h${level}>`)
    } else if (/^>\s?/.test(line)) {
      closeList()
      out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`)
    } else if (/^\s*[-*]\s+/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`)
    } else if (/^\s*\d+\.\s+/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true }
      out.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`)
    } else if (/^\s*---+/.test(line)) {
      closeList()
      out.push('<hr />')
    } else if (line.trim() === '') {
      closeList()
    } else {
      closeList()
      out.push(`<p>${inline(line)}</p>`)
    }
  }
  closeList()
  flushTable()
  if (inCode) out.push(`<pre><code>${esc(codeBuf.join('\n'))}</code></pre>`)
  return out.join('\n')
}
