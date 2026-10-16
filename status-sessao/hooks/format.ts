import type { RenderElement, SessionContextUsage, SessionRateLimit } from 'claude-code'

import type { Limit, Usage } from '../types'

const PROTECTED = /^(main|master|prod|production|release|develop|trunk)$|^release\//

export function isProtected(branch: string): boolean {
  return PROTECTED.test(branch)
}

export function level(percent: number): 'success' | 'warning' | 'error' {
  if (percent >= 85) return 'error'
  if (percent >= 60) return 'warning'
  return 'success'
}

export function bar(percent: number, width = 8): [string, string] {
  const filled = Math.round((Math.min(Math.max(percent, 0), 100) / 100) * width)
  return ['━'.repeat(filled), '━'.repeat(width - filled)]
}

export function tokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

export function resetIn(resetsAt: string | null, now: number): string | null {
  if (resetsAt === null) return null
  const ms = Date.parse(resetsAt) - now
  if (!Number.isFinite(ms) || ms <= 0) return null
  const minutes = Math.floor(ms / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `${days}d${hours}h`
  if (hours > 0) return `${hours}h${String(minutes % 60).padStart(2, '0')}`
  return `${minutes}m`
}

function limit(rateLimits: readonly SessionRateLimit[], kind: string): Limit | null {
  const found = rateLimits.find(r => r.kind === kind)
  return found ? { percent: found.percentUsed, resetsAt: found.resetsAt ?? null } : null
}

export function usage(context: SessionContextUsage, rateLimits: readonly SessionRateLimit[]): Usage {
  return {
    tokens: context.tokens ?? null,
    window: context.window,
    percent: context.percent ?? null,
    session: limit(rateLimits, 'five_hour'),
    weekly: limit(rateLimits, 'seven_day'),
  }
}

/** `.git/HEAD`: a symbolic ref names the branch; a bare hash means a detached HEAD. */
export function parseHead(text: string): { branch: string; isDetached: boolean } | null {
  const line = text.trim()
  const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(line)
  if (ref?.[1]) return { branch: ref[1], isDetached: false }
  if (/^[0-9a-f]{7,64}$/.test(line)) return { branch: line.slice(0, 7), isDetached: true }
  return null
}

/** A `.git` file (worktree or submodule) points at the real git dir, maybe relatively. */
export function parseGitFile(text: string, dir: string): string | null {
  const m = /^gitdir:\s*(.+)$/m.exec(text)
  if (!m?.[1]) return null
  const target = m[1].trim()
  return target.startsWith('/') ? target : `${dir}/${target}`
}

export function parent(dir: string): string | null {
  const i = dir.replace(/\/+$/, '').lastIndexOf('/')
  return i <= 0 ? (dir === '/' ? null : '/') : dir.slice(0, i)
}

export function basename(dir: string): string {
  return dir.replace(/\/+$/, '').split('/').pop() || dir
}

/** What the engine draws when no other mod has anything for the band: a bare Box. */
export function isEmpty(el: RenderElement): boolean {
  return el.type === 'Box' && !el.children?.length
}
