import { expect, mock, test } from 'claude-code/testing'

import { bar, isProtected, level, parseGitFile, parseHead, resetIn } from '../hooks/format'

test('levels, bars and resets', async () => {
  expect([level(10), level(70), level(90)]).toEqual(['success', 'warning', 'error'])
  expect(bar(50)).toEqual(['━━━━', '━━━━'])
  const now = Date.parse('2026-10-15T12:00:00Z')
  expect(resetIn('2026-10-15T15:05:00Z', now)).toBe('3h05')
  expect(resetIn('2026-10-17T13:00:00Z', now)).toBe('2d1h')
})

test('git HEAD and .git files', async () => {
  expect(parseHead('ref: refs/heads/feat/login\n')).toEqual({ branch: 'feat/login', isDetached: false })
  expect(parseHead('569c5283d9a0a7ee7938df85bb32e4f48cbb8c86\n')).toEqual({ branch: '569c528', isDetached: true })
  expect(parseGitFile('gitdir: ../.git/worktrees/x\n', '/r/wt')).toBe('/r/wt/../.git/worktrees/x')
  expect(isProtected('main')).toBe(true)
  expect(isProtected('release/1.2')).toBe(true)
  expect(isProtected('feat/main-menu')).toBe(false)
})

test('the band shows the branch and the meters', async ($, on) => {
  mock.clock(on)
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('session.cwd', () => ({ value: '/home/u/app/src' }))
  on('fs.exists', ($, e) => ({ value: e.path === '/home/u/app/.git' }) as never)
  on('fs.stat', () => ({ value: { kind: 'directory', size: 0, mtimeMs: 0, isLink: false } }) as never)
  on('fs.read', () => ({ value: 'ref: refs/heads/main\n' }) as never)

  await $.session.measure({
    context: { tokens: 68_000, window: 200_000, percent: 34 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 72, resetsAt: '2099-01-01T00:00:00Z' },
      { kind: 'seven_day', percentUsed: 91 },
    ],
    changed: ['context', 'rateLimits'],
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'status-sessao',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 20 }, view: {} },
    })
    expect(await ui.find({ type: 'Text', text: /app · main/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^34%$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^72%$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^91%$/ })).toBeDefined()
    await ui.unmount()
  }
})
