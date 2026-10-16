export type Limit = { percent: number; resetsAt: string | null }

export type Usage = {
  tokens: number | null
  window: number
  percent: number | null
  session: Limit | null
  weekly: Limit | null
}

export type Git = { repo: string; branch: string; isDetached: boolean }

declare module 'claude-code' {
  interface PluginState {
    'status-sessao': { usage: Usage | null; git: Git | null; frame: number }
  }
}
