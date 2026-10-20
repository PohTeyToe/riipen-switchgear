// Scores the recorded runs against the key. Writes data/runs.json (every run, for the page)
// and data/results.json (the numbers the page shows). Usage: npm run eval
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SETS, summarize } from '../src/lib/metrics'
import type { RolePlayFile, RunRecord } from '../src/lib/types'
import { RUBRICS } from '../src/lib/types'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const rp: RolePlayFile = JSON.parse(readFileSync(join(ROOT, 'data/roleplays.json'), 'utf8'))

export function loadRuns(): RunRecord[] {
  const runs: RunRecord[] = []
  for (const rubric of RUBRICS) {
    const dir = join(ROOT, 'data/runs', rubric)
    for (const f of readdirSync(dir).sort()) if (f.endsWith('.json')) runs.push(JSON.parse(readFileSync(join(dir, f), 'utf8')))
  }
  return runs.sort((a, b) => a.rubric.localeCompare(b.rubric) || a.roleplay.localeCompare(b.roleplay) || a.run - b.run)
}

const runs = loadRuns()
const results = summarize(rp.roleplays, runs)
writeFileSync(join(ROOT, 'data/runs.json'), JSON.stringify(runs) + '\n')
writeFileSync(join(ROOT, 'data/results.json'), JSON.stringify(results, null, 2) + '\n')

for (const set of SETS) {
  console.log(`== ${set}`)
  for (const r of RUBRICS) {
    const s = results.summaries[set][r]
    console.log(
      `${r.padEnd(9)} exact ${s.exact}/${s.scores}  within1 ${s.withinOne}/${s.scores}  kappa ${s.kappa}  bias ${s.bias}  ` +
        `unanimous ${s.unanimous}/${s.items}  certFlips ${s.certFlips}/${s.learners}  certWrong ${s.certWrong}/${s.learnerRuns} ` +
        `(false ${s.falseCert}, missed ${s.missedCert})  quotes ${JSON.stringify(s.quotes)}`,
    )
    console.log('          ' + s.bySkill.map((b) => `${b.skill} ${b.exact}/${b.items * s.runsPerRolePlay} u${b.unanimous} b${b.bias}`).join('  '))
  }
}
console.log(`featured ${results.featured}; ${results.calls} calls, ${results.model}, ${results.firstRun} to ${results.lastRun}`)
for (const id of Object.keys(results.learners)) {
  const l = results.learners[id]
  console.log(
    id.padEnd(3),
    RUBRICS.map((r) => `${r[0]} ` + Object.values(l[r].levels).map((v) => v.join('')).join(' ') + ' ' + l[r].certs.map((c) => (c ? 'C' : '.')).join('')).join(' | '),
  )
}
