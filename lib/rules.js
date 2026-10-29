// Pure, dependency-free guard rules for dsh-tier-kit. No harness imports and
// no I/O, so `node --test` covers them directly (test/rules.test.mjs).
//
// Idea credit: the deterministic "cheap tier may not run high-impact actions"
// guard comes from BruceLanLan/dsh-tier-router (MIT). These rules are
// rewritten for Windows/PowerShell, which that project does not cover.

/** Start of a command: string start, a statement/pipeline separator, or a block opener. */
const CMD_START = String.raw`(?:^|[;|&\n\r({]|&&|\|\|)\s*(?:sudo\s+|doas\s+|&\s*)?`

/** Deletion commands across PowerShell, cmd, and POSIX shells. */
const DELETE_VERBS = String.raw`Remove-Item|ri|rm|rmdir|rd|del|erase`

const DELETE_AT_COMMAND = new RegExp(`${CMD_START}\\\\?(?:${DELETE_VERBS})(?:\\.exe)?(?=\\s|$)`, 'gi')

/** Recursive flag inside one command segment. `-Force`/`-fo` are deliberately NOT recursive. */
const RECURSIVE_FLAG = /(?:^|\s)(?:-r[a-z]*|-[fivd]{0,3}r[fivd]{0,3}|--recursive|\/s)(?=[\s:]|$)/i

/** `git <args>` at command position, so quoted mentions ("git push" in a search) do not match. */
const git = (rest, flags = 'i') => new RegExp(`${CMD_START}git(?:\\.exe)?\\s+${rest}`, flags)

/** Next separator after a command start (ends the segment we inspect for flags). */
const SEGMENT_END = /[;|\n\r]|&&|\|\|/

/**
 * High-impact command patterns (checked after the recursive-delete rule).
 * Each entry: [regex, short label]. Patterns are case-insensitive.
 */
export const HIGH_IMPACT_COMMANDS = [
  // version control: rewrites or publishes history
  [git(String.raw`(?:-C\s+\S+\s+)?push\b`), 'git push (publishes to a remote)'],
  [git(String.raw`reset\s+[^\n;|]*--hard\b`), 'git reset --hard'],
  [git(String.raw`clean\s+[^\n;|]*-[a-z]*f`), 'git clean -f'],
  [git(String.raw`branch\s+[^\n;|]*-D\b`, ''), 'git branch -D'],
  [git(String.raw`(?:checkout|restore)\s+(?:--\s+)?\.(?:\s|$)`), 'git checkout/restore . (discards all changes)'],
  [git(String.raw`stash\s+(?:drop|clear)\b`), 'git stash drop/clear'],
  [git(String.raw`filter-(?:branch|repo)\b`), 'git history rewrite'],
  [git(String.raw`update-ref\s+-d\b`), 'git update-ref -d'],
  // disks, boot, power
  [/\b(?:Format-Volume|Clear-Disk|Initialize-Disk|diskpart|mkfs(?:\.[a-z0-9]+)?)\b/i, 'disk formatting'],
  [/(?:^|[;|&\n]\s*)format(?:\.com)?\s+[a-z]:/im, 'format drive'],
  [/\bdd\s+(?:if|of)=/i, 'dd raw device write'],
  [/\b(?:Stop-Computer|Restart-Computer)\b|(?:^|[;|&\n]\s*)(?:shutdown|reboot|halt)(?:\.exe)?\b/im, 'shutdown/restart'],
  [/\bbcdedit\b/i, 'boot configuration'],
  [/\b(?:vssadmin\s+delete|wevtutil\s+cl|cipher\s+\/w)\b/i, 'irreversible system cleanup'],
  // registry, policy, ownership, elevation
  [/\breg(?:\.exe)?\s+(?:delete|add|import)\b/i, 'registry write'],
  [/\b(?:Remove|Set|New)-ItemProperty\b[^\n]*(?:HK(?:LM|CU|CR|U)|Registry::)/i, 'registry write'],
  [/\bSet-ExecutionPolicy\b/i, 'execution policy change'],
  [/-Verb\s+RunAs\b/i, 'elevation (RunAs)'],
  [/\btakeown\b|\bicacls\b[^\n]*\/(?:grant|reset|setowner|remove)/i, 'ownership/ACL change'],
  [/\b(?:chmod|chown)\s+-R\b/i, 'recursive permission change'],
  // remote code execution
  [/\b(?:iwr|irm|Invoke-WebRequest|Invoke-RestMethod|curl|wget)\b[^\n]*\|\s*(?:iex|Invoke-Expression|sh|bash|pwsh|powershell)\b/i, 'download piped into a shell'],
  [/\b(?:iex|Invoke-Expression)\b[^\n]*(?:DownloadString|iwr|irm|Invoke-WebRequest|Invoke-RestMethod)/i, 'download executed via Invoke-Expression'],
  // publishing
  [/\b(?:npm|pnpm|yarn)\s+publish\b|\btwine\s+upload\b|\bgh\s+release\s+create\b|\bdocker\s+push\b/i, 'package/release publishing'],
]

/** Credential, key, and harness-config locations a cheap worker must not modify. */
const SENSITIVE_PATH = [
  [/(?:^|\/)\.env(?:\.(?!example$|sample$|template$)[^/]*)?$/i, '.env file'],
  [/(?:^|\/)\.ssh\//i, '.ssh directory'],
  [/(?:^|\/)(?:id_(?:rsa|ed25519|ecdsa|dsa)(?:\.pub)?|\.netrc|\.git-credentials)$/i, 'key/credential file'],
  [/\.(?:pem|key|p12|pfx|jks|kdbx)$/i, 'key material'],
  [/(?:^|\/)(?:credentials?|secrets?)(?:\.[a-z0-9]+)?$/i, 'credentials file'],
  [/(?:^|\/)\.dsh\//i, 'DeepSeek Harness profile/config (~/.dsh)'],
  [/(?:^|\/)\.factory\//i, 'Factory config (~/.factory)'],
  [/(?:^|\/)\.git\/(?:config|hooks\/)/i, 'git config/hooks'],
  [/\/appdata\/roaming\/@deepseek-ai\//i, 'DSH desktop app data'],
]

/** The same locations, unanchored, for paths embedded in a shell command. */
const SENSITIVE_IN_COMMAND = [
  [/(?:^|[\s'"=\/])\.env(?:[\s'"]|$)/i, '.env file'],
  [/[\\/]\.ssh[\\/]|\bid_(?:rsa|ed25519|ecdsa|dsa)\b|\.git-credentials\b/i, 'key/credential file'],
  [/[\\/]\.dsh[\\/]/i, 'DeepSeek Harness profile/config (~/.dsh)'],
  [/[\\/]\.factory[\\/]/i, 'Factory config (~/.factory)'],
  [/\.git[\\/](?:config|hooks)\b/i, 'git config/hooks'],
]

/** Shell verbs/operators that mutate files. */
const MUTATING_SHELL = /\b(?:Set-Content|Add-Content|Out-File|New-Item|Copy-Item|Move-Item|Remove-Item|Rename-Item|Clear-Content|cp|mv|rm|del|copy|move|ren|tee|sed\s+-i)\b|>{1,2}/i

const SHELL_TOOLS = new Set(['pwsh', 'bash', 'shell', 'powershell'])
const FILE_WRITE_TOOLS = new Set(['write', 'edit', 'multi_edit', 'apply_patch'])

/** tgit_ai actions that rewrite or move the working tree. */
const TGIT_DANGEROUS = new Set(['undo', 'branch', 'switch', 'restore', 'pause'])

/** Default MCP tool-name pattern treated as destructive for cheap tiers. */
export const DEFAULT_DENY_TOOL_PATTERNS = ['^mcp__.*(?:delete|remove|eval|drop|reset|destroy)']

/**
 * Detect a recursive delete at command position.
 * @param {string} cmd
 * @returns {string|null} label when matched
 */
export function recursiveDelete(cmd) {
  if (typeof cmd !== 'string' || cmd.length === 0) return null
  DELETE_AT_COMMAND.lastIndex = 0
  let match
  while ((match = DELETE_AT_COMMAND.exec(cmd)) !== null) {
    const rest = cmd.slice(match.index + match[0].length)
    const end = rest.search(SEGMENT_END)
    const segment = end === -1 ? rest : rest.slice(0, end)
    if (RECURSIVE_FLAG.test(segment)) return 'recursive delete'
    // `Get-ChildItem -Recurse ... | Remove-Item`: bulk delete fed by a recursive listing
    if (match[0].startsWith('|') && /(?:^|\s)-r[a-z]*\b/i.test(cmd.slice(0, match.index))) {
      return 'recursive listing piped into delete'
    }
  }
  return null
}

/** Normalize a filesystem path for pattern checks. */
function normPath(p) {
  return String(p).replace(/\\/g, '/').replace(/\/+/g, '/')
}

/**
 * Classify one shell command string.
 * @param {string} cmd
 * @returns {string|null}
 */
export function classifyCommand(cmd) {
  if (typeof cmd !== 'string' || cmd.trim() === '') return null
  const del = recursiveDelete(cmd)
  if (del) return del
  for (const [re, label] of HIGH_IMPACT_COMMANDS) if (re.test(cmd)) return label
  if (MUTATING_SHELL.test(cmd)) {
    for (const [re, label] of SENSITIVE_IN_COMMAND) if (re.test(cmd)) return `modifies ${label}`
  }
  return null
}

/**
 * Classify a file path a write/edit tool would modify.
 * @param {string} filePath
 * @returns {string|null}
 */
export function classifyPath(filePath) {
  if (typeof filePath !== 'string' || filePath === '') return null
  const p = normPath(filePath)
  for (const [re, label] of SENSITIVE_PATH) if (re.test(p)) return `modifies ${label}`
  return null
}

/**
 * Match a tool call against the high-impact rules.
 * @param {string} name - tool name
 * @param {unknown} args - parsed tool arguments
 * @param {{denyToolPatterns?: string[]}} [options]
 * @returns {string|null} human-readable reason, or null when allowed
 */
export function classifyToolCall(name, args, options = {}) {
  const a = args && typeof args === 'object' ? args : {}
  const patterns = options.denyToolPatterns ?? DEFAULT_DENY_TOOL_PATTERNS
  for (const source of patterns) {
    if (new RegExp(source, 'i').test(name)) return `tool ${name} is on the cheap-tier deny list`
  }
  if (SHELL_TOOLS.has(name)) return classifyCommand(a.command)
  if (FILE_WRITE_TOOLS.has(name)) return classifyPath(a.file_path ?? a.path)
  if (name === 'tgit_ai' && TGIT_DANGEROUS.has(String(a.action))) return `tgit_ai ${a.action} rewrites project history`
  return null
}

/**
 * Whether a model route is guarded. Entries may be bare model ids
 * ("claude-haiku-5-5") or "provider/model" routes.
 * @param {{provider?: string, model?: string}|undefined} options - agent options
 * @param {string[]} guarded
 */
export function isGuardedRoute(options, guarded) {
  if (!options || typeof options.model !== 'string') return false
  const route = `${options.provider ?? ''}/${options.model}`
  return guarded.some((entry) => (entry.includes('/') ? entry === route : entry === options.model))
}
