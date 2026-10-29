/**
 * dsh-tier-kit agent-plane plugin for the `tiered` preset.
 *
 * 1. Tier tools: mounts the official @deepseek-ai/dsh-tool-subagent once per
 *    tier (subagent_worker / subagent_reviewer / subagent_arbiter) with the
 *    route chosen in the Host settings (lib/settings.js), and re-mounts a tier
 *    when its route changes. tool-subagent fixes agentOptions per mount, so a
 *    re-mount is how a new route takes effect; tool names and schemas stay the
 *    same, so the tool catalog (and the request cache) does not change.
 * 2. Tier guard: a monotonic `tools.guard()` that denies high-impact calls from
 *    cheap agents: any agent on a `guardedModels` route, plus child agents
 *    running the current worker route (when `guardWorker` is on).
 * 3. Tier policy: a system-prompt section naming the live tier models.
 *
 * Config (all optional):
 *   guardedModels     string[]  bare ids or "provider/model", always guarded
 *   denyToolPatterns  string[]  extra tool-name regexes denied for guarded agents
 *   policyPrompt      boolean   inject the tier policy section (default true)
 *   tools             boolean   mount the three tier tools (default true)
 */
import { classifyToolCall, isGuardedRoute, DEFAULT_DENY_TOOL_PATTERNS } from './rules.js'
import { DEFAULT_ROUTES, TIERS, UPDATED, policyText, routeKey, toolConfig } from './tiers.js'

export const name = 'dsh-tier-kit-agent'
export const inject = ['tools', 'systemPrompt']

const DEFAULTS = {
  guardedModels: [],
  denyToolPatterns: DEFAULT_DENY_TOOL_PATTERNS,
  policyPrompt: true,
  tools: true,
}

/** Merge raw row config over defaults, ignoring empty values. */
export function normalizeConfig(raw) {
  const cfg = { ...DEFAULTS }
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.guardedModels)) cfg.guardedModels = raw.guardedModels.filter((m) => typeof m === 'string' && m)
    if (Array.isArray(raw.denyToolPatterns)) cfg.denyToolPatterns = raw.denyToolPatterns.filter((p) => typeof p === 'string' && p)
    if (typeof raw.policyPrompt === 'boolean') cfg.policyPrompt = raw.policyPrompt
    if (typeof raw.tools === 'boolean') cfg.tools = raw.tools
  }
  for (const source of cfg.denyToolPatterns) new RegExp(source, 'i') // fail activation on a bad pattern
  return cfg
}

/** Delegation depth of an agent; 0 for the top-level agent. */
export function depthOf(agent) {
  const header = agent?.session?.header?.delegationDepth
  const runtime = agent?.options?.subagentDepth
  return Math.max(Number.isSafeInteger(header) ? header : 0, Number.isSafeInteger(runtime) ? runtime : 0)
}

/** Whether a call from this agent is subject to the guard. */
export function isGuardedAgent(agent, cfg, state) {
  const options = agent?.options
  if (isGuardedRoute(options, cfg.guardedModels)) return true
  if (!state.guardWorker || depthOf(agent) === 0) return false
  const w = state.routes.worker
  return options?.provider === w.provider && options?.model === w.model
}

export function apply(ctx, rawConfig) {
  const cfg = normalizeConfig(rawConfig)
  const host = () => ctx.get('tierKitSettings')
  const fallback = { routes: { ...DEFAULT_ROUTES }, guardWorker: true }
  let state = fallback
  const read = () => {
    try { state = host()?.current() ?? fallback } catch (error) {
      ctx.logger.warn('dsh-tier-kit: cannot read tier settings, using defaults: %s', error?.message ?? error)
      state = fallback
    }
    return state
  }
  read()

  ctx.effect(() => ctx.tools.guard((exec) => {
    if (!isGuardedAgent(exec.agent, cfg, state)) return undefined
    let hit
    try {
      hit = classifyToolCall(exec.name, exec.arguments, { denyToolPatterns: cfg.denyToolPatterns })
    } catch (error) {
      // Fail closed for guarded agents: an unclassifiable call is not allowed through.
      hit = `guard could not classify the call (${error?.message ?? error})`
    }
    if (hit === null) return undefined
    return `tier guard: ${hit}. This agent runs on the cheap tier (${exec.agent.options.model}) and may not perform high-impact actions. Do not retry or work around this; stop and report to the parent exactly what you intended to run and why, so the parent can run it or hand it to a stronger tier.`
  }))

  if (cfg.policyPrompt) {
    ctx.systemPrompt.section({
      name: 'dsh-tier-kit:policy',
      order: ctx.systemPrompt.getSectionOrder('TOOL_SUBAGENT') + 1,
      text: () => (cfg.tools ? policyText(state.routes, { guardWorker: state.guardWorker }) : ''),
    })
  }

  if (!cfg.tools) {
    ctx.on(UPDATED, () => { read() })
    return
  }

  // tier id -> { key, fiber }
  const mounted = new Map()
  let module
  let syncing = Promise.resolve()
  const loadModule = async () => {
    if (module) return module
    const settings = host()
    if (settings?.loadToolSubagent) module = await settings.loadToolSubagent()
    else {
      const loader = ctx.get('loader')
      if (!loader) throw new Error('neither tierKitSettings nor the loader service is available')
      module = await loader.import('@deepseek-ai/dsh-tool-subagent')
    }
    return module
  }
  const sync = () => {
    syncing = syncing.then(async () => {
      const mod = await loadModule()
      for (const { id } of TIERS) {
        const route = state.routes[id]
        const key = routeKey(route)
        const current = mounted.get(id)
        if (current?.key === key) continue
        if (current) {
          mounted.delete(id)
          await current.fiber.dispose()
        }
        const fiber = ctx.plugin(mod, toolConfig(id, route))
        mounted.set(id, { key, fiber })
        ctx.logger.info('dsh-tier-kit: %s -> %s/%s%s', id, route.provider, route.model, route.reasoningEffort ? ` (${route.reasoningEffort})` : '')
      }
    }).catch((error) => {
      ctx.logger.error('dsh-tier-kit: mounting tier tools failed: %s', error?.stack ?? error)
    })
    return syncing
  }
  sync()
  ctx.on(UPDATED, () => { read(); sync() })
  // Safety net if an update event was missed: re-check whenever an agent is created.
  ctx.on('agent/created', () => { read(); sync() })
}
