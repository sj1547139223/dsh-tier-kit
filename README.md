# dsh-tier-kit

Tiered delegation for DeepSeek Harness. The session model decides and accepts. A cheap **worker** does bounded work, a **reviewer** checks it by actually running it, and an **arbiter** handles hard or risky work. You pick each tier's model and reasoning effort from dropdowns on the **Plugins** page.

## What it adds

| Piece | Where | What it does |
|---|---|---|
| Tier settings | `lib/settings.js` (Host row `tier-kit`) | A Host service, `tierKitSettings`, with four `volatile` fields: `worker`, `reviewer` and `arbiter` (each `{provider, model, reasoningEffort}`), plus `guardWorker`. DSH Settings serves them as an editable form, and edits persist to the profile `cordis.patch.yml`. |
| Plugins page | `client.js` | Open **Plugins 鈫?Installed plugins 鈫?dsh-tier-kit**. Each tier has a model dropdown (live model catalog, grouped by provider) and a reasoning-effort dropdown (the efforts that model offers), plus a guard switch. Changes take effect on the next delegation, with no restart. |
| `tiered` agent preset | `cordis.patch.yml` | The shipped `standard` preset, with the generic `subagent` row replaced by `tier-kit-agent`. |
| Tier tools | `lib/agent.js` | Mounts the official `dsh-tool-subagent` once per tier as `subagent_worker`, `subagent_reviewer` and `subagent_arbiter` (`maxDepth: 1`). When a route changes, only that tier is re-mounted. Tool names and schemas stay the same, so the tool catalog doesn't change. |
| Tier policy prompt | `lib/tiers.js` | Tells the main agent which tier fits which kind of work, naming the live models. |
| Tier guard | `lib/rules.js` | A deterministic `tools.guard()`. It denies high-impact calls from child agents running the current worker route, and from any agent on a `guardedModels` route. Denied calls: recursive deletes, `git push` / `reset --hard` / `clean -f`, disk, power, registry and ACL changes, `iwr \| iex`, publishing, writes to `.env`, keys, `~/.ssh`, `~/.dsh`, `~/.factory` or `.git/hooks`, `tgit_ai` undo/switch/restore, and destructive MCP tools. |
| Fan-out template | `templates/tiered-workflow.js` | A `workflow` script. The low tier grades difficulty, the matching tier works, a reviewer checks the result, a failed review gets one fix-and-recheck round, and anything still failing returns as `needs-decision`. Pass `args.models` when your tier models differ from the defaults. |

Defaults (when nothing is set on the page): worker `factory-claude/claude-haiku-5-5` (medium), reviewer `claude-sonnet-5-5` (high), arbiter `claude-opus-5-5` (high).

## Install

1. Clone the repository anywhere, for example `git clone https://github.com/sj1547139223/dsh-tier-kit.git H:\dsh-tier-kit`.
2. In your profile's `package.json` (`~/.dsh/profiles/<profile>/package.json`), add `"@local/dsh-tier-kit": "link:H:/dsh-tier-kit"` to `dependencies`, and add `"@local/dsh-tier-kit"` to `dsh.profile.bundles`.
3. Run `pnpm install` in the profile directory, then restart DSH.
4. Pick **Tiered (worker / reviewer / arbiter)** for a new session. Choose the tier models under **Plugins → Installed plugins → @local/dsh-tier-kit**.

The defaults route through a provider named `factory-claude`. If you don't have that route, pick models from your own providers on the Plugins page.

Never create a `node_modules` folder in this directory. `@deepseek-ai/cordis` and `schemastery` are peer dependencies, which the DSH launcher resolves to the runtime's own copies for linked plugins. A local copy would shadow them.

## Agent row config (`tier-kit-agent` in the preset)

```yaml
guardedModels: []    # always-guarded routes (bare id or provider/model), at any depth
denyToolPatterns: ['^mcp__.*(?:delete|remove|eval|drop|reset|destroy)']
policyPrompt: true
tools: true          # mount the three tier tools
```

## Maintenance

- After a DSH upgrade, diff the shipped `presets/standard.patch.yml` against the plugin list in `cordis.patch.yml`.
- Tests: `node --test-isolation=none --test "test/*.test.mjs"`. Isolation is off because the DSH sandbox blocks the test runner's subprocesses.
- Idea credit: the cheap-tier guard and the tier layout come from [BruceLanLan/dsh-tier-router](https://github.com/BruceLanLan/dsh-tier-router) (MIT). The rules were rewritten for Windows/PowerShell.
