import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Git, Usage } from '../types'
import { BODY_COLOR, clawdFrame, DANCES, frameCount, HATS, pick, WIDTH } from './clawd'
import { bar, basename, isEmpty, isProtected, level, parent, parseGitFile, parseHead, resetIn, tokens, usage } from './format'

const usageAtom = atom({ plugin: 'status-sessao', key: 'usage' } as const, null as Usage | null)
const gitAtom = atom({ plugin: 'status-sessao', key: 'git' } as const, null as Git | null)
const frameAtom = atom({ plugin: 'status-sessao', key: 'frame' } as const, 0)

// Reads .git/HEAD walking up from the session folder; runs no process.
async function readGit($: EngineInterface): Promise<Git | null> {
  try {
    let next: string | null = await $.session.cwd()
    for (let depth = 0; next !== null && depth < 40; depth++) {
      const dir: string = next
      next = parent(dir)
      const dotGit = `${dir === '/' ? '' : dir}/.git`
      if (!(await $.fs.exists(dotGit))) continue
      const stat = await $.fs.stat(dotGit)
      const gitDir = stat.kind === 'file' ? parseGitFile(await $.fs.read(dotGit), dir) : dotGit
      if (gitDir === null) return null
      const head = parseHead(await $.fs.read(`${gitDir}/HEAD`))
      return head ? { repo: basename(dir), ...head } : null
    }
    return null
  } catch {
    return null
  }
}

async function refreshGit($: EngineInterface) {
  const git = await readGit($)
  await update($, gitAtom, () => git)
}

export const register: Register = (on, options) => {
  // "random" (the default) picks once per load, so each session gets its own.
  const dance = pick(options.dance, DANCES, DANCES.filter(d => d !== 'still'), Math.random)
  const hat = pick(options.hat, HATS, HATS, Math.random)

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const now = await $.session.usage()
    await update($, usageAtom, () => usage(now.context, now.rateLimits))
    await refreshGit($)
    // Steps Clawd's dance at the band's right end; each write redraws the band.
    if (frameCount(dance) > 1) {
      $.clock.every(250, () => {
        void update($, frameAtom, n => (n + 1) % frameCount(dance))
      })
    }
    return result
  })

  // After each turn, and whenever a rate-limit window moves a point.
  on('session.measure', async ($, e, next) => {
    await update($, usageAtom, () => usage(e.context, e.rateLimits))
    await refreshGit($)
    return next(e)
  })

  // A checkout or switch mid-turn shows before the next commit, not at the turn's end.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const result = await next(e)
    if (/\bgit\b/.test(e.command)) await refreshGit($)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const data = await read($, usageAtom)
    const git = await read($, gitAtom)
    if (e.props.hasSurvey || (data === null && git === null)) return next(e)

    const now = await $.clock.now()
    const clawd = clawdFrame(dance, hat, await read($, frameAtom))
    const { Box, Text } = $.ui.resolve(e)

    const meter = (key: string, name: string, percent: number | null, detail: string | null) => {
      if (percent === null) {
        return (
          <Box key={key} flexDirection="row" columnGap={1}>
            <Text dimColor>{name}</Text>
            <Text dimColor>—</Text>
          </Box>
        )
      }
      const [filled, rest] = bar(percent)
      return (
        <Box key={key} flexDirection="row" columnGap={1}>
          <Text dimColor>{name}</Text>
          <Text>
            <Text color={level(percent)}>{filled}</Text>
            <Text color="subtle">{rest}</Text>
          </Text>
          <Text color={level(percent)} bold={percent >= 85}>
            {Math.round(percent)}%
          </Text>
          {detail !== null && <Text dimColor>{detail}</Text>}
        </Box>
      )
    }

    const danger = git !== null && (isProtected(git.branch) || git.isDetached)
    const badge = git && (
      <Text key="git" bold color="#ffffff" backgroundColor={danger ? '#c62828' : '#1f6feb'}>
        {` ⎇ ${git.repo} · ${git.isDetached ? `HEAD ${git.branch}` : git.branch} `}
      </Text>
    )

    // The band has one instance for every plugin: draw what is beneath (another
    // mod's band) under this row instead of replacing it.
    const beneath = await next(e)
    const hasBeneath = !isEmpty(beneath)

    return (
      <Box flexDirection="column" rowGap={hasBeneath ? 1 : 0}>
        <Box flexDirection="row" justifyContent="space-between" columnGap={2}>
          <Box flexDirection="row" flexWrap="wrap" columnGap={3} flexShrink={1}>
            {badge}
            {data &&
              meter('ctx', 'context', data.percent, data.tokens === null ? null : `${tokens(data.tokens)}/${tokens(data.window)}`)}
            {data && meter('5h', '5h', data.session?.percent ?? null, data.session ? resetIn(data.session.resetsAt, now) : null)}
            {data && meter('week', 'week', data.weekly?.percent ?? null, data.weekly ? resetIn(data.weekly.resetsAt, now) : null)}
          </Box>
          <Box flexDirection="column" flexShrink={0} width={WIDTH}>
            {clawd.hat && <Text color={clawd.hat.color}>{clawd.hat.row}</Text>}
            {clawd.body.map((row, i) => (
              <Text key={`clawd${i}`} color={BODY_COLOR}>
                {row}
              </Text>
            ))}
          </Box>
        </Box>
        {hasBeneath && beneath}
      </Box>
    )
  })
}
