import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import roleplayFile from '../../data/roleplays.json'
import rubricFile from '../../data/rubrics.json'
import runsFile from '../../data/runs.json'
import resultsFile from '../../data/results.json'
import { certifies, modalLevel, pickFeatured, summarize, weightedKappa, type Results } from './metrics'
import { gradePrompt, rubricText } from './prompt'
import { checkQuote } from './quotes'
import type { RolePlay, RolePlayFile, RubricFile, RunRecord } from './types'
import { RUBRICS, SKILLS } from './types'
import { coachNote, noteLines, verdict } from './view'

const RP = roleplayFile as unknown as RolePlayFile
const RB = rubricFile as unknown as RubricFile
const RUNS = runsFile as unknown as RunRecord[]
const RESULTS = resultsFile as unknown as Results
const ROOT = join(__dirname, '../..')

describe('weightedKappa', () => {
  it('is 1 for perfect agreement', () => {
    expect(weightedKappa([1, 2, 3, 4], [1, 2, 3, 4])).toBe(1)
  })
  it('matches a hand-worked value', () => {
    // a = [1,2,3,4,4], b = [1,2,4,4,3]. Two pairs one level apart, weight 1/9 each: observed 2/9.
    // Both marginals are [1,1,1,2]; the weighted expected disagreement works out to 68/45.
    expect(weightedKappa([1, 2, 3, 4, 4], [1, 2, 4, 4, 3])).toBeCloseTo(1 - (2 / 9) / (68 / 45), 10)
  })
  it('is 0 or below when ratings ignore each other', () => {
    expect(weightedKappa([1, 1, 4, 4], [1, 4, 1, 4])).toBeCloseTo(0, 10)
  })
})

describe('modalLevel and certifies', () => {
  it('breaks ties toward the lower level', () => {
    expect(modalLevel([2, 3, 3, 2])).toBe(2)
    expect(modalLevel([4, 4, 3])).toBe(4)
  })
  it('certifies only when every skill is 3 or higher', () => {
    expect(certifies({ empathy: 3, listening: 3, ownership: 3, resolution: 3, close: 3 })).toBe(true)
    expect(certifies({ empathy: 4, listening: 4, ownership: 2, resolution: 4, close: 4 })).toBe(false)
  })
})

describe('checkQuote', () => {
  const rp = RP.roleplays.find((r) => r.id === 'A3')!
  it('finds an exact quote in the learner lines', () => {
    expect(checkQuote('I understand your frustration.', rp)).toMatchObject({ status: 'agent', line: 4 })
  })
  it('accepts ellipses between real pieces and curly quotes', () => {
    expect(checkQuote('I’m going to refund…right now', rp).status).toBe('agent')
  })
  it('flags customer words and paraphrases', () => {
    expect(checkQuote('My rent comes out Friday', rp).status).toBe('customer')
    expect(checkQuote('I will refund it immediately', rp).status).toBe('missing')
  })
})

describe('data', () => {
  it('every role-play has a key and a note for each skill, and notes point at real lines', () => {
    for (const r of RP.roleplays) {
      for (const s of SKILLS) {
        expect([1, 2, 3, 4]).toContain(r.key[s])
        for (const n of noteLines(r.keyNotes[s])) expect(n).toBeLessThanOrEqual(r.lines.length)
      }
    }
  })
  it('has 5 runs per role-play per rubric, and runs.json equals the files in data/runs', () => {
    const files: RunRecord[] = []
    for (const rb of RUBRICS)
      for (const f of readdirSync(join(ROOT, 'data/runs', rb)).sort())
        files.push(JSON.parse(readFileSync(join(ROOT, 'data/runs', rb, f), 'utf8')))
    expect(files.length).toBe(RP.roleplays.length * RUBRICS.length * 5)
    const key = (r: RunRecord) => `${r.rubric}/${r.roleplay}/${r.run}`
    const byKey = new Map(files.map((r) => [key(r), r]))
    expect(RUNS.length).toBe(files.length)
    for (const r of RUNS) expect(r).toEqual(byKey.get(key(r)))
  })
  it('every recorded run used the prompt the code builds today', async () => {
    const { createHash } = await import('node:crypto')
    const { SYSTEM_PROMPT } = await import('./prompt')
    for (const r of RUNS) {
      const rp = RP.roleplays.find((x) => x.id === r.roleplay)!
      const sc = RP.scenarios.find((s) => s.id === rp.scenario)!
      const rubric = RB.rubrics.find((x) => x.id === r.rubric)!
      const sha = createHash('sha256').update(SYSTEM_PROMPT + '\n\n' + gradePrompt(rp, sc, rubric, RB)).digest('hex')
      expect(sha, `${r.rubric} ${r.roleplay} r${r.run}`).toBe(r.promptSha256)
    }
  })
  it('the three rubrics differ only in rubric text', () => {
    const rp = RP.roleplays[0]
    const sc = RP.scenarios[0]
    const prompts = RB.rubrics.map((r) => gradePrompt(rp, sc, r, RB).replace(rubricText(r, RB), '<RUBRIC>'))
    expect(new Set(prompts).size).toBe(1)
  })
})

describe('results.json', () => {
  it('is exactly what summarize() computes from the runs', () => {
    expect(summarize(RP.roleplays, RUNS)).toEqual(RESULTS)
  })
  it('features the learner the documented rule picks', () => {
    expect(RESULTS.featured).toBe(pickFeatured(RP.roleplays, RESULTS.learners))
  })
})

describe('page sentences', () => {
  const name = (s: string) => RB.skills.find((k) => k.id === s)!.name
  it('verdict counts certifications and matches from the runs', () => {
    const rp = RP.roleplays.find((r) => r.id === RESULTS.featured) as RolePlay
    const lr = RESULTS.learners[rp.id].draft
    const v = verdict(rp, lr, name as never)
    const yes = lr.certs.filter(Boolean).length
    if (yes === 0) expect(v.head).toContain('fails certification in all 5 runs')
    const matches = SKILLS.reduce((x, s) => x + lr.levels[s].filter((l) => l === rp.key[s]).length, 0)
    expect(v.sub).toContain(`match the key on ${matches} of 25 scores`)
  })
  it('coach note picks a skill at 3+ for Did well and the lowest skill for Do differently', () => {
    for (const rp of RP.roleplays) {
      const n = coachNote(RESULTS.learners[rp.id].anchored)
      if (n.doneWell) expect(n.doneWell.level).toBeGreaterThanOrEqual(3)
      if (n.doDifferently) {
        const min = Math.min(...SKILLS.map((s) => RESULTS.learners[rp.id].anchored.modal[s]))
        expect(n.doDifferently.level).toBe(min)
      }
    }
  })
})

describe('copy rules', () => {
  it('no em or en dashes in data or page source', () => {
    const files = ['data/roleplays.json', 'data/rubrics.json', 'src/App.tsx', 'src/Results.tsx', 'src/RubricDiff.tsx', 'src/lib/view.ts', 'index.html', 'README.md']
    for (const f of files) {
      const text = readFileSync(join(ROOT, f), 'utf8')
      expect(/[–—]/.test(text), f).toBe(false)
    }
  })
})
