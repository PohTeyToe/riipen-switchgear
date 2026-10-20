// Pure helpers behind the page's sentences, so tests can check them against the data.
import { certifies, type LearnerRubric } from './metrics'
import type { Level, RolePlay, Rubric, SkillId } from './types'
import { SKILLS } from './types'

export function levelName(rubric: Rubric, level: number): string {
  return rubric.levels[level - 1]
}

export function names(list: string[]): string {
  if (list.length <= 1) return list.join('')
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

/** "Ben fails in all 5 runs." and the line under it. */
export function verdict(
  rp: RolePlay,
  lr: LearnerRubric,
  skillName: (s: SkillId) => string,
): { head: string; sub: string } {
  const n = lr.certs.length
  const yes = lr.certs.filter(Boolean).length
  const who = rp.learner
  const head =
    yes === n
      ? `${who} gets certified in all ${n} runs.`
      : yes === 0
        ? `${who} fails certification in all ${n} runs.`
        : `${who} gets certified in ${yes} of ${n} runs.`
  const keyCert = certifies(rp.key)
  const below = SKILLS.filter((s) => rp.key[s] < 3).map(skillName)
  const keySays = keyCert
    ? 'The key certifies: every skill at 3 or above.'
    : `The key doesn't: ${names(below)} ${below.length > 1 ? 'are' : 'is'} below 3.`
  const matches = SKILLS.reduce((x, s) => x + lr.levels[s].filter((l) => l === rp.key[s]).length, 0)
  const split = SKILLS.filter((s) => lr.levels[s].some((l) => l !== lr.levels[s][0])).map(skillName)
  const splitText = split.length ? ` The runs split on ${names(split)}.` : ' The runs agree with each other on every skill.'
  return { head, sub: `${keySays} The runs match the key on ${matches} of ${n * SKILLS.length} scores.${splitText}` }
}

export interface CoachNote {
  doneWell: { skill: SkillId; level: Level } | null
  doDifferently: { skill: SkillId; level: Level; target: Level } | null
}

/** One Did Well and one Do Differently, from the settled (majority) level of each skill. */
export function coachNote(lr: LearnerRubric): CoachNote {
  let well: CoachNote['doneWell'] = null
  let diff: CoachNote['doDifferently'] = null
  for (const s of SKILLS) {
    const l = lr.modal[s]
    if (l >= 3 && (!well || l > well.level)) well = { skill: s, level: l }
    if (l < 4 && (!diff || l < diff.level)) diff = { skill: s, level: l, target: (l + 1) as Level }
  }
  return { doneWell: well, doDifferently: diff }
}

/** Line numbers a key note points at, e.g. "(3)" or "(7, 9)". 1-based. */
export function noteLines(note: string): number[] {
  const out: number[] = []
  for (const m of note.matchAll(/\((?:line )?([\d, ]+)\)/g)) for (const n of m[1].split(',')) if (n.trim()) out.push(Number(n))
  return out
}
