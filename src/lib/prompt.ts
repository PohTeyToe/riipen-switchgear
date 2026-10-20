import type { RolePlay, Rubric, RubricFile, Scenario } from './types'
import { SKILLS } from './types'

export const SYSTEM_PROMPT =
  'You grade role-play calls for a contact-centre soft-skills certification. A learner plays the agent. Grade the learner against the rubric you are given, and return only the JSON asked for.'

/** JSON schema the CLI enforces on the grader's answer. Evidence comes before the level on purpose. */
export const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    scores: {
      type: 'array',
      minItems: 5,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          skill: { type: 'string', enum: [...SKILLS] },
          evidence: { type: 'array', items: { type: 'string' } },
          reason: { type: 'string' },
          level: { type: 'integer', minimum: 1, maximum: 4 },
        },
        required: ['skill', 'evidence', 'reason', 'level'],
        additionalProperties: false,
      },
    },
  },
  required: ['scores'],
  additionalProperties: false,
} as const

export function rubricText(rubric: Rubric, file: RubricFile): string {
  const out: string[] = []
  if (rubric.id === 'draft') {
    out.push('Score the learner on five skills. Use a 1 to 4 scale for each:')
    out.push(rubric.levels.map((name, i) => `${i + 1} = ${name}`).join(', ') + '.')
    out.push('')
    for (const s of file.skills) out.push(`${s.name}: ${rubric.criteria[s.id].question}`)
  } else {
    out.push(
      `Score the learner on five skills. Each skill has four levels: ${rubric.levels.map((n, i) => `${i + 1} ${n}`).join(', ')}.`,
    )
    out.push('')
    out.push('Rules for every skill:')
    for (const r of rubric.rules) out.push(`- ${r}`)
    for (const s of file.skills) {
      const c = rubric.criteria[s.id]
      out.push('')
      out.push(`${s.name}: ${c.question}`)
      c.anchors!.forEach((a, i) => out.push(`${i + 1} ${rubric.levels[i]}: ${a}`))
    }
    return out.join('\n')
  }
  out.push('')
  for (const r of rubric.rules) out.push(r)
  return out.join('\n')
}

export function transcriptText(rp: RolePlay): string {
  return rp.lines
    .map(([who, text], i) => `[${i + 1}] ${who === 'agent' ? 'Agent' : 'Customer'}: ${text}`)
    .join('\n')
}

export function gradePrompt(rp: RolePlay, scenario: Scenario, rubric: Rubric, file: RubricFile): string {
  return [
    '# Scenario',
    scenario.brief,
    '',
    '# Rubric',
    rubricText(rubric, file),
    '',
    '# Transcript',
    transcriptText(rp),
    '',
    '# Your task',
    'Grade the agent (the learner) on each of the five skills, in this order: empathy, listening, ownership, resolution, close. For each skill give the evidence quotes from the agent\'s lines, a one-sentence reason, and the level from 1 to 4.',
  ].join('\n')
}
