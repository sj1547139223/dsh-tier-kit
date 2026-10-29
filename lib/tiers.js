// Pure tier definitions shared by the Host settings service, the agent-plane
// plugin, and the tests. No harness imports.

/** Event emitted on the Host root after a tier-settings edit commits. */
export const UPDATED = 'tier-kit/routes-updated'

/** The three tiers, in display order. `tool` is the model-facing tool name. */
export const TIERS = [
  { id: 'worker', tool: 'subagent_worker', label: 'low / worker' },
  { id: 'reviewer', tool: 'subagent_reviewer', label: 'mid / reviewer' },
  { id: 'arbiter', tool: 'subagent_arbiter', label: 'top / arbiter' },
]

/** Factory defaults: Claude Haiku / Sonnet / Opus 5.5 through the vwFactory proxy. */
export const DEFAULT_ROUTES = {
  worker: { provider: 'factory-claude', model: 'claude-haiku-5-5', reasoningEffort: 'medium' },
  // Explicit effort: Sonnet 5.5 rejects thinking {type: disabled}.
  reviewer: { provider: 'factory-claude', model: 'claude-sonnet-5-5', reasoningEffort: 'high' },
  arbiter: { provider: 'factory-claude', model: 'claude-opus-5-5', reasoningEffort: 'high' },
}

/**
 * Normalize one stored route; falls back to the tier default for missing parts.
 * An empty reasoningEffort means "model default" and is dropped.
 * @param {string} tier
 * @param {unknown} raw
 * @returns {{provider: string, model: string, reasoningEffort?: string}}
 */
export function normalizeRoute(tier, raw) {
  const fallback = DEFAULT_ROUTES[tier]
  if (!fallback) throw new Error(`unknown tier "${tier}"`)
  const r = raw && typeof raw === 'object' ? raw : {}
  const provider = typeof r.provider === 'string' && r.provider ? r.provider : fallback.provider
  const model = typeof r.model === 'string' && r.model ? r.model : fallback.model
  // Keep the default effort only when the route itself is the default one.
  const sameRoute = provider === fallback.provider && model === fallback.model
  const effort = typeof r.reasoningEffort === 'string'
    ? r.reasoningEffort
    : (sameRoute ? fallback.reasoningEffort : '')
  return effort ? { provider, model, reasoningEffort: effort } : { provider, model }
}

/** All three routes, normalized. */
export function normalizeRoutes(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  return Object.fromEntries(TIERS.map(({ id }) => [id, normalizeRoute(id, src[id])]))
}

/** Stable identity for change detection. */
export function routeKey(route) {
  return `${route.provider}/${route.model}#${route.reasoningEffort ?? ''}`
}

/** tool-subagent config for one tier. maxDepth 1: tier children cannot delegate further. */
export function toolConfig(tier, route) {
  const def = TIERS.find((t) => t.id === tier)
  return { provider: 'spawn', toolName: def.tool, maxDepth: 1, agentOptions: { ...route } }
}

const fmt = (r) => `${r.model}${r.reasoningEffort ? `, effort ${r.reasoningEffort}` : ''}`

/** System-prompt policy naming the live models. */
export function policyText(routes, { guardWorker = true } = {}) {
  const { worker, reviewer, arbiter } = routes
  return `Tiered delegation. You are the decision maker and final reviewer; route each unit of work to the cheapest tier that can do it reliably.
- \`subagent_worker\` (${fmt(worker)}, cheapest): bounded, fully specified work 鈥?an edit with explicit acceptance checks, searches, summaries, boilerplate, running tests. Hand it the spec, the relevant paths, and the checks; require evidence (diff, commands run, outputs), not self-assessment.${guardWorker ? ' It cannot run high-impact actions (recursive deletes, git push/reset --hard, credential or ~/.dsh edits, destructive MCP tools); those come back to you.' : ''}
- \`subagent_reviewer\` (${fmt(reviewer)}, mid): independent review of worker output against the acceptance checks 鈥?it must execute the code or tests itself and report PASS/FAIL with evidence; also medium work with several edge cases or one small design choice.
- \`subagent_arbiter\` (${fmt(arbiter)}, top): hard or high-risk work and second opinions 鈥?multiple input formats, concurrency, security, migrations, irreversible operations, or settling a disagreement between worker and reviewer.
Escalate one tier when a review fails twice, a worker reports ambiguity, or the tier guard blocks a call. Do work yourself when it is faster than writing the brief. Never forward a child's claims unverified: accept results only after you or a reviewer checked the evidence.`
}
