export type Model = 'haiku' | 'sonnet' | 'opus' | 'fable'
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type Choice = { model?: Model; effort?: Effort }

const MODELS: readonly Model[] = ['haiku', 'sonnet', 'opus', 'fable']
const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']

// Cheapest to strongest; the alternatives offered are the neighbours of the suggestion.
const LADDER: readonly Required<Choice>[] = [
  { model: 'haiku', effort: 'low' },
  { model: 'haiku', effort: 'medium' },
  { model: 'sonnet', effort: 'medium' },
  { model: 'sonnet', effort: 'high' },
  { model: 'opus', effort: 'medium' },
  { model: 'opus', effort: 'high' },
  { model: 'opus', effort: 'xhigh' },
  { model: 'fable', effort: 'high' },
]

export const CANCEL = 'Cancel'

export function label(c: Choice): string {
  if (!c.model && !c.effort) return 'agent default'
  return [c.model ?? 'default model', c.effort ?? 'default effort'].join(' · ')
}

function rung(c: Choice): number {
  const exact = LADDER.findIndex(r => r.model === c.model && r.effort === c.effort)
  if (exact >= 0) return exact
  const sameModel = LADDER.findIndex(r => r.model === c.model)
  return sameModel >= 0 ? sameModel : 4
}

/** Up to four options: the suggestion, one rung cheaper, one rung stronger, and Cancel. */
export function options(suggested: Choice): { labels: string[]; byLabel: Map<string, Choice> } {
  const byLabel = new Map<string, Choice>()
  byLabel.set(`${label(suggested)} (suggested)`, suggested)
  const i = rung(suggested)
  for (const j of [i - 1, i + 1]) {
    const alt = LADDER[j]
    if (alt && label(alt) !== label(suggested)) byLabel.set(label(alt), alt)
  }
  return { labels: [...byLabel.keys(), CANCEL], byLabel }
}

/** Reads text typed under "Other", such as "sonnet high" or "opus". */
export function parse(text: string): Choice | null {
  const words = text.toLowerCase().split(/[^a-z]+/)
  const model = MODELS.find(m => words.includes(m))
  const effort = EFFORTS.find(x => words.includes(x))
  return model || effort ? { model, effort } : null
}

export function shortModel(id: string): string {
  return MODELS.find(m => id.toLowerCase().includes(m)) ?? id
}

export function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`
}

export function tokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}
