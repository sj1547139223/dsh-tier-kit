// dsh-tier-kit browser half: tier model settings on the Plugins page.
// Edits the Host `tier-kit` settings namespace (lib/settings.js) with dropdowns
// fed by the live model catalog. Applies to the next delegation; no restart.
window.__ModuleLoader__.load({
  id: '@local/dsh-tier-kit',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    let primitives = null
    try { primitives = require('@deepseek-ai/dsh-client-ui-primitives') } catch { primitives = null }

    const PKG = '@local/dsh-tier-kit'
    const NS = 'tier-kit' // Host profile entry id
    const LOCALE = 'dshTierKit'
    const TIERS = ['worker', 'reviewer', 'arbiter']
    const FIELDS = [...TIERS, 'guardWorker']

    const zh = {
      summary: '为低 / 中 / 高三档子智能体选择模型和推理强度。',
      title: '分档模型',
      hint: '主会话按难度把活派给这三档。修改后对下一次派活立即生效，无需重启。',
      worker: '低档 · 干活',
      workerHelp: 'subagent_worker：边界清楚的具体活，必须交回证据。',
      reviewer: '中档 · 复核',
      reviewerHelp: 'subagent_reviewer：亲自运行代码/测试后给出 PASS/FAIL。',
      arbiter: '高档 · 裁决',
      arbiterHelp: 'subagent_arbiter：难题、高风险操作、复核分歧的裁决。',
      model: '模型',
      effort: '推理强度',
      effortDefault: '模型默认',
      unavailable: '当前不可用',
      unsupported: '该模型不支持',
      guard: '低档高危操作拦截',
      guardHelp: '低档子智能体不能递归删除、git push/reset --hard、改凭据或 ~/.dsh、调用破坏性 MCP 工具。',
      loading: '正在加载模型…',
      loadFailed: '无法加载模型列表。',
      retry: '重试',
      partial: '部分模型提供方加载失败。',
      save: '保存',
      saving: '保存中…',
      discard: '放弃修改',
      resetAll: '全部恢复默认',
      saveFailed: '保存没有生效，修改已保留。',
      conflict: '设置已在别处更新，请放弃修改后重试。',
      readOnly: '本部署的设置为只读。',
      notServed: 'tier-kit 设置服务未加载。',
      overridden: '已自定义',
    }
    const en = {
      summary: 'Choose the model and reasoning effort of the low / mid / top subagent tiers.',
      title: 'Tier models',
      hint: 'The main session routes work to these tiers by difficulty. Changes apply to the next delegation without a restart.',
      worker: 'Low · worker',
      workerHelp: 'subagent_worker: bounded, fully specified work; must return evidence.',
      reviewer: 'Mid · reviewer',
      reviewerHelp: 'subagent_reviewer: runs the code/tests itself, then reports PASS/FAIL.',
      arbiter: 'Top · arbiter',
      arbiterHelp: 'subagent_arbiter: hard or high-risk work and settling review disagreements.',
      model: 'Model',
      effort: 'Reasoning effort',
      effortDefault: 'Model default',
      unavailable: 'currently unavailable',
      unsupported: 'not supported by this model',
      guard: 'Block high-impact actions on the low tier',
      guardHelp: 'Low-tier children cannot recursively delete, git push/reset --hard, edit credentials or ~/.dsh, or call destructive MCP tools.',
      loading: 'Loading models…',
      loadFailed: 'Models could not be loaded.',
      retry: 'Retry',
      partial: 'Some model providers failed to load.',
      save: 'Save',
      saving: 'Saving…',
      discard: 'Discard',
      resetAll: 'Reset all to defaults',
      saveFailed: 'The save did not take effect; your changes were kept.',
      conflict: 'Settings changed elsewhere. Discard your changes and try again.',
      readOnly: 'This deployment stores settings read-only.',
      notServed: 'The tier-kit settings service is not loaded.',
      overridden: 'Customized',
    }

    const css = `.dtk{display:grid;gap:14px;padding:4px 0 8px;font-size:13px;color:var(--dsw-alias-label-primary)}
.dtk-hint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.dtk-tier{display:grid;gap:8px;padding:12px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg,10px)}
.dtk-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.dtk-name{font-weight:600}
.dtk-tag{font-size:11px;color:var(--dsw-alias-label-tertiary)}
.dtk-help{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.dtk-row{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:10px}
@media (max-width:560px){.dtk-row{grid-template-columns:1fr}}
.dtk-field{display:grid;gap:4px;min-width:0}
.dtk-field>span{font-size:12px;color:var(--dsw-alias-label-secondary)}
.dtk select{font:inherit;font-size:13px;min-width:0;width:100%;height:32px;padding:0 8px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1,transparent);border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md,6px)}
.dtk select:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dtk select:disabled{opacity:.6}
.dtk-guard{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:4px 0}
.dtk-guard>div{display:grid;gap:4px}
.dtk-note{margin:0;font-size:12px;color:var(--dsw-alias-label-tertiary)}
.dtk-error{margin:0;font-size:12px;color:var(--dsw-alias-state-error-primary)}
.dtk-error button,.dtk-link{font:inherit;font-size:12px;color:var(--dsw-alias-brand-primary);background:none;border:0;padding:0;cursor:pointer}
.dtk-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
.dtk-btn{font:inherit;font-size:13px;height:30px;padding:0 14px;border-radius:var(--dsw-radius-md,6px);border:.5px solid var(--dsw-alias-border-l4);background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer}
.dtk-btn[data-primary=true]{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:#fff}
.dtk-btn:disabled{opacity:.5;cursor:default}`
    if (typeof document !== 'undefined' && !document.querySelector('style[data-plugin-css="dsh-tier-kit"]')) {
      const tag = document.createElement('style')
      tag.dataset.plugin = PKG
      tag.dataset.pluginCss = 'dsh-tier-kit'
      tag.textContent = css
      document.head.appendChild(tag)
    }

    const keyOf = (provider, model) => JSON.stringify([provider, model])
    const sameRoute = (a, b) => (a?.provider ?? '') === (b?.provider ?? '') && (a?.model ?? '') === (b?.model ?? '') && (a?.reasoningEffort ?? '') === (b?.reasoningEffort ?? '')
    const plain = (r) => ({ provider: r?.provider ?? '', model: r?.model ?? '', reasoningEffort: r?.reasoningEffort ?? '' })

    /** Shared model catalog: one load per page, refreshed on adapter changes. */
    function createCatalog(ctx) {
      let state = { status: 'idle', groups: [], partial: false }
      const listeners = new Set()
      let generation = 0
      const set = (next) => { state = next; for (const fn of listeners) fn() }
      const load = async () => {
        const gen = ++generation
        set({ ...state, status: 'loading' })
        try {
          const response = await ctx.remote.session.modelCatalog()
          if (gen !== generation) return
          if (response?.ok) set({ status: 'ready', groups: response.value.groups ?? [], partial: (response.value.failures ?? []).length > 0 })
          else set({ ...state, status: 'error' })
        } catch {
          if (gen === generation) set({ ...state, status: 'error' })
        }
      }
      return {
        load,
        subscribe(fn) { listeners.add(fn); if (state.status === 'idle') load(); return () => listeners.delete(fn) },
        getSnapshot: () => state,
      }
    }

    function findModel(groups, provider, model) {
      const group = groups.find((g) => g.id === provider)
      return group?.models?.find((m) => m.id === model)
    }

    function TierFields({ t, tier, route, catalog, disabled, onChange, customized }) {
      const groups = catalog.groups
      const info = findModel(groups, route.provider, route.model)
      const known = !!info
      const efforts = info?.reasoning?.efforts ?? []
      const defaultEffort = info?.reasoning?.defaultEffort
      const defaultName = defaultEffort === undefined ? '' : (efforts.find((e) => e.id === defaultEffort)?.name ?? defaultEffort)
      const effortKnown = route.reasoningEffort === '' || efforts.some((e) => e.id === route.reasoningEffort)

      const modelOptions = groups.map((g) => h('optgroup', { key: g.id, label: g.name ?? g.id },
        (g.models ?? []).map((m) => h('option', { key: m.id, value: keyOf(g.id, m.id) }, m.name && m.name !== m.id ? `${m.name} (${m.id})` : m.id))))
      if (!known && route.model) {
        modelOptions.unshift(h('option', { key: '__current', value: keyOf(route.provider, route.model) },
          `${route.provider}/${route.model}${catalog.status === 'ready' ? ` · ${t('unavailable')}` : ''}`))
      }

      const effortOptions = [h('option', { key: '__default', value: '' }, defaultName ? `${t('effortDefault')} (${defaultName})` : t('effortDefault'))]
      for (const e of efforts) effortOptions.push(h('option', { key: e.id, value: e.id }, e.name && e.name !== e.id ? `${e.name} (${e.id})` : e.id))
      if (!effortKnown) effortOptions.push(h('option', { key: '__stored', value: route.reasoningEffort }, `${route.reasoningEffort}${known ? ` · ${t('unsupported')}` : ''}`))

      return h('section', { className: 'dtk-tier', 'aria-label': t(tier) },
        h('div', { className: 'dtk-head' },
          h('span', { className: 'dtk-name' }, t(tier)),
          customized ? h('span', { className: 'dtk-tag' }, t('overridden')) : null),
        h('p', { className: 'dtk-help' }, t(`${tier}Help`)),
        h('div', { className: 'dtk-row' },
          h('label', { className: 'dtk-field' },
            h('span', null, t('model')),
            h('select', {
              value: keyOf(route.provider, route.model),
              disabled,
              onChange: (event) => {
                const [provider, model] = JSON.parse(event.target.value)
                const next = findModel(groups, provider, model)
                const effort = next?.reasoning?.defaultEffort ?? ''
                onChange({ provider, model, reasoningEffort: effort })
              },
            }, modelOptions)),
          h('label', { className: 'dtk-field' },
            h('span', null, t('effort')),
            h('select', {
              value: route.reasoningEffort,
              disabled: disabled || (!efforts.length && effortKnown),
              onChange: (event) => onChange({ ...route, reasoningEffort: event.target.value }),
            }, effortOptions))))
    }

    // Stores may expose prototype methods (ConfigFormController does), so call
    // them as methods; never pass them unbound.
    function useStore(store) {
      const subscribe = React.useCallback((fn) => store.subscribe(fn), [store])
      const getSnapshot = React.useCallback(() => store.getSnapshot(), [store])
      return React.useSyncExternalStore(subscribe, getSnapshot)
    }

    /** Shows a render failure on the page instead of an empty section. */
    class Boundary extends React.Component {
      constructor(props) { super(props); this.state = { error: null } }
      static getDerivedStateFromError(error) { return { error } }
      componentDidCatch(error) { console.error('[dsh-tier-kit] settings page failed', error) }
      render() {
        if (this.state.error) return h('p', { className: 'dtk-error', role: 'alert' }, 'dsh-tier-kit: ' + (this.state.error?.message ?? String(this.state.error)))
        return this.props.children
      }
    }

    function makePage(ctx, form, catalog) {
      return function TierKitPage(props) {
        const t = typeof props.t === 'function' ? props.t : ctx.locale.bind(LOCALE)
        const snapshot = useStore(form)
        const cat = useStore(catalog)
        const [draft, setDraft] = React.useState(null) // {values, revision}
        const [saving, setSaving] = React.useState(false)
        const [failed, setFailed] = React.useState(false)
        if (props.view === 'summary') return t('summary')

        const ready = snapshot?.status === 'ready' && snapshot.value
        if (!ready) return h('p', { className: 'dtk-note' }, snapshot?.status === 'loading' || snapshot?.status === undefined ? t('loading') : t('notServed'))

        const stored = {
          worker: plain(snapshot.value.worker),
          reviewer: plain(snapshot.value.reviewer),
          arbiter: plain(snapshot.value.arbiter),
          guardWorker: snapshot.value.guardWorker !== false,
        }
        const values = draft?.values ?? stored
        const dirty = draft !== null && (TIERS.some((k) => !sameRoute(values[k], stored[k])) || values.guardWorker !== stored.guardWorker)
        const conflicted = draft !== null && draft.revision !== snapshot.revision && dirty
        const writable = snapshot.writable !== false
        const disabled = !writable || saving
        const user = snapshot.user ?? {}

        const edit = (field, value) => {
          setFailed(false)
          setDraft((prev) => ({ revision: prev?.revision ?? snapshot.revision, values: { ...(prev?.values ?? stored), [field]: value } }))
        }
        const discard = () => { if (!saving) { setDraft(null); setFailed(false) } }
        const save = async () => {
          if (!dirty || conflicted || disabled) return
          const ops = []
          for (const k of TIERS) if (!sameRoute(values[k], stored[k])) ops.push({ op: 'set', path: [k], value: plain(values[k]) })
          if (values.guardWorker !== stored.guardWorker) ops.push({ op: 'set', path: ['guardWorker'], value: values.guardWorker })
          setSaving(true)
          try { await form.mutate(ops, draft.revision) } catch { /* reported below */ }
          const after = form.getSnapshot()?.value
          const landed = after && TIERS.every((k) => sameRoute(plain(after[k]), values[k])) && (after.guardWorker !== false) === values.guardWorker
          setSaving(false)
          setFailed(!landed)
          if (landed) setDraft(null)
        }
        const resetAll = async () => {
          if (disabled) return
          setSaving(true)
          try { await form.mutate(FIELDS.filter((k) => k in user).map((k) => ({ op: 'unset', path: [k] })), snapshot.revision) } catch { /* refreshed */ }
          setSaving(false)
          setDraft(null)
        }

        const body = h('div', { className: 'dtk' },
          h('p', { className: 'dtk-hint' }, t('hint')),
          cat.status === 'loading' ? h('p', { className: 'dtk-note', role: 'status' }, t('loading')) : null,
          cat.status === 'error' ? h('p', { className: 'dtk-error', role: 'alert' }, t('loadFailed'), ' ', h('button', { type: 'button', onClick: catalog.load }, t('retry'))) : null,
          cat.partial ? h('p', { className: 'dtk-note' }, t('partial')) : null,
          TIERS.map((tier) => h(TierFields, {
            key: tier, t, tier, route: values[tier], catalog: cat, disabled,
            customized: tier in user,
            onChange: (route) => edit(tier, route),
          })),
          h('div', { className: 'dtk-guard' },
            h('div', null, h('span', null, t('guard')), h('p', { className: 'dtk-help' }, t('guardHelp'))),
            primitives?.Switch
              ? h(primitives.Switch, { checked: values.guardWorker, label: t('guard'), disabled, onChange: (checked) => edit('guardWorker', typeof checked === 'boolean' ? checked : !values.guardWorker) })
              : h('input', { type: 'checkbox', checked: values.guardWorker, disabled, onChange: () => edit('guardWorker', !values.guardWorker) })),
          !writable ? h('p', { className: 'dtk-note' }, t('readOnly')) : null,
          conflicted ? h('p', { className: 'dtk-error', role: 'status' }, t('conflict')) : null,
          failed ? h('p', { className: 'dtk-error', role: 'alert' }, t('saveFailed')) : null,
          h('div', { className: 'dtk-actions' },
            Object.keys(user).some((k) => FIELDS.includes(k))
              ? h('button', { type: 'button', className: 'dtk-btn', disabled: disabled || dirty, onClick: resetAll }, t('resetAll'))
              : null,
            h('button', { type: 'button', className: 'dtk-btn', disabled: !dirty || saving, onClick: discard }, t('discard')),
            h('button', { type: 'button', className: 'dtk-btn', 'data-primary': true, disabled: !dirty || conflicted || disabled, onClick: save }, saving ? t('saving') : t('save'))))
        return body
      }
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.session', 'configForms'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(LOCALE, { zh, en }), 'dsh-tier-kit: dictionaries')
        const form = ctx.configForms.get(NS)
        const catalog = createCatalog(ctx)
        ctx.effect(() => ctx.remote.$on('llm/adapters-updated', () => { catalog.load() }), 'dsh-tier-kit: adapter invalidations')
        ctx.effect(() => ctx.on('connection/reset', () => { catalog.load() }), 'dsh-tier-kit: reconnect')
        const Inner = makePage(ctx, form, catalog)
        const Page = (props) => h(Boundary, null, h(Inner, props))
        // Same shape as the official cot-translation bundle page: name, key, locale.
        ctx.effect(() => ctx.configForms.whileServed([NS], () => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config',
          key: PKG,
          locale: LOCALE,
        }, Page))), 'dsh-tier-kit: plugins page')
      },
    }
  },
})
