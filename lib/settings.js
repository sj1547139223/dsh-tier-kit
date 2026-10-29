/**
 * dsh-tier-kit Host settings: the live model route of each tier.
 *
 * Mounted at the Host level (profile row id `tier-kit`), so DSH Settings
 * serves its `.volatile()` fields as an editable form and persists edits to the
 * profile patch. The browser page (client.js) edits it; the agent-plane plugin
 * (lib/agent.js) reads it and re-mounts the tier tools when it changes.
 */
import { Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { DEFAULT_ROUTES, TIERS, UPDATED, normalizeRoutes } from './tiers.js'

export const name = 'dsh-tier-kit'

export { UPDATED }

const Route = (d) => z.object({
  provider: z.string().min(1).required(),
  model: z.string().min(1).required(),
  // '' = the model's default effort.
  reasoningEffort: z.string(),
}).default({ ...d })

export class TierKitSettings extends Service {
  static Config = z.object({
    worker: Route(DEFAULT_ROUTES.worker).volatile().description('Low tier: bounded worker'),
    reviewer: Route(DEFAULT_ROUTES.reviewer).volatile().description('Mid tier: reviewer'),
    arbiter: Route(DEFAULT_ROUTES.arbiter).volatile().description('Top tier: arbiter'),
    guardWorker: z.boolean().default(true).volatile().description('Block high-impact actions in low-tier children'),
  })

  constructor(ctx, config) {
    super(ctx, 'tierKitSettings')
    this.config = config
    this.toolSubagentModule = undefined
    // The Loader delivers this only to listeners owned by this fiber.
    ctx.on('loader/volatile-update', () => {
      ctx.root.emit(UPDATED, this.current())
    })
  }

  /** Detached snapshot of the effective settings. */
  current() {
    const raw = Object.fromEntries(TIERS.map(({ id }) => [id, this.config[id]?.get?.()]))
    return { routes: normalizeRoutes(raw), guardWorker: this.config.guardWorker?.get?.() !== false }
  }

  /**
   * The official tool-subagent module, resolved through the Host Loader so the
   * agent-plane plugin mounts the runtime's own copy (one shared tool registry).
   */
  async loadToolSubagent() {
    if (this.toolSubagentModule) return this.toolSubagentModule
    const loader = this.ctx.get('loader')
    if (!loader) throw new Error('dsh-tier-kit: the Host loader service is unavailable')
    this.toolSubagentModule = await loader.import('@deepseek-ai/dsh-tool-subagent')
    return this.toolSubagentModule
  }
}

export default TierKitSettings
