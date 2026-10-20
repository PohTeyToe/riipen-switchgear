import { checkQuote, type QuoteStatus } from './quotes'
import type { Level, RolePlay, RubricId, RunRecord, SkillId } from './types'
import { RUBRICS, SKILLS } from './types'

export const CERT_LEVEL = 3

/** Certified when every skill is at Proficient (3) or above. */
export function certifies(levels: Record<SkillId, number>): boolean {
  return SKILLS.every((s) => levels[s] >= CERT_LEVEL)
}

/** Quadratic weighted kappa between paired ratings on a 1..k scale. */
export function weightedKappa(a: number[], b: number[], k = 4): number {
  if (a.length !== b.length || a.length === 0) throw new Error('need paired ratings')
  const n = a.length
  const O = Array.from({ length: k }, () => new Array(k).fill(0))
  for (let i = 0; i < n; i++) O[a[i] - 1][b[i] - 1]++
  const ra = O.map((row) => row.reduce((x, y) => x + y, 0))
  const cb = O[0].map((_, j) => O.reduce((x, row) => x + row[j], 0))
  let num = 0
  let den = 0
  for (let i = 0; i < k; i++)
    for (let j = 0; j < k; j++) {
      const w = (i - j) ** 2 / (k - 1) ** 2
      num += w * O[i][j]
      den += (w * ra[i] * cb[j]) / n
    }
  return den === 0 ? 1 : 1 - num / den
}

/** Most common level; a tie goes to the lower level, like the anchored rubric's rule. */
export function modalLevel(levels: number[]): Level {
  const counts = [0, 0, 0, 0]
  for (const l of levels) counts[l - 1]++
  let best = 0
  for (let i = 1; i < 4; i++) if (counts[i] > counts[best]) best = i
  return (best + 1) as Level
}

export interface ItemResult {
  roleplay: string
  skill: SkillId
  key: Level
  levels: Level[]
  modal: Level
  unanimous: boolean
}

export interface SkillSummary {
  skill: SkillId
  exact: number
  unanimous: number
  items: number
  bias: number
}

export interface RubricSummary {
  rubric: RubricId
  runsPerRolePlay: number
  scores: number
  exact: number
  withinOne: number
  kappa: number
  bias: number
  items: number
  unanimous: number
  learners: number
  certFlips: number
  learnerRuns: number
  certWrong: number
  falseCert: number
  missedCert: number
  quotes: Record<QuoteStatus, number>
  bySkill: SkillSummary[]
}

export interface LearnerRubric {
  levels: Record<SkillId, Level[]>
  modal: Record<SkillId, Level>
  certs: boolean[]
}

export type SetId = 'tuning' | 'holdout'
export const SETS: SetId[] = ['tuning', 'holdout']

export interface Results {
  model: string
  firstRun: string
  lastRun: string
  calls: number
  /** summaries[set][rubric]. "tuning" is the 12 role-plays the rubrics were written against; "holdout" the 4 written after. */
  summaries: Record<SetId, Record<RubricId, RubricSummary>>
  learners: Record<string, Record<RubricId, LearnerRubric>>
  featured: string
}

const round = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d

export function learnerResult(rp: RolePlay, runs: RunRecord[], rubric: RubricId): LearnerRubric {
  const recs = runs.filter((r) => r.roleplay === rp.id && r.rubric === rubric).sort((a, b) => a.run - b.run)
  if (recs.length === 0) throw new Error(`no runs for ${rp.id} ${rubric}`)
  const lr: LearnerRubric = { levels: {} as LearnerRubric['levels'], modal: {} as LearnerRubric['modal'], certs: [] }
  for (const s of SKILLS) {
    lr.levels[s] = recs.map((r) => r.grades.find((g) => g.skill === s)!.level)
    lr.modal[s] = modalLevel(lr.levels[s])
  }
  lr.certs = recs.map((r) => certifies(Object.fromEntries(r.grades.map((g) => [g.skill, g.level])) as Record<SkillId, number>))
  return lr
}

export function summarizeRubric(roleplays: RolePlay[], runs: RunRecord[], rubric: RubricId): RubricSummary {
  const items: ItemResult[] = []
  const keyFlat: number[] = []
  const runFlat: number[] = []
  let biasSum = 0
  let certFlips = 0
  let learnerRuns = 0
  let falseCert = 0
  let missedCert = 0
  let runsPerRolePlay = 0
  const quotes: Record<QuoteStatus, number> = { agent: 0, customer: 0, missing: 0 }

  for (const rp of roleplays) {
    const recs = runs.filter((r) => r.roleplay === rp.id && r.rubric === rubric)
    if (runsPerRolePlay && recs.length !== runsPerRolePlay) throw new Error(`uneven runs for ${rp.id} ${rubric}`)
    runsPerRolePlay = recs.length
    const lr = learnerResult(rp, runs, rubric)
    for (const s of SKILLS) {
      const levels = lr.levels[s]
      items.push({ roleplay: rp.id, skill: s, key: rp.key[s], levels, modal: lr.modal[s], unanimous: levels.every((l) => l === levels[0]) })
      for (const l of levels) {
        keyFlat.push(rp.key[s])
        runFlat.push(l)
        biasSum += l - rp.key[s]
      }
    }
    const keyCert = certifies(rp.key)
    for (const c of lr.certs) {
      learnerRuns++
      if (c && !keyCert) falseCert++
      if (!c && keyCert) missedCert++
    }
    for (const r of recs) for (const g of r.grades) for (const q of g.evidence) quotes[checkQuote(q, rp).status]++
    if (!lr.certs.every((c) => c === lr.certs[0])) certFlips++
  }

  const n = keyFlat.length
  return {
    rubric,
    runsPerRolePlay,
    scores: n,
    exact: keyFlat.filter((k, i) => k === runFlat[i]).length,
    withinOne: keyFlat.filter((k, i) => Math.abs(k - runFlat[i]) <= 1).length,
    kappa: round(weightedKappa(keyFlat, runFlat)),
    bias: round(biasSum / n, 2),
    items: items.length,
    unanimous: items.filter((i) => i.unanimous).length,
    learners: roleplays.length,
    certFlips,
    learnerRuns,
    certWrong: falseCert + missedCert,
    falseCert,
    missedCert,
    quotes,
    bySkill: SKILLS.map((s) => {
      const its = items.filter((i) => i.skill === s)
      const pairs = its.flatMap((i) => i.levels.map((l) => [i.key, l]))
      return {
        skill: s,
        exact: pairs.filter(([k, l]) => k === l).length,
        unanimous: its.filter((i) => i.unanimous).length,
        items: its.length,
        bias: round(pairs.reduce((x, [k, l]) => x + l - k, 0) / pairs.length, 2),
      }
    }),
  }
}

export function summarize(roleplays: RolePlay[], runs: RunRecord[]): Results {
  const learners: Results['learners'] = {}
  for (const rp of roleplays) {
    learners[rp.id] = {} as Record<RubricId, LearnerRubric>
    for (const rubric of RUBRICS) learners[rp.id][rubric] = learnerResult(rp, runs, rubric)
  }
  const sets: Record<SetId, RolePlay[]> = {
    tuning: roleplays.filter((r) => !r.holdout),
    holdout: roleplays.filter((r) => r.holdout),
  }
  const summaries = {} as Results['summaries']
  for (const set of SETS) {
    summaries[set] = {} as Record<RubricId, RubricSummary>
    for (const rubric of RUBRICS) summaries[set][rubric] = summarizeRubric(sets[set], runs, rubric)
  }
  const times = runs.map((r) => r.startedAt).sort()
  return {
    model: [...new Set(runs.map((r) => r.model))].join(', '),
    firstRun: times[0],
    lastRun: times[times.length - 1],
    calls: runs.length,
    summaries,
    learners,
    featured: pickFeatured(roleplays, learners),
  }
}

/**
 * The first screen shows one role-play from the tuning set. Rule: the one where the draft rubric's
 * certification call disagrees with the key in the most runs, among those where the anchored and
 * revised rubrics' majority call matches the key. A split call (runs disagree) breaks ties, then file order.
 */
export function pickFeatured(roleplays: RolePlay[], learners: Results['learners']): string {
  let best = ''
  let bestScore = 0
  for (const rp of roleplays.filter((r) => !r.holdout)) {
    const keyCert = certifies(rp.key)
    const l = learners[rp.id]
    const majorityRight = (c: boolean[]) => c.filter((x) => x === keyCert).length * 2 > c.length
    if (!majorityRight(l.anchored.certs) || !majorityRight(l.revised.certs)) continue
    const wrong = l.draft.certs.filter((c) => c !== keyCert).length
    const split = l.draft.certs.some((c) => c !== l.draft.certs[0]) ? 0.5 : 0
    if (wrong + split > bestScore) {
      best = rp.id
      bestScore = wrong + split
    }
  }
  return best || roleplays[0].id
}
