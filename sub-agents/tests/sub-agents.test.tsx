import { expect, mock, test } from 'claude-code/testing'

import { CANCEL, options, parse } from '../hooks/choices'

test('options offer the suggestion and its neighbours', async () => {
  const { labels, byLabel } = options({ model: 'opus', effort: 'high' })
  expect(labels).toEqual(['opus · high (suggested)', 'opus · medium', 'opus · xhigh', CANCEL])
  expect(byLabel.get('opus · medium')).toEqual({ model: 'opus', effort: 'medium' })
  expect(options({}).labels[0]).toBe('agent default (suggested)')
})

test('typed answers are parsed', async () => {
  expect(parse('Sonnet high')).toEqual({ model: 'sonnet', effort: 'high' })
  expect(parse('haiku')).toEqual({ model: 'haiku', effort: undefined })
  expect(parse('qualquer coisa')).toBe(null)
})

const PANE = {
  component: 'Pane',
  requestId: 'sub-agents',
} as const

test('a spawned subagent shows in the pane and finishes', async ($, on) => {
  mock.clock(on)
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: 'a1' }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  await $.agent.spawn({
    tool_use_id: 't1',
    prompt: 'Implement issue 3',
    description: 'Issue 3: login',
    subagentType: 'parallel-issue-executor',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-opus-5-5',
    background: true,
    fork: false,
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'sub-agents', surface, ...PANE, props: {} as never })
    expect(await ui.find({ type: 'Text', text: /Issue 3: login/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /sonnet/ })).toBeDefined()
    await ui.unmount()
  }
})

test('choose mode is on by default: it asks and rewrites the model and effort', async ($, on) => {
  mock.clock(on)
  const asked: string[] = []
  on('tool.call', { tool: 'AskUserQuestion' }, ($, e) => {
    const question = e.questions[0]?.question ?? ''
    asked.push(question)
    return { result: { questions: e.questions, answers: { [question]: 'sonnet · high' } } as never }
  })
  let ran: { model?: string; effort?: string } = {}
  on('tool.call', { tool: 'Agent' }, ($, e) => {
    ran = { model: e.model, effort: e.effort }
    return { result: { status: 'async_launched' } as never }
  })

  await $.tool.call({
    tool: 'Agent',
    tool_use_id: 't2',
    description: 'Issue 4',
    prompt: 'Implement issue 4',
    model: 'opus',
    effort: 'medium',
  } as never)

  expect(asked[0]).toMatch(/Issue 4/)
  expect(ran).toEqual({ model: 'sonnet', effort: 'high' })
})

test('choose turns choose mode off', async ($, on) => {
  mock.clock(on)
  let asked = false
  on('tool.call', { tool: 'AskUserQuestion' }, () => {
    asked = true
    return { result: {} as never }
  })
  let ran: { model?: string; effort?: string } = {}
  on('tool.call', { tool: 'Agent' }, ($, e) => {
    ran = { model: e.model, effort: e.effort }
    return { result: { status: 'async_launched' } as never }
  })

  await $.command.run({ command: 'sub-agents', args: 'choose' } as never)
  await $.tool.call({
    tool: 'Agent',
    tool_use_id: 't3',
    description: 'Issue 5',
    prompt: 'Implement issue 5',
    model: 'opus',
    effort: 'medium',
  } as never)

  expect(asked).toBe(false)
  expect(ran).toEqual({ model: 'opus', effort: 'medium' })
})
