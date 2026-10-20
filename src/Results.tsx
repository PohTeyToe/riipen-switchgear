import { Fragment, useState } from 'react'
import { RESULTS, RP, rubric, skillName } from './data'
import { certifies, type RubricSummary, type SetId } from './lib/metrics'
import { RUBRICS } from './lib/types'

const pct = (a: number, b: number) => Math.round((100 * a) / b)

/** Landis and Koch's bands, which they called arbitrary themselves. */
export function kappaBand(k: number): string {
  if (k > 0.8) return 'almost perfect'
  if (k > 0.6) return 'substantial'
  if (k > 0.4) return 'moderate'
  if (k > 0.2) return 'fair'
  return 'slight'
}

interface Row {
  what: string
  note?: string
  num: (s: RubricSummary) => string
  sub: (s: RubricSummary) => string
  share?: (s: RubricSummary) => number
}

const ROWS: Row[] = [
  {
    what: 'Scores that match the key',
    num: (s) => `${pct(s.exact, s.scores)}%`,
    sub: (s) => `${s.exact} of ${s.scores}`,
    share: (s) => s.exact / s.scores,
  },
  {
    what: 'Certification calls that match the key',
    note: 'One call per learner per run',
    num: (s) => `${s.learnerRuns - s.certWrong} of ${s.learnerRuns}`,
    sub: (s) =>
      s.certWrong === 0 ? 'none wrong' : `${s.missedCert} failed who should pass, ${s.falseCert} passed who should fail`,
    share: (s) => (s.learnerRuns - s.certWrong) / s.learnerRuns,
  },
  {
    what: 'Same score in all 5 runs',
    note: 'One per learner per skill',
    num: (s) => `${s.unanimous} of ${s.items}`,
    sub: (s) => `${s.items - s.unanimous} split`,
    share: (s) => s.unanimous / s.items,
  },
  {
    what: 'Average lean against the key',
    num: (s) => `${s.bias > 0 ? '+' : ''}${s.bias.toFixed(2)}`,
    sub: (s) => (Math.abs(s.bias) < 0.05 ? 'levels, about even' : s.bias < 0 ? 'levels, harsher than the key' : 'levels, kinder than the key'),
  },
  {
    what: 'Quotes found word for word',
    note: "Checked by code against the learner's lines",
    num: (s) => {
      const t = s.quotes.agent + s.quotes.customer + s.quotes.missing
      return `${s.quotes.agent} of ${t}`
    },
    sub: (s) => (s.quotes.customer + s.quotes.missing === 0 ? 'none made up' : `${s.quotes.missing} not in the transcript`),
  },
  {
    what: 'Weighted kappa with the key',
    note: 'Quadratic weights. 1 is perfect, 0 is chance',
    num: (s) => s.kappa.toFixed(2),
    sub: (s) => kappaBand(s.kappa),
  },
]

export function Results() {
  const [set, setSet] = useState<SetId>('tuning')
  const S = RESULTS.summaries[set]
  const list = RP.roleplays.filter((r) => (set === 'holdout') === !!r.holdout)
  return (
    <section className="block" id="results" aria-labelledby="results-h">
      <div className="wrap">
        <h2 id="results-h">The draft rubric holds learners to a bar nobody wrote down.</h2>
        <p className="intro">
          Across every call, the three rubrics side by side. The draft's runs mostly agree with each other. They just agree
          on scores below the key, and that fails learners the key would certify.
        </p>
        <div className="seg" role="group" aria-label="Which calls">
          <button aria-pressed={set === 'tuning'} onClick={() => setSet('tuning')}>
            {RESULTS.summaries.tuning.draft.learners} calls it was tuned on
          </button>
          <button aria-pressed={set === 'holdout'} onClick={() => setSet('holdout')}>
            {RESULTS.summaries.holdout.draft.learners} new calls
          </button>
        </div>

        <div className="compare" style={{ marginTop: 22 }}>
          <div className="crow head" aria-hidden="true">
            <span className="what" />
            <div className="trio">
              {RUBRICS.map((r) => (
                <span key={r}>{rubric(r).name}</span>
              ))}
            </div>
          </div>
          {ROWS.map((row) => (
            <div className="crow" key={row.what}>
              <div className="what">
                {row.what}
                {row.note && <small>{row.note}</small>}
              </div>
              <div className="trio">
                {RUBRICS.map((r) => (
                  <div className="val" key={r}>
                    <span className="tag">{rubric(r).name}</span>
                    <span className="num">
                      {row.num(S[r])}
                      <small>{row.sub(S[r])}</small>
                    </span>
                    {row.share && (
                      <span className="bar" aria-hidden="true">
                        <i style={{ width: `${row.share(S[r]) * 100}%` }} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="certgrid">
          {RUBRICS.map((r) => (
            <div key={r}>
              <h3>Who gets certified: {rubric(r).name.toLowerCase()}</h3>
              <div className="cg" role="img" aria-label={`Certification by run under the ${rubric(r).name.toLowerCase()}`}>
                <span />
                {[1, 2, 3, 4, 5].map((n) => (
                  <span className="hdr" key={n}>
                    {n}
                  </span>
                ))}
                <span />
                <span className="hdr">key</span>
                {list.map((rp) => {
                  const keyCert = certifies(rp.key)
                  return (
                    <Fragment key={rp.id}>
                      <span className="nm">{rp.learner}</span>
                      {RESULTS.learners[rp.id][r].certs.map((c, i) => (
                        <span key={i} className={`d${c ? ' yes' : ''}${c !== keyCert ? ' wrong' : ''}`} />
                      ))}
                      <span />
                      <span className={`d k${keyCert ? ' yes' : ''}`} />
                    </Fragment>
                  )
                })}
              </div>
            </div>
          ))}
          <p className="cg-key">
            <i className="d yes" /> certified <i className="d" /> not certified <i className="d wrong" /> disagrees with the key
          </p>
        </div>

        <div className="drift">
          <h3>Scores that match the key, by skill</h3>
          <div className="dkey" aria-hidden="true">
            {RUBRICS.map((r) => (
              <span key={r}>
                <i className={`k-${r}`} />
                {rubric(r).name}
              </span>
            ))}
          </div>
          {S.draft.bySkill.map((b, i) => (
            <div className="drow" key={b.skill}>
              <span>{skillName(b.skill)}</span>
              <div className="dbars">
                {RUBRICS.map((r) => {
                  const x = S[r].bySkill[i]
                  const n = x.items * S[r].runsPerRolePlay
                  return (
                    <div className={`dbar ${r}`} key={r} aria-label={`${rubric(r).name}: ${x.exact} of ${n}`}>
                      <span className="bar">
                        <i style={{ width: `${(x.exact / n) * 100}%` }} />
                      </span>
                      <span>
                        {x.exact}/{n}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
