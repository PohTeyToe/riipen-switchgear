export const SKILLS = ['empathy', 'listening', 'ownership', 'resolution', 'close'] as const
export type SkillId = (typeof SKILLS)[number]
export type Level = 1 | 2 | 3 | 4
export type RubricId = 'draft' | 'anchored' | 'revised'
export const RUBRICS: RubricId[] = ['draft', 'anchored', 'revised']

export type Speaker = 'agent' | 'customer'

export interface Scenario {
  id: string
  title: string
  customer: string
  brief: string
}

export interface RolePlay {
  id: string
  scenario: string
  learner: string
  /** Written after the revised rubric was final, to test it on calls it was not tuned on. */
  holdout?: boolean
  key: Record<SkillId, Level>
  keyNotes: Record<SkillId, string>
  lines: [Speaker, string][]
}

export interface RolePlayFile {
  note: string
  scenarios: Scenario[]
  roleplays: RolePlay[]
}

export interface Criterion {
  question: string
  anchors?: string[]
}

export interface Rubric {
  id: RubricId
  name: string
  short: string
  levels: string[]
  rules: string[]
  criteria: Record<SkillId, Criterion>
  changes?: { where: string; text: string }[]
}

export interface RubricFile {
  skills: { id: SkillId; name: string }[]
  certification: string
  rubrics: Rubric[]
}

/** One skill as the grader returned it. */
export interface SkillGrade {
  skill: SkillId
  evidence: string[]
  reason: string
  level: Level
}

/** One recorded grader call. */
export interface RunRecord {
  roleplay: string
  rubric: RubricId
  run: number
  model: string
  startedAt: string
  durationMs: number
  promptSha256: string
  grades: SkillGrade[]
}
