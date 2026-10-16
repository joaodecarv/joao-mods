import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRow } from '../types'
import { CANCEL, elapsed, label, options, parse, shortModel, tokens } from './choices'
import type { Choice } from './choices'

const PANE = 'subagentes'
const TITLE = 'Subagentes'

const agents = atom({ plugin: 'subagentes', key: 'agents' } as const, [] as AgentRow[])
const choose = atom({ plugin: 'subagentes', key: 'choose' } as const, false)
const now = atom({ plugin: 'subagentes', key: 'now' } as const, 0)

// Sent once to the model, beside the next prompt, after choose mode is turned on.
// Goes in the prompt's context rather than the system prompt, so the prompt cache survives.
const HINT =
  'Subagent choice mode is on: on every Agent tool call, set `model` and `effort` to the pair you ' +
  'recommend for that task (the user asked for this and confirms each choice before the subagent runs). ' +
  'Prefer the cheapest pair that will get the task right.'

// Module state: starts over on a reload, which only loses a pending hint and in-flight efforts.
let hintPending = false
// Agent tool call id -> effort chosen; agent.spawn does not carry the effort.
const efforts = new Map<string, string | undefined>()

async function setRow($: EngineInterface, id: string, fn: (row: AgentRow) => AgentRow) {
  await update($, agents, list => list.map(row => (row.id === id ? fn(row) : row)))
}

async function refreshStatus($: EngineInterface) {
  const running = (await read($, agents)).filter(a => a.status === 'running').length
  $.ui.status(running === 0 ? undefined : `${running} subagente${running === 1 ? '' : 's'} rodando`)
}

async function toggleChoose($: EngineInterface): Promise<boolean> {
  const isOn = !(await read($, choose))
  await update($, choose, () => isOn)
  hintPending = isOn
  return isOn
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({
      name: 'subagentes',
      description: 'Abre o painel de subagentes; "/subagentes escolher" liga ou desliga a escolha de modelo e esforço',
    })
    // Ticks the elapsed time and reconciles statuses, only while something runs.
    $.clock.every(1000, () => {
      void (async () => {
        const list = await read($, agents)
        if (!list.some(a => a.status === 'running')) return
        const at = await $.clock.now()
        const live = new Map((await $.agent.list()).map(a => [a.id, a.status]))
        await update($, agents, rows =>
          rows.map((row): AgentRow => {
            const status = live.get(row.id)
            if (row.status !== 'running' || status === undefined) return row
            if (status === 'completed') return { ...row, status: 'done', endedAt: row.endedAt ?? at }
            if (status === 'failed') return { ...row, status: 'failed', endedAt: row.endedAt ?? at }
            if (status === 'killed') return { ...row, status: 'stopped', endedAt: row.endedAt ?? at }
            return row
          }),
        )
        await update($, now, () => at)
        await refreshStatus($)
      })()
    })
    return result
  })

  on('command.run', { command: 'subagentes' }, async ($, e) => {
    if (/^escolher\b/i.test(e.args.trim())) {
      const isOn = await toggleChoose($)
      return {
        text: isOn
          ? 'Escolha de modelo e esforço ligada: cada subagente pede sua confirmação antes de rodar.'
          : 'Escolha de modelo e esforço desligada: o Claude decide sozinho.',
      }
    }
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Painel de subagentes aberto.' }
  })

  on('prompt.submit', async ($, e, next) => {
    if (!hintPending || !(await read($, choose))) return next(e)
    hintPending = false
    return next({ ...e, context: [...(e.context ?? []), HINT] })
  })

  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    if (!(await read($, choose))) {
      efforts.set(e.tool_use_id, e.effort)
      return next(e)
    }
    const suggested: Choice = { model: e.model, effort: e.effort }
    const { labels, byLabel } = options(suggested)
    const type = e.subagent_type ?? 'general-purpose'
    let answer: string
    try {
      answer = await $.ui.ask(`Rodar "${e.description}" (${type}) com qual modelo e esforço?`, {
        header: 'Subagente',
        options: labels,
      })
    } catch {
      answer = CANCEL
    }
    if (answer === CANCEL) {
      return { deny: 'The user cancelled this subagent in the choice dialog. Do not spawn it again unless they ask.' }
    }
    let choice = byLabel.get(answer) ?? parse(answer)
    if (choice === null) {
      $.ui.toast(`Não entendi "${answer}"; usando ${label(suggested)}`)
      choice = suggested
    }
    efforts.set(e.tool_use_id, choice.effort)
    return next({ ...e, model: choice.model, effort: choice.effort })
  })

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    if (result.agentId === undefined) return result
    const at = await $.clock.now()
    const row: AgentRow = {
      id: result.agentId,
      description: e.description,
      type: e.subagentType,
      model: shortModel(result.model),
      effort: efforts.get(e.tool_use_id) ?? null,
      status: 'running',
      startedAt: at,
      endedAt: null,
      tools: 0,
      lastTool: null,
      tokens: null,
    }
    efforts.delete(e.tool_use_id)
    await update($, agents, list => [...list, row].slice(-50))
    await update($, now, () => at)
    await refreshStatus($)
    void $.ui.open({ id: PANE, title: TITLE }).catch(() => undefined)
    return result
  })

  on('tool.call', ($, e, next) => {
    const id = e.agentId
    if (id !== undefined) {
      void setRow($, id, row => ({ ...row, tools: row.tools + 1, lastTool: e.tool }))
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId
    if (id !== undefined) {
      const at = await $.clock.now()
      const u = e.usage
      const used = u
        ? u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens + u.output_tokens
        : null
      const status = e.isAborted || e.reason === 'aborted' ? 'stopped' : e.reason === 'answer' ? 'done' : 'failed'
      await setRow($, id, row => ({ ...row, status, endedAt: at, tokens: used ?? row.tokens }))
      await refreshStatus($)
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, agents)
    const isChoosing = await read($, choose)
    const at = Math.max(await read($, now), ...list.map(a => a.endedAt ?? a.startedAt))
    const room = Math.max(1, (e.viewport?.rows ?? 24) - 3)

    const mark = {
      running: { glyph: '●', color: '#4a8fe7' },
      done: { glyph: '✓', color: 'success' },
      failed: { glyph: '✗', color: 'error' },
      stopped: { glyph: '■', color: 'subtle' },
    } as const

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" columnGap={2}>
          <Button
            key="choose"
            label={isChoosing ? 'Escolher modelo: ligado' : 'Escolher modelo: desligado'}
            onPress={() => toggleChoose($)}
          />
          <Button
            key="clear"
            label="Limpar concluídos"
            onPress={() => update($, agents, rows => rows.filter(r => r.status === 'running'))}
          />
        </Box>
        {list.length === 0 && <Text dimColor>Nenhum subagente nesta sessão.</Text>}
        {list.slice(-room).map(a => (
          <Box key={a.id} flexDirection="row" columnGap={1}>
            <Text color={mark[a.status].color}>{mark[a.status].glyph}</Text>
            <Box flexGrow={1} flexShrink={1}>
              <Text wrap="truncate-end" dimColor={a.status !== 'running'}>
                {a.description}
              </Text>
            </Box>
            <Text dimColor>{a.type}</Text>
            <Text color="#4a8fe7">{a.effort ? `${a.model} · ${a.effort}` : a.model}</Text>
            <Text dimColor>{elapsed((a.endedAt ?? at) - a.startedAt)}</Text>
            <Text dimColor>
              {a.tools} ferr.{a.lastTool && a.status === 'running' ? ` · ${a.lastTool}` : ''}
            </Text>
            {a.tokens !== null && <Text dimColor>{tokens(a.tokens)} tok</Text>}
          </Box>
        ))}
      </Box>
    )
  })
}
