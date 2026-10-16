import { expect, mock, test } from 'claude-code/testing'

const PROPS = { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 20 }, view: {} }

async function oneEditTurn($: any, on: any) {
  mock.clock(on)
  on('session.cwd', () => ({ value: '/r' }))
  on('fs.exists', () => ({ value: false }) as never)
  on('fs.read', () => ({ value: 'a\n' }) as never)
  on('tool.call', { tool: 'Edit' }, () => ({ result: { ok: true } as never }))
  on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }) as never)
  on('turn.complete', ($: any, e: any) => ({ text: e.answer }) as never)
  on('prompt.submit', ($: any, e: any) => ({ text: e.text }) as never)
  on('ui.render', { component: 'AbovePrompt' }, ($: any, e: any) => $.ui.resolve(e).Box({}))

  await $.turn.start({ turnId: 'turn1' } as never)
  await $.tool.call({ tool: 'Edit', tool_use_id: 't1', file_path: '/r/a.txt', old_string: 'a', new_string: 'b' } as never)
  await $.turn.complete({ turnId: 'turn1', answer: 'done', reason: 'answer' } as never)
}

test('Dismiss hides the hint', async ($, on) => {
  await oneEditTurn($, on)
  const ui = await $.ui.mount({ plugin: 'replay-theater', surface: 'terminal', component: 'AbovePrompt', props: PROPS as never })
  expect(await ui.find({ type: 'Text', text: /Replay: 1 edit/ })).toBeDefined()
  await ui.press({ key: 'dismiss-replay' })
  expect(await ui.find({ type: 'Text', text: /Replay: 1 edit/ })).toBeUndefined()
  await ui.unmount()
})

test('the next prompt hides the hint', async ($, on) => {
  await oneEditTurn($, on)
  await $.prompt.submit({ text: 'next thing' } as never)
  const ui = await $.ui.mount({ plugin: 'replay-theater', surface: 'terminal', component: 'AbovePrompt', props: PROPS as never })
  expect(await ui.find({ type: 'Text', text: /Replay: 1 edit/ })).toBeUndefined()
  await ui.unmount()
})
