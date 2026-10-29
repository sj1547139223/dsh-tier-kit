// Tiered fan-out workflow for the DSH `workflow` tool.
// Pass the body of this file as `script`, and tasks as args: {tasks:[{id, text}], models?}.
//
// Routing (the low tier grades difficulty):
//   easy   -> low works                    -> (no review)
//   medium -> low works -> mid reviews     -> on FAIL: low fixes once -> mid re-reviews
//   hard   -> mid works -> top reviews     -> on FAIL: mid fixes once -> top re-reviews
// Anything still FAILing comes back as status "needs-decision" for the parent
// (the top-level session) to settle; no model arbitrates its own review.
// A null from agent() (child failure) is reported explicitly, never as success.

// Tier routes. Defaults match the Plugins-page defaults; pass the live ones as
// args.models = {low:{provider,model}, mid:{...}, top:{...}} when they differ.
const M = {
  low: { provider: 'factory-claude', model: 'claude-haiku-5-5' },
  mid: { provider: 'factory-claude', model: 'claude-sonnet-5-5' },
  top: { provider: 'factory-claude', model: 'claude-opus-5-5' },
  ...(args?.models ?? {}),
}
const PLAN = {
  easy: { worker: 'low', reviewer: null },
  medium: { worker: 'low', reviewer: 'mid' },
  hard: { worker: 'mid', reviewer: 'top' },
}
const tasks = args?.tasks ?? []
if (tasks.length === 0) throw new Error('args.tasks is empty')

const gradeSchema = { type: 'object', additionalProperties: false, required: ['difficulty', 'reason'],
  properties: { difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] }, reason: { type: 'string' } } }
const reviewSchema = { type: 'object', additionalProperties: false, required: ['verdict', 'evidence', 'issues'],
  properties: { verdict: { type: 'string', enum: ['PASS', 'FAIL'] }, evidence: { type: 'string' },
    issues: { type: 'array', items: { type: 'string' } } } }

const review = (who, s, draft, round) => agent(
  `You are the reviewer. Check the deliverable against every requirement. If it contains code, write it to a temp file and actually run it (its own asserts plus at least 3 edge cases you add) before deciding. Do not modify it.\n` +
  `evidence: what you ran and the results. issues: each unmet requirement (empty on PASS).\nRequirement: ${s.text}\nDeliverable:\n${draft}`,
  { ...M[who], schema: reviewSchema, label: `review${round} ${s.id} (${who})`, phase: 'review' })

const out = await pipeline(tasks,
  async (t) => {
    const g = await agent(`Grade difficulty. easy = single-step fact/format conversion; medium = one small function with few edge cases; hard = several input formats, many edge cases, easy to get wrong, or risky/irreversible.\nTask: ${t.text}`,
      { ...M.low, schema: gradeSchema, label: `route ${t.id}`, phase: 'route' })
    const difficulty = g?.difficulty ?? 'medium'
    return { ...t, difficulty, why: g?.reason ?? 'router failed; defaulted to medium', trail: [`route:low->${difficulty}`] }
  },
  async (s) => {
    const p = PLAN[s.difficulty]
    const draft = await agent(`${s.text}\nOutput only the final deliverable (code in one code block); no process narration.`,
      { ...M[p.worker], label: `work ${s.id} (${p.worker})`, phase: 'work' })
    return { ...s, draft, trail: [...s.trail, `work:${p.worker}${draft ? '' : ' FAILED'}`] }
  },
  async (s) => {
    const p = PLAN[s.difficulty]
    if (!s.draft) return { ...s, final: null, status: 'worker-failed' }
    if (!p.reviewer) return { ...s, final: s.draft, status: 'done-unreviewed' }
    let draft = s.draft
    let trail = s.trail
    let last = null
    for (let round = 1; round <= 2; round++) {
      last = await review(p.reviewer, s, draft, round)
      trail = [...trail, `review${round}:${p.reviewer}->${last?.verdict ?? 'FAILED'}`]
      if (!last) return { ...s, draft, final: draft, review: null, trail, status: 'review-failed' }
      if (last.verdict === 'PASS') return { ...s, draft, final: draft, review: last, trail, status: round === 1 ? 'pass' : 'pass-after-fix' }
      if (round === 2) break
      const fixed = await agent(`Fix the deliverable so every review issue is resolved; keep what already works.\nRequirement: ${s.text}\nCurrent deliverable:\n${draft}\nReview:\n${JSON.stringify(last, null, 2)}\nOutput only the corrected deliverable.`,
        { ...M[p.worker], label: `fix ${s.id} (${p.worker})`, phase: 'fix' })
      trail = [...trail, `fix:${p.worker}${fixed ? '' : ' FAILED'}`]
      if (!fixed) break
      draft = fixed
    }
    return { ...s, draft, final: null, review: last, trail, status: 'needs-decision' }
  },
)

return out.map((s) => ({ id: s.id, difficulty: s.difficulty, router_reason: s.why, trail: s.trail.join(' -> '),
  status: s.status, review: s.review ?? null, final: s.final, ...(s.status === 'needs-decision' ? { last_draft: s.draft } : {}) }))
