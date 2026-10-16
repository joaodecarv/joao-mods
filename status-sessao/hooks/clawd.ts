// Clawd, the Claude Code mascot, in the three block rows of the welcome screen,
// plus an optional hat row above. Every frame is WIDTH columns so nothing shifts.

export const WIDTH = 11

export const DANCES = ['wave', 'shuffle', 'sway', 'party', 'still'] as const
export const HATS = ['none', 'tophat', 'party', 'crown', 'cap'] as const
export type Dance = (typeof DANCES)[number]
export type Hat = (typeof HATS)[number]

export const BODY_COLOR = '#d77757'

type Pose = readonly [string, string, string]

const BASE: Pose = [' ▐▛███▜▌ ', '▝▜█████▛▘', '  ▘▘ ▝▝  ']
const LEFT_UP: Pose = ['▗▐▛███▜▌ ', ' ▜█████▛▘', '  ▘▘ ▝▝  ']
const RIGHT_UP: Pose = [' ▐▛███▜▌▖', '▝▜█████▛ ', '  ▘▘ ▝▝  ']
const BOTH_UP: Pose = ['▗▐▛███▜▌▖', ' ▜█████▛ ', '  ▘▘ ▝▝  ']
const TAP: Pose = ['▗▐▛███▜▌▖', ' ▜█████▛ ', '  ▝▝ ▘▘  ']

// Each step: a pose and how many columns it sits right of the left edge (0 to 2).
const STEPS: Record<Dance, readonly (readonly [Pose, number])[]> = {
  wave: [[BASE, 1], [LEFT_UP, 1], [BASE, 1], [RIGHT_UP, 1]],
  shuffle: [[BASE, 1], [TAP, 1], [BASE, 1], [BOTH_UP, 1]],
  sway: [[BASE, 0], [BASE, 1], [BASE, 2], [BASE, 1]],
  party: [[BOTH_UP, 0], [TAP, 1], [BOTH_UP, 2], [TAP, 1], [LEFT_UP, 1], [RIGHT_UP, 1]],
  still: [[BASE, 1]],
}

// Centred over the head (the pose's columns 1 to 7).
const HAT_ROWS: Record<Exclude<Hat, 'none'>, { row: string; color: string }> = {
  tophat: { row: '  ▗███▖  ', color: '#8b8b8b' },
  party: { row: '    ▲    ', color: '#e05bd0' },
  crown: { row: '  ▙▟▙▟▌  ', color: '#f5c542' },
  cap: { row: '  ▄███▄▄ ', color: '#1f6feb' },
}

export type Frame = { hat: { row: string; color: string } | null; body: Pose }

export function frameCount(dance: Dance): number {
  return STEPS[dance].length
}

export function clawdFrame(dance: Dance, hat: Hat, n: number): Frame {
  const steps = STEPS[dance]
  const [pose, shift] = steps[n % steps.length] ?? [BASE, 1]
  const place = (row: string) => (' '.repeat(shift) + row).padEnd(WIDTH)
  const top = hat === 'none' ? null : HAT_ROWS[hat]
  return {
    hat: top && { row: place(top.row), color: top.color },
    body: [place(pose[0]), place(pose[1]), place(pose[2])],
  }
}

/** A configured value, or one picked at random when it is "random" or unknown. */
export function pick<T extends string>(value: unknown, all: readonly T[], pool: readonly T[], random: () => number): T {
  if (typeof value === 'string' && (all as readonly string[]).includes(value)) return value as T
  return pool[Math.floor(random() * pool.length) % pool.length] as T
}
