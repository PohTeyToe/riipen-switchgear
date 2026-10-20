import roleplayFile from '../data/roleplays.json'
import rubricFile from '../data/rubrics.json'
import runsFile from '../data/runs.json'
import resultsFile from '../data/results.json'
import type { Results } from './lib/metrics'
import type { RolePlay, RolePlayFile, Rubric, RubricFile, RubricId, RunRecord, Scenario, SkillId } from './lib/types'

export const RP = roleplayFile as unknown as RolePlayFile
export const RB = rubricFile as unknown as RubricFile
export const RUNS = runsFile as unknown as RunRecord[]
export const RESULTS = resultsFile as unknown as Results

export const rolePlay = (id: string): RolePlay => RP.roleplays.find((r) => r.id === id)!
export const scenarioOf = (rp: RolePlay): Scenario => RP.scenarios.find((s) => s.id === rp.scenario)!
export const rubric = (id: RubricId): Rubric => RB.rubrics.find((r) => r.id === id)!
export const skillName = (id: SkillId): string => RB.skills.find((s) => s.id === id)!.name
export const runsFor = (rp: string, rubricId: RubricId): RunRecord[] =>
  RUNS.filter((r) => r.roleplay === rp && r.rubric === rubricId).sort((a, b) => a.run - b.run)

export const REPO = 'https://github.com/PohTeyToe/riipen-switchgear'
