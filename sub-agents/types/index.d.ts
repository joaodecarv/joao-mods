export type AgentStatusRow = 'running' | 'done' | 'failed' | 'stopped'

export type AgentRow = {
  id: string
  description: string
  type: string
  model: string
  effort: string | null
  status: AgentStatusRow
  startedAt: number
  endedAt: number | null
  tools: number
  lastTool: string | null
  tokens: number | null
}

declare module 'claude-code' {
  interface PluginState {
    'sub-agents': { agents: AgentRow[]; choose: boolean; now: number }
  }
}
