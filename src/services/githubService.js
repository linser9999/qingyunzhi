/**
 * GitHub Service：通过 GitHub REST API 读写 data/user-data.json
 * - 使用用户提供的 Personal Access Token（PAT）鉴权，仅存 localStorage
 * - 处理 Base64 编解码（UTF-8 安全）
 * - 提供 SHA 回写避免冲突；剩余限额可查，用于限流友好提示
 */
import { localCache } from './localCache.js'

const GH_API = 'https://api.github.com'

/** UTF-8 安全的 Base64 编码（分块避免调用栈溢出） */
export function encodeBase64(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

/** UTF-8 安全的 Base64 解码 */
export function decodeBase64(b64) {
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

class GitHubService {
  get config() { return localCache.readConfig() }

  isConfigured() {
    const c = this.config
    return !!(c && c.token && c.owner && c.repo)
  }

  get fileUrl() {
    const { owner, repo, branch = 'main', path = 'data/user-data.json' } = this.config
    return `${GH_API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
  }

  get headers() {
    return {
      Authorization: `Bearer ${this.config.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  }

  /** 读取文件，返回 { data, sha }；文件不存在返回 null */
  async readData() {
    const res = await fetch(this.fileUrl, { headers: this.headers })
    if (res.status === 404) return null
    if (!res.ok) throw this._err(res, '读取')
    const json = await res.json()
    return { data: JSON.parse(decodeBase64(json.content)), sha: json.sha }
  }

  /** 写入文件，返回新 sha */
  async writeData(data, sha) {
    const body = {
      message: `qyz 数据更新 ${new Date().toISOString().slice(0, 19)}`,
      content: encodeBase64(JSON.stringify(data, null, 2)),
      branch: this.config.branch || 'main'
    }
    if (sha) body.sha = sha
    const res = await fetch(this.fileUrl.split('?')[0], {
      method: 'PUT',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) throw this._err(res, '写入')
    const json = await res.json()
    return json.content.sha
  }

  /** 验证 PAT 与仓库可达性，返回用户名 */
  async verify() {
    const res = await fetch(`${GH_API}/user`, { headers: this.headers })
    if (!res.ok) throw this._err(res, '验证')
    const user = await res.json()
    // 再验证仓库可读
    const r = await fetch(`${GH_API}/repos/${this.config.owner}/${this.config.repo}`, { headers: this.headers })
    if (!r.ok) throw new Error(`无法访问仓库 ${this.config.owner}/${this.config.repo}（${r.status}）`)
    return user.login
  }

  /** 当前 API 剩余配额 */
  async rateLimit() {
    try {
      const res = await fetch(`${GH_API}/rate_limit`, { headers: this.headers })
      if (!res.ok) return null
      const j = await res.json()
      return j.resources?.core
    } catch { return null }
  }

  _err(res, action) {
    // 异步读取响应体用于调试（不阻塞错误抛出）
    res.clone?.().text?.().then(text => {
      try { console.warn(`[GitHub ${action}] ${res.status}:`, JSON.parse(text).message || text.slice(0, 300)) } catch { /* ignore */ }
    }).catch(() => {})
    const hint = this._hint(res.status)
    return new Error(`${action}失败 (${res.status})${hint ? '：' + hint : ''}`)
  }

  _hint(status) {
    return status === 401 ? 'PAT 无效或已过期' :
      status === 403 ? '权限不足或触发限流（请检查 PAT 是否有 repo 权限）' :
      status === 409 ? '数据冲突（可能已在其他设备修改）' :
      status === 404 ? '仓库或路径不存在' :
      status === 422 ? '请求参数无效（sha 过期或分支不存在）' : ''
  }
}

export const githubService = new GitHubService()
