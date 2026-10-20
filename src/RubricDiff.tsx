import { useState } from 'react'
import { RB, RESULTS, rubric, skillName } from './data'
import type { SkillId } from './lib/types'
import { SKILLS } from './lib/types'

const DRAFT = rubric('draft')
const ANCH = rubric('anchored')
const REV = rubric('revised')

export function RubricDiff() {
  const [skill, setSkill] = useState<SkillId>('resolution')
  const t = RESULTS.summaries.tuning
  const res = (r: 'anchored' | 'revised') => t[r].bySkill.find((b) => b.skill === 'resolution')!
  const n = res('anchored').items * t.anchored.runsPerRolePlay
  const addedRule = REV.rules.find((r) => !ANCH.rules.includes(r))
  return (
    <section className="block" id="rubric" aria-labelledby="rubric-h">
      <div className="wrap">
        <h2 id="rubric-h">Anchors say what each level sounds like.</h2>
        <p className="intro">
          The draft asks one question per skill and leaves the bar to the grader. The anchored version writes the bar
          down, level by level, the way a coach would explain it to a learner. After round two, Resolution still drifted
          (the grader matched the key on {res('anchored').exact} of {n} scores), so round three reworded one anchor and
          added one rule. Then it matched on {res('revised').exact} of {n}.
        </p>
        <div className="tabs seg" role="group" aria-label="Skill">
          {SKILLS.map((s) => (
            <button key={s} aria-pressed={skill === s} onClick={() => setSkill(s)}>
              {skillName(s)}
            </button>
          ))}
        </div>
        <div className="diff">
          <div>
            <h3>Draft</h3>
            <p className="draftq">{DRAFT.criteria[skill].question}</p>
            <div className="scale">
              {DRAFT.levels.map((l, i) => (
                <span key={l}>
                  {i + 1} {l}
                </span>
              ))}
            </div>
          </div>
          <div>
            <h3>Anchored, with the round three change</h3>
            <ol className="ladder">
              {[3, 2, 1, 0].map((i) => {
                const now = REV.criteria[skill].anchors![i]
                const before = ANCH.criteria[skill].anchors![i]
                return (
                  <FragLi key={i} cut={i === 2}>
                    <li>
                      <span className={`tile l${i + 1}`} aria-hidden="true">
                        {i + 1}
                      </span>
                      <div>
                        <b>
                          {REV.levels[i]}
                          {now !== before && <span className="changed"> reworded in round three</span>}
                        </b>
                        <p>{now}</p>
                        {now !== before && <p className="before">Was: {before}</p>}
                      </div>
                    </li>
                  </FragLi>
                )
              })}
            </ol>
          </div>
        </div>
        <h3 className="rules-h">Scoring rules in the anchored rubric</h3>
        <ol className="rules">
          {REV.rules.map((r) => (
            <li key={r}>
              {r}
              {r === addedRule && <span className="changed"> added in round three</span>}
            </li>
          ))}
        </ol>
        <p className="intro" style={{ marginTop: 18 }}>
          {RB.certification} The grader never sees that rule: it only scores the skills.
        </p>
      </div>
    </section>
  )
}

function FragLi({ cut, children }: { cut: boolean; children: React.ReactNode }) {
  return (
    <>
      {children}
      {cut && (
        <li className="cutline" aria-label="Certification line">
          certification line
        </li>
      )}
    </>
  )
}
