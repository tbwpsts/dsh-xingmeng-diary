/**
 * dsh-xingmeng-diary —— 设置页「心情日记」。
 *
 * 只读：所有内容都来自 host 的 /api/xingmeng-diary/entries，
 * 客户端不碰文件，也不写日记。
 */
window.__ModuleLoader__.load({
  id: 'dsh-xingmeng-diary',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useState } = React;
    const API = '/api/xingmeng-diary';

    const CSS = `
[data-sd-page]{display:flex;flex-direction:column;gap:16px;max-width:860px;min-height:160px;padding:16px;border-radius:14px;
  background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.06));color:var(--dsw-alias-label-primary,inherit);}
[data-sd-hero]{display:flex;flex-direction:column;gap:6px;padding:18px 18px 16px;border-radius:14px;
  background:linear-gradient(135deg,var(--dsw-alias-bg-layer-2,rgba(127,127,127,.09)),var(--dsw-alias-bg-layer-1,rgba(127,127,127,.05)));
  border:1px solid var(--dsw-alias-bg-layer-3,rgba(127,127,127,.16));}
[data-sd-title]{display:flex;align-items:center;gap:9px;font-size:17px;font-weight:680;letter-spacing:.01em;}
[data-sd-title] svg{flex:none;opacity:.92;}
[data-sd-sub]{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-sd-chips]{display:flex;flex-wrap:wrap;gap:8px;margin-top:2px;}
[data-sd-chip]{font-size:11px;line-height:18px;padding:2px 9px;border-radius:999px;
  background:var(--dsw-alias-bg-layer-4,rgba(127,127,127,.12));color:var(--dsw-alias-label-secondary,inherit);
  border:1px solid var(--dsw-alias-bg-layer-3,rgba(127,127,127,.14));}
[data-sd-chip][data-good]{color:#4ade80;border-color:rgba(74,222,128,.28);background:rgba(74,222,128,.08);}
[data-sd-toolbar]{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
[data-sd-btn]{padding:6px 12px;border-radius:8px;font-size:12px;font-family:inherit;cursor:pointer;white-space:nowrap;
  color:inherit;border:1px solid var(--dsw-alias-bg-layer-3,rgba(127,127,127,.25));
  background:var(--dsw-alias-bg-layer-4,rgba(127,127,127,.1));transition:background .15s;}
[data-sd-btn]:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.2));}
[data-sd-btn][disabled]{opacity:.5;cursor:default;}
[data-sd-path]{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;line-height:16px;
  color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-sd-path] code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10.5px;
  padding:3px 7px;border-radius:6px;background:rgba(0,0,0,.16);color:var(--dsw-alias-label-secondary,inherit);
  word-break:break-all;}
[data-sd-copy]{padding:2px 8px;border-radius:6px;font-size:10.5px;cursor:pointer;font-family:inherit;
  color:inherit;border:1px solid var(--dsw-alias-bg-layer-3,rgba(127,127,127,.22));background:transparent;}
[data-sd-copy]:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.16));}
[data-sd-days]{display:flex;flex-direction:column;gap:14px;}
[data-sd-day]{display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:12px;
  background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.07));
  border:1px solid var(--dsw-alias-bg-layer-3,rgba(127,127,127,.14));}
[data-sd-dayhead]{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;
  padding-bottom:8px;border-bottom:1px dashed var(--dsw-alias-bg-layer-3,rgba(127,127,127,.2));}
[data-sd-date]{font-size:13px;font-weight:650;letter-spacing:.02em;}
[data-sd-week]{font-size:11px;color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-sd-today]{font-size:10px;line-height:16px;padding:0 7px;border-radius:999px;
  color:#93c5fd;background:rgba(96,165,250,.13);border:1px solid rgba(96,165,250,.22);}
[data-sd-count]{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-sd-entry]{display:flex;gap:12px;padding:2px 0 4px;}
[data-sd-time]{flex:none;width:42px;padding-top:2px;font-size:11px;font-variant-numeric:tabular-nums;
  color:var(--dsw-alias-label-tertiary,#9aa0a6);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;}
[data-sd-main]{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;}
[data-sd-mood]{display:inline-flex;align-items:center;gap:5px;align-self:flex-start;font-size:10.5px;line-height:17px;
  padding:1px 8px 1px 6px;border-radius:999px;color:var(--dsw-alias-label-secondary,inherit);
  background:var(--dsw-alias-bg-layer-4,rgba(127,127,127,.1));}
[data-sd-dot]{width:6px;height:6px;border-radius:50%;flex:none;}
[data-sd-text]{font-size:12.5px;line-height:1.85;color:var(--dsw-alias-label-primary,inherit);
  white-space:pre-wrap;word-break:break-word;}
[data-sd-empty]{display:flex;flex-direction:column;align-items:center;gap:8px;padding:34px 16px;text-align:center;
  font-size:12px;line-height:19px;color:var(--dsw-alias-label-tertiary,#9aa0a6);}
[data-sd-empty] b{font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary,inherit);}
[data-sd-msg]{font-size:12px;line-height:18px;padding:9px 11px;border-radius:8px;
  background:var(--dsw-alias-bg-layer-4,rgba(127,127,127,.12));color:var(--dsw-alias-label-secondary,inherit);}
[data-sd-msg][data-bad]{color:#f87171;}
[data-sd-foot]{font-size:10.5px;line-height:16px;color:var(--dsw-alias-label-tertiary,#9aa0a6);}
@media(max-width:560px){
  [data-sd-page]{padding:10px;}
  [data-sd-hero]{padding:14px;}
  [data-sd-day]{padding:12px;}
  [data-sd-entry]{gap:8px;}
  [data-sd-time]{width:36px;}
}
`;

    async function fetchEntries(limit) {
      const res = await fetch(`${API}/entries?limit=${encodeURIComponent(limit)}`, {
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      });
      let body = null;
      try {
        body = await res.json();
      } catch {
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok || body?.ok === false) throw new Error(body?.error || `HTTP ${res.status}`);
      return body;
    }

    function moodHue(mood) {
      const text = String(mood || '');
      let hash = 0;
      for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) % 360;
      return hash;
    }

    class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }
      static getDerivedStateFromError(error) {
        return { error };
      }
      render() {
        if (this.state.error) {
          return h('div', { 'data-sd-msg': '', 'data-bad': '' },
            `心情日记页面出错了：${this.state.error.message || String(this.state.error)}`);
        }
        return this.props.children;
      }
    }

    function BookIcon() {
      return h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: 'M5 4.5h9.5A2.5 2.5 0 0 1 17 7v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5Z',
          stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round',
        }),
        h('path', { d: 'M17 7h1.5A1.5 1.5 0 0 1 20 8.5V19a1.5 1.5 0 0 1-1.5 1.5H8', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }),
        h('path', { d: 'M8.2 8.4c.8-.9 2.2-.9 3 0 .8-.9 2.2-.9 3 0' , stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }),
        h('path', { d: 'M9 12.4h5.2M9 15.2h3.6', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }));
    }

    function Panel() {
      const [state, setState] = useState({ loading: true, busy: false, error: '', data: null, limit: 14 });
      const [copied, setCopied] = useState(false);

      const load = useCallback(async (limit, mode) => {
        setState((prev) => ({ ...prev, busy: mode === 'refresh' || mode === 'more', error: mode === 'refresh' || mode === 'more' ? prev.error : '' }));
        try {
          const body = await fetchEntries(limit);
          setState({ loading: false, busy: false, error: '', data: body, limit });
        } catch (error) {
          setState((prev) => ({ ...prev, loading: false, busy: false, error: error?.message || String(error) }));
        }
      }, []);

      useEffect(() => {
        load(14, 'initial');
      }, [load]);

      const meta = state.data?.meta || null;
      const days = state.data?.days || [];
      const loadedDays = Number(state.data?.loadedDays || 0);
      const totalDays = Number(state.data?.totalDays || 0);

      const copyPath = async () => {
        if (!meta?.path) return;
        try {
          await navigator.clipboard.writeText(meta.path);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      };

      return h('div', { 'data-sd-page': '' },
        h('div', { 'data-sd-hero': '' },
          h('div', { 'data-sd-title': '' }, h(BookIcon), '心情日记'),
          h('div', { 'data-sd-sub': '' }, '和 master 一起过的点滴，还有那些细小的心情变化。写在一个文档里，慢慢攒。'),
          meta
            ? h('div', { 'data-sd-chips': '' },
              meta.hasToday
                ? h('span', { 'data-sd-chip': '', 'data-good': '' }, `今天已写 ${meta.todayCount} 条`)
                : h('span', { 'data-sd-chip': '' }, '今天还没写'),
              h('span', { 'data-sd-chip': '' }, `连续 ${meta.streak} 天`),
              h('span', { 'data-sd-chip': '' }, `共 ${meta.totalEntries} 篇 · ${meta.totalDays} 天`))
            : null,
          meta
            ? h('div', { 'data-sd-path': '' },
              h('code', {}, meta.path),
              h('button', { 'data-sd-copy': '', type: 'button', onClick: copyPath }, copied ? '已复制' : '复制路径'))
            : null),

        h('div', { 'data-sd-toolbar': '' },
          h('button', {
            'data-sd-btn': '',
            type: 'button',
            disabled: state.busy,
            onClick: () => load(state.limit, 'refresh'),
          }, state.busy ? '正在翻…' : '刷新'),
          totalDays > loadedDays
            ? h('button', {
              'data-sd-btn': '',
              type: 'button',
              disabled: state.busy,
              onClick: () => load(Math.min(3650, state.limit + 14), 'more'),
            }, '加载更早的日记')
            : null),

        state.loading
          ? h('div', { 'data-sd-msg': '' }, '正在翻开日记…')
          : null,
        state.error
          ? h('div', { 'data-sd-msg': '', 'data-bad': '' },
            `读不出来：${state.error}`,
            h('button', {
              'data-sd-copy': '',
              type: 'button',
              style: { marginLeft: 8 },
              onClick: () => load(state.limit, 'refresh'),
            }, '再试一次'))
          : null,

        !state.loading && !state.error && !days.length
          ? h('div', { 'data-sd-empty': '' },
            h('b', {}, '日记还是空的'),
            h('span', {}, '等今天有值得留住的片段，我会把它写进来的。'))
          : null,

        days.length
          ? h('div', { 'data-sd-days': '' }, days.map((day) => h('section', { key: day.date, 'data-sd-day': '' },
            h('div', { 'data-sd-dayhead': '' },
              h('span', { 'data-sd-date': '' }, day.date),
              h('span', { 'data-sd-week': '' }, day.weekday),
              day.date === meta?.today ? h('span', { 'data-sd-today': '' }, '今天') : null,
              h('span', { 'data-sd-count': '' }, `${day.entries.length} 条`)),
            day.entries.map((entry, index) => h('div', { key: `${day.date}-${entry.time}-${index}`, 'data-sd-entry': '' },
              h('div', { 'data-sd-time': '' }, entry.time),
              h('div', { 'data-sd-main': '' },
                entry.mood
                  ? h('span', { 'data-sd-mood': '' },
                    h('i', {
                      'data-sd-dot': '',
                      style: { background: `hsl(${moodHue(entry.mood)} 62% 58%)` },
                    }),
                    entry.mood)
                  : null,
                h('div', { 'data-sd-text': '' }, entry.text)))))))
          : null,

        h('div', { 'data-sd-foot': '' },
          '日记只存在本机。想直接看原文，用上面那个路径打开 Markdown 文档就行；这里只负责把它翻给你。'));
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const style = document.createElement('style');
        style.setAttribute('data-plugin-css', 'dsh-xingmeng-diary');
        style.textContent = CSS;
        document.head.appendChild(style);
        ctx.effect(() => () => style.remove(), 'dsh-xingmeng-diary: 设置页样式');

        const slots = (typeof ctx.get === 'function' ? ctx.get('slots') : undefined) || ctx.slots;
        if (!slots) return;
        slots.inject('settings.section', () => slots.register(
          { name: 'settings.section', id: 'xingmeng-diary', order: 32, label: '心情日记' },
          () => h(ErrorBoundary, null, h(Panel)),
        ));
      },
    };
  },
});
