// Records real grader runs through the Claude Code CLI (`claude -p`).
// Usage: npm run grade -- [--runs 5] [--concurrency 6] [--only A3] [--rubric draft]
// Each call is a fresh session: no tools, no settings, no MCP servers, no saved history.
// Finished runs are skipped, so the script can be stopped and restarted.
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gradePrompt, OUTPUT_SCHEMA, SYSTEM_PROMPT } from '../src/lib/prompt'
import type { RolePlayFile, RubricFile, RunRecord, SkillGrade } from '../src/lib/types'
import { SKILLS } from '../src/lib/types'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MODEL = 'claude-sonnet-5-5'
const CLAUDE = process.env.CLAUDE_BIN ?? 'claude'

const args = process.argv.slice(2)
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const RUNS = Number(opt('runs') ?? 5)
const CONCURRENCY = Number(opt('concurrency') ?? 6)
const ONLY = opt('only')
const ONLY_RUBRIC = opt('rubric')

const rp: RolePlayFile = JSON.parse(readFileSync(join(ROOT, 'data/roleplays.json'), 'utf8'))
const rb: RubricFile = JSON.parse(readFileSync(join(ROOT, 'data/rubrics.json'), 'utf8'))
const cwd = mkdtempSync(join(tmpdir(), 'rubric-lab-'))

interface Job {
  file: string
  roleplay: string
  rubric: RunRecord['rubric']
  run: number
  prompt: string
}

const jobs: Job[] = []
for (const rubric of rb.rubrics) {
  if (ONLY_RUBRIC && rubric.id !== ONLY_RUBRIC) continue
  for (const r of rp.roleplays) {
    if (ONLY && r.id !== ONLY) continue
    const scenario = rp.scenarios.find((s) => s.id === r.scenario)!
    const prompt = gradePrompt(r, scenario, rubric, rb)
    for (let run = 1; run <= RUNS; run++) {
      const file = join(ROOT, 'data/runs', rubric.id, `${r.id}-r${run}.json`)
      if (!existsSync(file)) jobs.push({ file, roleplay: r.id, rubric: rubric.id, run, prompt })
    }
  }
}

// Run 1 of everything first, then run 2, so a partial recording still covers every role-play and both rubrics.
jobs.sort((a, b) => a.run - b.run || a.roleplay.localeCompare(b.roleplay) || a.rubric.localeCompare(b.rubric))

function callClaude(prompt: string): Promise<{ out: string; ms: number }> {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const child = spawn(
      CLAUDE,
      [
        '-p',
        '--model', MODEL,
        '--system-prompt', SYSTEM_PROMPT,
        '--setting-sources', '',
        '--tools', '',
        '--strict-mcp-config',
        '--no-session-persistence',
        '--output-format', 'json',
        '--json-schema', JSON.stringify(OUTPUT_SCHEMA),
      ],
      { cwd, stdio: ['pipe', 'pipe', 'pipe'] },
    )
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve({ out, ms: Date.now() - started })
      else reject(new Error(`exit ${code}: ${err.slice(0, 400)} ${out.slice(0, 400)}`))
    })
    child.stdin.end(prompt)
  })
}

function parse(out: string): { grades: SkillGrade[]; model: string } {
  const res = JSON.parse(out)
  if (res.is_error) throw new Error(`CLI error: ${String(res.result).slice(0, 300)}`)
  const so = res.structured_output
  if (!so || !Array.isArray(so.scores)) throw new Error('no structured_output')
  const grades: SkillGrade[] = so.scores
  const order = grades.map((g) => g.skill).join(',')
  if (order !== SKILLS.join(',')) throw new Error(`skills out of order: ${order}`)
  for (const g of grades) if (![1, 2, 3, 4].includes(g.level)) throw new Error(`bad level ${g.level}`)
  const models = Object.keys(res.modelUsage ?? {})
  return { grades, model: models.join('+') || MODEL }
}

async function runJob(job: Job): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const startedAt = new Date().toISOString()
    try {
      const { out, ms } = await callClaude(job.prompt)
      const { grades, model } = parse(out)
      const rec: RunRecord = {
        roleplay: job.roleplay,
        rubric: job.rubric,
        run: job.run,
        model,
        startedAt,
        durationMs: ms,
        promptSha256: createHash('sha256').update(SYSTEM_PROMPT + '\n\n' + job.prompt).digest('hex'),
        grades,
      }
      mkdirSync(dirname(job.file), { recursive: true })
      writeFileSync(job.file, JSON.stringify(rec, null, 2) + '\n')
      console.log(`ok   ${job.rubric} ${job.roleplay} r${job.run} ${(ms / 1000).toFixed(0)}s ${grades.map((g) => g.level).join('')}`)
      return
    } catch (e) {
      console.log(`fail ${job.rubric} ${job.roleplay} r${job.run} attempt ${attempt}: ${(e as Error).message}`)
    }
  }
}

async function main() {
  console.log(`${jobs.length} runs to record, ${CONCURRENCY} at a time, model ${MODEL}`)
  let next = 0
  const worker = async () => {
    while (next < jobs.length) await runJob(jobs[next++])
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker))
  console.log('done')
}

main()
