import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { REPO, RESULTS, RP, rolePlay, rubric, runsFor, scenarioOf, skillName } from './data'
import { certifies } from './lib/metrics'
import { checkQuote, normalize, quotePieces } from './lib/quotes'
import type { Level, RolePlay, RubricId, SkillId } from './lib/types'
import { RUBRICS, SKILLS } from './lib/types'
import { coachNote, levelName, noteLines, verdict } from './lib/view'
import { Results } from './Results'
import { RubricDiff } from './RubricDiff'

type Col = 'key' | 'you' | number
interface Sel {
  col: Col
  skill: SkillId
}

const ANCHORED = rubric('anchored')
const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function firstDisagreement(rp: RolePlay, rb: RubricId): Sel {
  const lr = RESULTS.learners[rp.id][rb]
  for (const s of SKILLS) {
    const i = lr.levels[s].findIndex((l) => l !== rp.key[s])
    if (i >= 0) return { col: i, skill: s }
  }
  return { col: 0, skill: 'empathy' }
}

export function App() {
  const [rb, setRb] = useState<RubricId>('draft')
  const [lid, setLid] = useState(RESULTS.featured)
  const rp = rolePlay(lid)
  const [sel, setSel] = useState<Sel>(() => firstDisagreement(rolePlay(RESULTS.featured), 'draft'))
  const [mode, setMode] = useState<'view' | 'self' | 'revealed'>('view')
  const [mine, setMine] = useState<Partial<Record<SkillId, Level>>>({})
  const [flipGen, setFlipGen] = useState(0)

  // Switching the rubric keeps the same cell selected, so the score visibly changes under it.
  const pickRubric = (id: RubricId) => {
    if (id === rb) return
    setRb(id)
    setFlipGen((g) => g + 1)
  }
  const pickLearner = (id: string) => {
    setLid(id)
    setSel(firstDisagreement(rolePlay(id), rb))
    setMode('view')
    setMine({})
  }

  return (
    <>
      <div className="wrap">
        <header className="topline">
          <div className="wordmark">
            Rubric Lab <span>for e2G's AI bot rubric project</span>
          </div>
          <nav aria-label="Page">
            <a href="#results">Results</a>
            <a href="#rubric">The rubric</a>
            <a href="#method">How it was made</a>
            <a href={REPO}>Code</a>
          </nav>
        </header>

        <section className="hero" aria-labelledby="title">
          <h1 id="title">Same call, graded five times.</h1>
          <p className="lede">
            An AI grader scored each role-play call on five skills, five times over, under three versions of a rubric.
            Switch the rubric and tap any score to see the quote behind it.
          </p>
        </section>

        <div className="bench">
          <div className="main">
            <div className="controls">
              <div>
                <div className="seg" role="group" aria-label="Rubric">
                  {RUBRICS.map((id) => (
                    <button key={id} aria-pressed={rb === id} onClick={() => pickRubric(id)}>
                      {rubric(id).name.replace(' rubric', '')}
                    </button>
                  ))}
                </div>
                <p className="rb-short">{rubric(rb).short}</p>
              </div>
            </div>

            {mode === 'self' ? (
              <SelfScore
                rp={rp}
                mine={mine}
                setMine={setMine}
                onReveal={() => {
                  setMode('revealed')
                  setSel({ col: 'you', skill: 'empathy' })
                }}
                onCancel={() => setMode('view')}
              />
            ) : (
              <>
                <Verdict rp={rp} rb={rb} />
                <Board rp={rp} rb={rb} sel={sel} setSel={setSel} flipGen={flipGen} mine={mode === 'revealed' ? mine : null} />
                <Legend rb={rb} />
                <Detail rp={rp} rb={rb} sel={sel} mine={mine} />
                {mode === 'view' && (
                  <div className="try">
                    <button className="btn" onClick={() => setMode('self')}>
                      Grade {rp.learner} yourself first
                    </button>
                  </div>
                )}
                <Coach rp={rp} rb={rb} />
              </>
            )}
            <Picker lid={lid} rb={rb} onPick={pickLearner} />
          </div>

          <aside className="side" aria-label="Transcript" id="transcript">
            <Transcript rp={rp} rb={rb} sel={sel} hideScores={mode === 'self'} />
          </aside>
        </div>
      </div>

      <Results />
      <RubricDiff />
      <Method />

      <footer>
        <div className="wrap">
          <p>
            Built by Abdallah Safi for SwitchGear and elevate2Great's Riipen Level UP project, "AI Bot Rubric
            Development for Skill Evaluation". Not made or endorsed by SwitchGear or elevate2Great.
          </p>
          <p>
            Every role-play is synthetic and every customer is made up. The grades are real recorded runs of{' '}
            {RESULTS.model}. <a href={REPO}>Code and raw runs on GitHub</a>.
          </p>
        </div>
      </footer>
    </>
  )
}

function Picker({ lid, rb, onPick }: { lid: string; rb: RubricId; onPick: (id: string) => void }) {
  return (
    <div>
      <p className="control-label" id="pick-label">
        Try another learner{' '}
        <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>(filled dots: runs that certified them)</span>
      </p>
      <div className="picker" role="group" aria-labelledby="pick-label">
        {RP.scenarios.map((sc) => (
          <div className="picker-row" key={sc.id}>
            <span className="scn">
              {sc.title}
              {sc.id === 'C' ? ' (new)' : ''}
            </span>
            {RP.roleplays
              .filter((r) => r.scenario === sc.id)
              .map((r) => {
                const certs = RESULTS.learners[r.id][rb].certs
                const yes = certs.filter(Boolean).length
                return (
                  <button
                    key={r.id}
                    className="chip"
                    aria-pressed={lid === r.id}
                    onClick={() => onPick(r.id)}
                    aria-label={`${r.learner}, ${sc.title}. Certified in ${yes} of ${certs.length} runs under the ${rubric(rb).name.toLowerCase()}.`}
                  >
                    <span className="nm">{r.learner}</span>
                    <span className="pips" aria-hidden="true">
                      {certs.map((c, i) => (
                        <i key={i} className={`pip${c ? ' on' : ''}`} />
                      ))}
                    </span>
                  </button>
                )
              })}
          </div>
        ))}
      </div>
    </div>
  )
}

function Board({
  rp,
  rb,
  sel,
  setSel,
  flipGen,
  mine,
}: {
  rp: RolePlay
  rb: RubricId
  sel: Sel
  setSel: (s: Sel) => void
  flipGen: number
  mine: Partial<Record<SkillId, Level>> | null
}) {
  const runs = runsFor(rp.id, rb)
  const R = rubric(rb)
  const lr = RESULTS.learners[rp.id][rb]
  const keyCert = certifies(rp.key)
  const mineCert = mine && SKILLS.every((s) => mine[s]) ? certifies(mine as Record<SkillId, Level>) : null
  const isSel = (col: Col, s: SkillId) => sel.col === col && sel.skill === s
  return (
    <table className={`board${mine ? ' has-you' : ''}`}>
      <caption className="sr-only">
        {rp.learner}'s scores: the key, then {runs.length} runs of the {R.name.toLowerCase()}
      </caption>
      <thead>
        <tr>
          <th className="rowh" scope="col">
            <span className="sr-only">Skill</span>
          </th>
          {mine && <th scope="col">You</th>}
          <th scope="col" className="keyh">
            Key
          </th>
          {runs.map((r) => (
            <th scope="col" key={r.run}>
              <span className="hide-sm">Run </span>
              {r.run}
            </th>
          ))}
          <th scope="col" className="agree">
            <span className="sr-only">Runs agree?</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {SKILLS.map((s) => {
          const levels = lr.levels[s]
          const counts = [1, 2, 3, 4].map((l) => levels.filter((x) => x === l).length).filter(Boolean).sort((a, b) => b - a)
          const unanimous = counts.length === 1
          return (
            <tr key={s}>
              <th scope="row" className="rowh">
                {skillName(s)}
              </th>
              {mine && (
                <td>
                  <button
                    className={`tile l${mine[s]}`}
                    aria-pressed={isSel('you', s)}
                    onClick={() => setSel({ col: 'you', skill: s })}
                    aria-label={`You, ${skillName(s)}: ${mine[s]}`}
                  >
                    {mine[s]}
                  </button>
                </td>
              )}
              <td>
                <button
                  className={`tile key l${rp.key[s]}`}
                  aria-pressed={isSel('key', s)}
                  onClick={() => setSel({ col: 'key', skill: s })}
                  aria-label={`Key, ${skillName(s)}: ${rp.key[s]} ${levelName(ANCHORED, rp.key[s])}`}
                >
                  {rp.key[s]}
                </button>
              </td>
              {levels.map((l, i) => (
                <td key={`${i}-${rb}-${flipGen}`}>
                  <button
                    className={`tile l${l}${flipGen && !reduced ? ' flip' : ''}`}
                    style={{ animationDelay: `${i * 45}ms` }}
                    aria-pressed={isSel(i, s)}
                    onClick={() => setSel({ col: i, skill: s })}
                    aria-label={`Run ${i + 1}, ${skillName(s)}: ${l} ${levelName(R, l)}${l === rp.key[s] ? ', matches the key' : ', differs from the key'}`}
                  >
                    {l}
                    {l !== rp.key[s] && <span className="off" aria-hidden="true" />}
                  </button>
                </td>
              ))}
              <td className={`agree${unanimous ? '' : ' split'}`}>{unanimous ? 'agree' : `split ${counts.join('/')}`}</td>
            </tr>
          )
        })}
        <tr className="cert-row">
          <th scope="row" className="rowh">
            Certified?
          </th>
          {mine && <td>{mineCert === null ? null : <div className={`cert${mineCert ? ' yes' : ''}`}>{mineCert ? 'Yes' : 'No'}</div>}</td>}
          <td>
            <div className={`cert keyc${keyCert ? ' yes' : ''}`}>{keyCert ? 'Yes' : 'No'}</div>
          </td>
          {lr.certs.map((c, i) => (
            <td key={i}>
              <div className={`cert${c ? ' yes' : ''}`}>{c ? 'Yes' : 'No'}</div>
            </td>
          ))}
          <td className="agree" />
        </tr>
      </tbody>
    </table>
  )
}

function Legend({ rb }: { rb: RubricId }) {
  const R = rubric(rb)
  return (
    <div className="legend" aria-label="Levels">
      {[1, 2].map((l) => (
        <span key={l}>
          <i className="sw" style={{ background: `var(--l${l})` }} />
          {l} {R.levels[l - 1]}
        </span>
      ))}
      <span className="line-l">
        <i className="line" /> certification line
      </span>
      {[3, 4].map((l) => (
        <span key={l}>
          <i className="sw" style={{ background: `var(--l${l})` }} />
          {l} {R.levels[l - 1]}
        </span>
      ))}
      <span>
        <i className="sw" style={{ background: 'transparent', boxShadow: 'inset 0 0 0 2px var(--ink)', borderRadius: 3 }} />
        key
      </span>
      <span>
        <i className="sw" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-2)', verticalAlign: 1 }} />
        differs from the key
      </span>
    </div>
  )
}

function Verdict({ rp, rb }: { rp: RolePlay; rb: RubricId }) {
  const v = verdict(rp, RESULTS.learners[rp.id][rb], skillName)
  return (
    <div aria-live="polite" className="verdict-wrap">
      <p className="verdict">{v.head}</p>
      <p className="subverdict">{v.sub}</p>
    </div>
  )
}

function Coach({ rp, rb }: { rp: RolePlay; rb: RubricId }) {
  const R = rubric(rb)
  if (rb === 'draft')
    return (
      <div className="coach">
        <div style={{ gridColumn: '1 / -1' }}>
          <h3>Coaching note</h3>
          <p>
            The draft rubric only says Poor, Fair, Good or Excellent, so the grader can't tell {rp.learner} what the next
            level sounds like. Switch to the anchored rubric to see one Did Well and one Do Differently.
          </p>
        </div>
      </div>
    )
  const lr = RESULTS.learners[rp.id][rb]
  const note = coachNote(lr)
  const runs = runsFor(rp.id, rb)
  const quoteFor = (s: SkillId, level: Level) => {
    for (const r of runs) {
      const g = r.grades.find((x) => x.skill === s)!
      if (g.level !== level) continue
      const q = g.evidence.find((e) => checkQuote(e, rp).status === 'agent')
      if (q) return q
    }
    return null
  }
  return (
    <div className="coach" aria-label="Coaching note from the settled scores">
      <div>
        <h3>Did well</h3>
        {note.doneWell ? (
          <>
            <p className="sk">
              {skillName(note.doneWell.skill)}, {levelName(R, note.doneWell.level)}
            </p>
            {quoteFor(note.doneWell.skill, note.doneWell.level) && (
              <p>
                <q>{quoteFor(note.doneWell.skill, note.doneWell.level)}</q>
              </p>
            )}
          </>
        ) : (
          <p>No skill reached Proficient yet.</p>
        )}
      </div>
      <div>
        <h3>Do differently</h3>
        {note.doDifferently ? (
          <>
            <p className="sk">
              {skillName(note.doDifferently.skill)}: to reach {levelName(R, note.doDifferently.target)}
            </p>
            <p>{R.criteria[note.doDifferently.skill].anchors![note.doDifferently.target - 1]}</p>
          </>
        ) : (
          <p>Every skill is at Advanced.</p>
        )}
      </div>
    </div>
  )
}

function SelfScore({
  rp,
  mine,
  setMine,
  onReveal,
  onCancel,
}: {
  rp: RolePlay
  mine: Partial<Record<SkillId, Level>>
  setMine: (m: Partial<Record<SkillId, Level>>) => void
  onReveal: () => void
  onCancel: () => void
}) {
  const done = SKILLS.every((s) => mine[s])
  return (
    <div className="selfscore">
      <p className="verdict" style={{ marginTop: 0 }}>
        Read {rp.learner}'s call, then score it.
      </p>
      <p className="subverdict">
        Levels from the anchored rubric. The key and the runs stay hidden until you reveal them.{' '}
        <a href="#transcript" className="hide-lg">
          Read the call
        </a>
      </p>
      <div className="self-rows">
        {SKILLS.map((s) => (
          <fieldset key={s} className="self-row">
            <legend>
              <b>{skillName(s)}</b> <span>{ANCHORED.criteria[s].question}</span>
            </legend>
            <div className="self-opts">
              {[1, 2, 3, 4].map((l) => (
                <button
                  key={l}
                  className={`opt${mine[s] === l ? ` on l${l}` : ''}`}
                  aria-pressed={mine[s] === l}
                  onClick={() => setMine({ ...mine, [s]: l as Level })}
                >
                  <b>{l}</b> {ANCHORED.levels[l - 1]}
                </button>
              ))}
            </div>
            {mine[s] && <p className="self-anchor">{ANCHORED.criteria[s].anchors![mine[s]! - 1]}</p>}
          </fieldset>
        ))}
      </div>
      <div className="try">
        <button className="btn solid" disabled={!done} onClick={onReveal}>
          Reveal the key and the runs
        </button>
        <button className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function Detail({
  rp,
  rb,
  sel,
  mine,
}: {
  rp: RolePlay
  rb: RubricId
  sel: Sel
  mine: Partial<Record<SkillId, Level>>
}) {
  const R = rubric(rb)
  const key = rp.key[sel.skill]
  if (sel.col === 'key' || sel.col === 'you') {
    const lvl = sel.col === 'key' ? key : mine[sel.skill]!
    return (
      <div className="detail">
        <p className="who">{sel.col === 'key' ? 'Answer key' : 'Your score'}</p>
        <h2>
          {skillName(sel.skill)}: {lvl} {levelName(ANCHORED, lvl)}
        </h2>
        <p className="reason">{sel.col === 'key' ? rp.keyNotes[sel.skill] : `The key says ${key} ${levelName(ANCHORED, key)}. ${rp.keyNotes[sel.skill]}`}</p>
        <p className="anchor">
          <b>Level {lvl} in the anchored rubric:</b> {ANCHORED.criteria[sel.skill].anchors![lvl - 1]}
        </p>
      </div>
    )
  }
  const run = runsFor(rp.id, rb)[sel.col]
  const g = run.grades.find((x) => x.skill === sel.skill)!
  const diff = g.level - key
  const cmp = diff === 0 ? 'Matches the key.' : `The key says ${key} ${levelName(ANCHORED, key)}, ${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'level' : 'levels'} ${diff > 0 ? 'lower' : 'higher'}.`
  return (
    <div className="detail" aria-live="polite">
      <p className="who">
        {R.name}, run {run.run}
      </p>
      <h2>
        {skillName(sel.skill)}: {g.level} {levelName(R, g.level)}
      </h2>
      <p className="reason">{g.reason}</p>
      <ul className="quotes" aria-label="Evidence the grader quoted">
        {g.evidence.map((q, i) => {
          const c = checkQuote(q, rp)
          const bad = c.status !== 'agent'
          return (
            <li key={i}>
              <span className={`qt${bad ? ' bad' : ''}`}>{q}</span>
              <span className={`st${bad ? ' bad' : ''}`}>
                {c.status === 'agent' ? `Word for word, line ${c.line + 1}` : c.status === 'customer' ? "The customer's words, not the learner's" : 'Not in the transcript'}
              </span>
            </li>
          )
        })}
        {g.evidence.length === 0 && <li className="st">No quote given.</li>}
      </ul>
      <p className="anchor">
        <b>{cmp}</b> {rp.keyNotes[sel.skill]}
      </p>
    </div>
  )
}

function markLine(text: string, pieces: string[]): ReactNode[] {
  const low = text.toLowerCase()
  const spans: [number, number][] = []
  for (const p of pieces) {
    const i = low.indexOf(p)
    if (i >= 0) spans.push([i, i + p.length])
  }
  if (!spans.length) return [text]
  spans.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const s of spans) {
    const last = merged[merged.length - 1]
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1])
    else merged.push([...s])
  }
  const out: ReactNode[] = []
  let at = 0
  merged.forEach(([a, b], k) => {
    if (a > at) out.push(text.slice(at, a))
    out.push(<mark key={k}>{text.slice(a, b)}</mark>)
    at = b
  })
  if (at < text.length) out.push(text.slice(at))
  return out
}

function Transcript({ rp, rb, sel, hideScores }: { rp: RolePlay; rb: RubricId; sel: Sel; hideScores: boolean }) {
  const sc = scenarioOf(rp)
  const listRef = useRef<HTMLOListElement>(null)
  const { pieces, hitLines } = useMemo(() => {
    if (hideScores) return { pieces: [] as string[], hitLines: new Set<number>() }
    if (sel.col === 'key' || sel.col === 'you')
      return { pieces: [] as string[], hitLines: new Set(noteLines(rp.keyNotes[sel.skill]).map((n) => n - 1)) }
    const g = runsFor(rp.id, rb)[sel.col].grades.find((x) => x.skill === sel.skill)!
    const ps = g.evidence.flatMap(quotePieces)
    const lines = new Set<number>()
    rp.lines.forEach(([, t], i) => {
      if (ps.some((p) => normalize(t).includes(p))) lines.add(i)
    })
    return { pieces: ps, hitLines: lines }
  }, [rp, rb, sel, hideScores])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const first = Math.min(...hitLines)
    const el = Number.isFinite(first) ? (list.children[first] as HTMLElement | undefined) : undefined
    if (el) list.scrollTo({ top: Math.max(0, el.offsetTop - list.offsetTop - 40), behavior: reduced ? 'auto' : 'smooth' })
  }, [hitLines])

  return (
    <div className="transcript">
      <h3>
        {sc.title}: {rp.learner}'s call (synthetic)
      </h3>
      <details className="scn-brief">
        <summary>The scenario the grader was given</summary>
        <p>{sc.brief}</p>
      </details>
      <ol className="lines" ref={listRef} aria-label="Transcript">
        {rp.lines.map(([who, text], i) => (
          <li key={i} className={`${who === 'agent' ? 'agent' : 'cust'}${hitLines.has(i) ? ' hit' : ''}`}>
            <span className="n">{i + 1}</span>
            <span>
              <span className="sp">{who === 'agent' ? rp.learner : sc.customer}</span>
              {who === 'agent' && pieces.length ? markLine(text, pieces) : text}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Method() {
  const s = RESULTS.summaries
  const days = new Set([RESULTS.firstRun.slice(0, 10), RESULTS.lastRun.slice(0, 10)])
  return (
    <section className="block" id="method" aria-labelledby="method-h">
      <div className="wrap">
        <h2 id="method-h">How it was made</h2>
        <div className="method">
          <div>
            <h3>What's real</h3>
            <ul>
              <li>
                Every grade on this page is a recorded run of {RESULTS.model}, through the Claude Code CLI (
                <code>claude -p</code>): {RESULTS.calls} calls on {[...days].join(' and ')}, each in a fresh session with
                no tools, answering to a fixed JSON format.
              </li>
              <li>
                Each call gets the scenario, one rubric and the transcript. Only the rubric changes between the three
                versions.
              </li>
              <li>
                Every number is computed by code from those runs (<code>npm run eval</code>). Quotes are checked word for
                word against the learner's lines by code too.
              </li>
              <li>
                Under the draft rubric the grader scored {s.tuning.draft.bias < 0 ? 'below' : 'above'} the key on
                average ({s.tuning.draft.bias > 0 ? '+' : ''}
                {s.tuning.draft.bias} levels). It held learners to a bar of its own.
              </li>
            </ul>
          </div>
          <div>
            <h3>What isn't</h3>
            <ul>
              <li>
                All {RP.roleplays.length} role-plays are synthetic, written for this demo. Each was written to show a
                set level on each skill, and that level is the key. A real key would come from your coaches.
              </li>
              <li>
                The anchors and the key were written from the same standard, so the match on the first 12 is a best
                case. The four "Price jump" calls were written after the revised rubric was final, to check it on calls
                it wasn't tuned on.
              </li>
              <li>The runs agreeing with each other doesn't depend on the key at all.</li>
              <li>
                {RP.roleplays.length} calls and 5 runs each is a small sample. It shows where a rubric drifts, not how
                often it would on your platform.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
