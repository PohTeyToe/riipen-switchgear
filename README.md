# Rubric Lab

An AI grader scores contact-centre role-play calls on five skills at four levels, quoting the learner as evidence. Each call is graded five times under three versions of a rubric, so you can see where the grader disagrees with itself, where it disagrees with an answer key, and what that does to a certification decision.

Built by Abdallah Safi for SwitchGear and elevate2Great's Riipen Level UP project, "AI Bot Rubric Development for Skill Evaluation". Not made or endorsed by SwitchGear or elevate2Great.

Live: https://riipen-switchgear.vercel.app

## What's on the page

1. **The board.** One learner's call: the key, then five runs, for each of five skills (Empathy, Listening, Ownership, Resolution, Close), and the certification call for each run. Switch between the Draft, Anchored and Revised rubric and the runs change. Tap any score to see the grader's reason and quotes, with each quote checked word for word against the learner's lines and highlighted in the transcript. Tap a key score to see why the key says it.
2. **Grade it yourself.** Hides the key and the runs, lets you score the call on the anchored levels, then puts your column next to the key.
3. **Coaching note.** One Did Well and one Do Differently, taken from the settled (majority) score of each skill. The Do Differently text is the next level's anchor, so it only exists for the anchored rubrics.
4. **Results.** All three rubrics side by side, for the 12 calls the rubrics were tuned on and for 4 new calls written after the last change.
5. **The rubric.** Draft question against the anchored ladder for each skill, with the round three change marked.

The first screen opens on the learner picked by `pickFeatured()` in `src/lib/metrics.ts`: the one where the draft rubric's certification call disagrees with the key in the most runs, among those where both anchored rubrics get it right. Today that is Ben (A2).

## The three rubrics

All three get the same scenario, transcript, task and JSON format. Only the rubric text changes (a test checks this).

- **Draft.** One question per skill ("Did the learner show empathy and understanding toward the customer?") and a 1 to 4 scale named Poor, Fair, Good, Excellent. This is what a first rubric often looks like.
- **Anchored.** Each level says what it sounds like ("Names what happened to this customer, or how it affects them, in words that fit only this call"), plus five scoring rules: score only the learner, a level counts only if the transcript shows it, any Not yet behaviour caps the skill at 1, when torn pick the lower level, quote exactly or give no credit.
- **Revised.** The anchored rubric after one review round. Resolution was the one skill still drifting: the grader was counting a stated side issue, or a missed better option, against Resolution as well as Listening. Round three added one rule (count each behaviour under one skill only) and reworded Resolution level 3 (fixing the main problem counts even if a better option existed).

Certification is computed by code, never by the grader: certified when every skill scores 3 or higher.

## Data, and what is real

**Role-plays are synthetic.** `data/roleplays.json` holds 16 calls in three made-up scenarios at a made-up provider, Northline Internet: "Charged twice" (A1 to A6), "Missed install" (B1 to B6) and "Price jump" (C1 to C4). Each call was written to show a set level on each skill. That intended level is the key, and `keyNotes` says which lines earn it. The anchors and the key come from the same standard, so agreement on A and B is a best case.

**C1 to C4 were written after the revised rubric was final**, to check it on calls it wasn't tuned on. They are a small, honest holdout, not a benchmark.

**The grades are real.** `data/runs/<rubric>/<call>-r<n>.json` holds 240 recorded calls of `claude-sonnet-5-5` (16 calls, 3 rubrics, 5 runs), made on 2026-10-20 through the Claude Code CLI:

```
claude -p --model claude-sonnet-5-5 --system-prompt <grader prompt> --setting-sources "" --tools "" \
  --strict-mcp-config --no-session-persistence --output-format json --json-schema <schema>
```

Each run is a fresh session with no tools, no settings and no saved history, at the CLI's default sampling. The prompt goes in on stdin. The JSON schema forces five skills in order, each with evidence quotes first, then a reason, then a level. Every run file stores the SHA-256 of its full prompt, and a test rebuilds every prompt from today's code and checks it matches.

No API key ships in the page and nothing calls a model at view time. The page reads `data/runs.json` and `data/results.json`.

## Results

From `npm run eval` (`data/results.json`). "Scores" are one skill in one run; "skill scores" for agreement are one skill for one call across its 5 runs.

### The 12 calls the rubrics were tuned on (300 scores)

| | Draft | Anchored | Revised |
|---|---|---|---|
| Scores that match the key | 168 (56%) | 275 (92%) | 287 (96%) |
| Within one level of the key | 285 | 300 | 300 |
| Quadratic weighted kappa with the key | 0.720 | 0.952 | 0.975 |
| Average lean against the key (levels) | -0.48 | -0.08 | -0.04 |
| Same score in all 5 runs (of 60) | 48 | 54 | 57 |
| Certification calls that match the key (of 60) | 55 | 60 | 60 |
| Calls whose certification changed between runs | 0 | 0 | 0 |
| Quotes found word for word in the learner's lines | 563 of 563 | 478 of 478 | 481 of 481 |

### The 4 new calls (100 scores)

| | Draft | Anchored | Revised |
|---|---|---|---|
| Scores that match the key | 66 | 89 | 90 |
| Quadratic weighted kappa with the key | 0.679 | 0.864 | 0.875 |
| Average lean against the key (levels) | -0.34 | -0.01 | -0.02 |
| Same score in all 5 runs (of 20) | 17 | 19 | 18 |
| Certification calls that match the key (of 20) | 15 | 20 | 20 |

What I took from it:

- **The draft grader is consistent and wrong in one direction.** It never flipped a certification call between runs. It scored below the key on average and failed both calls written as solid Proficient across the board (Ben, A2, and Mina, C1) in all 5 runs. Its reasons show why: with no anchors, it held learners to every option in the scenario ("did not mark it urgent", "did not fix the gmial.com email typo").
- **Anchors fixed most of it.** Listening, Ownership and Close matched the key on every score in the tuning set.
- **Resolution needed a second round.** Anchored Resolution matched on 40 of 60; after the round three rule, 51 of 60. On the new calls, anchored and revised both got Resolution 20 of 20, so the change didn't help or hurt there.
- **The new calls found the next rule to discuss.** On Priya (C4), turning on renewal reminders answers a complaint she raised. The key counts that as Listening (4). The grader counted it as an Ownership extra in 9 of 10 anchored and revised runs and held Listening at 3. That is a real judgement call for the coaches, not a bug.
- **No quote was made up.** Every quote in all 240 runs was found word for word in the learner's lines. The check is in `src/lib/quotes.ts`: case-insensitive, straight and curly quotes treated the same, ellipses split into pieces that must each appear.

The sample is small: 16 calls, 5 runs each, one model. It shows how a rubric drifts and how to measure it, not how often it would on real learners.

## Reproduce

```
npm install
npm test          # metrics, quote check, prompt hashes, results.json == recomputed
npm run eval      # rebuilds data/runs.json and data/results.json from data/runs/
npm run grade     # records any missing runs (needs the claude CLI, logged in); set CLAUDE_BIN if it's not on PATH
npm run dev       # http://localhost:5104
```

`npm run grade -- --only C4 --rubric revised --runs 5` records a subset. Finished runs are skipped.

## Code

- `src/lib/prompt.ts` builds the grader prompt and the JSON schema.
- `src/lib/quotes.ts` checks quotes against the transcript.
- `src/lib/metrics.ts` computes agreement, weighted kappa, certification and the featured learner.
- `src/lib/view.ts` builds the sentences on the page from the data.
- `scripts/grade.ts` records runs; `scripts/eval.ts` scores them.
- `src/App.tsx`, `src/Results.tsx`, `src/RubricDiff.tsx` are the page.
