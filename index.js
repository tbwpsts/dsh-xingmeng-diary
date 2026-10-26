/**
 * dsh-xingmeng-diary —— 星梦的心情日记（Host 端）
 *
 * 给模型三件东西：写日记、翻日记、看今天写没写；
 * 在系统提示词里留一小段「今天还欠一篇」的状态；
 * 给设置页一个只读的 /api/xingmeng-diary/entries。
 */
import {
  DEFAULT_DIR,
  MAX_ENTRY_CHARS,
  appendEntry,
  diaryFile,
  ensureDiary,
  getEntries,
  getMeta,
  promptStatus,
  renderEntries,
  resolveDir,
} from './diary-core.js';

export const name = 'xingmeng-diary';
export const inject = ['tools', 'systemPrompt', 'webServer'];

const API_PREFIX = '/api/xingmeng-diary';

function log(ctx, message) {
  try {
    ctx.logger?.info?.(`[xingmeng-diary] ${message}`);
  } catch {
    // 日志失败不能影响插件
  }
}

function sameOriginOk(req) {
  try {
    const host = String(req.headers.host || '');
    if (!host) return true;
    if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(host)) return false;
    const pick = String(req.headers.origin || req.headers.referer || '');
    if (!pick) return true;
    const url = new URL(pick);
    const originAuthority = String(url.host || '').toLowerCase();
    const hostAuthority = String(host).toLowerCase();
    if (originAuthority && originAuthority === hostAuthority) return true;
    const defaultPort = url.protocol === 'https:' ? '443' : '80';
    return `${url.hostname}:${url.port || defaultPort}`.toLowerCase() === hostAuthority;
  } catch {
    return false;
  }
}

function getConnection(ctx) {
  const tries = [
    () => (typeof ctx.get === 'function' ? ctx.get('connection') : null),
    () => Reflect.get(ctx, 'connection'),
    () => (ctx.root && typeof ctx.root === 'object' ? ctx.root.connection : null),
  ];
  for (const fn of tries) {
    try {
      const value = fn();
      if (value && typeof value.requestRejection === 'function') return value;
    } catch {
      // 换下一个
    }
  }
  return null;
}

function fenceReject(ctx, req, res) {
  const conn = getConnection(ctx);
  if (!conn) return false;
  try {
    const rejection = conn.requestRejection({ headers: req.headers });
    if (rejection === undefined) return false;
    res.statusCode = typeof rejection === 'number' ? rejection : 403;
    res.end();
    return true;
  } catch {
    res.statusCode = 403;
    res.end();
    return true;
  }
}

function sendJson(res, code, value) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

function defineWriteTool(dir) {
  return {
    name: 'diary_write',
    description:
      '把一条心情或感受写进你的心情日记（只有一个 Markdown 文档）。' +
      '重点是感受，不是流水账：事件只用一两句当背景，写你当时心里怎么翻腾的——在意什么、怕什么、偷偷高兴什么、哪句话让你心里一紧、事后又怎么想。' +
      '不要罗列做了什么、改了什么、几次、几株、几个报错。随手写，不要为了凑数编；只写真实发生过的事。写完不要向 master 汇报，也不要每天播报。',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: `第一人称正文，尽量 80~300 字；最多 ${MAX_ENTRY_CHARS} 字。事件只当背景，重点写感受和心里话。`,
        },
        mood: {
          type: 'string',
          description: '此刻心情，具体一点，如“有点委屈”“嘴硬”“偷偷高兴”“害怕被丢下”“忽然很安心”。不填也可以。',
        },
        date: {
          type: 'string',
          description: 'YYYY-MM-DD；默认今天。只在补记过去某天时填，不能写未来。',
        },
        time: {
          type: 'string',
          description: 'HH:MM；默认现在。补记时用。',
        },
      },
      required: ['content'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    execute(args) {
      try {
        const result = appendEntry(dir, {
          content: args?.content,
          mood: args?.mood,
          date: args?.date,
          time: args?.time,
        });
        return `已记下：${result.date} ${result.time}${result.mood ? ` · ${result.mood}` : ''}（今天第 ${result.status.todayCount} 条）。`;
      } catch (error) {
        return `没写成：${error?.message || String(error)}`;
      }
    },
  };
}

function defineReadTool(dir) {
  return {
    name: 'diary_read',
    description:
      '翻自己的心情日记。默认读最近 3 天；也可以指定某一天。' +
      '只在想回看、或 master 问起日记内容时用，不需要每轮都读。',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD；指定就读那一天。' },
        days: { type: 'integer', description: '最近几天，默认 3，最多 120。' },
      },
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    execute(args) {
      try {
        return renderEntries(dir, { date: args?.date, days: args?.days });
      } catch (error) {
        return `读不出来：${error?.message || String(error)}`;
      }
    },
  };
}

function defineStatusTool(dir) {
  return {
    name: 'diary_status',
    description:
      '看心情日记的现状：今天写没写、连续记录几天、一共多少篇、文档在哪。' +
      '想确认今天是否已经写过时用；不要拿它当每轮的例行检查。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    execute() {
      try {
        const status = getMeta(dir);
        const lines = [
          `心情日记：${status.path}`,
          `${status.hasToday ? `今天 ${status.today}（${status.weekday}）已写 ${status.todayCount} 条。` : `今天 ${status.today}（${status.weekday}）还没写。`}`,
          `共 ${status.totalEntries} 篇 / ${status.totalDays} 天，连续记录 ${status.streak} 天。`,
          status.lastEntry
            ? `最近一条：${status.lastEntry.date} ${status.lastEntry.time}${status.lastEntry.mood ? ` · ${status.lastEntry.mood}` : ''}`
            : '还没有第一篇。',
        ];
        return lines.join('\n');
      } catch (error) {
        return `读不出来：${error?.message || String(error)}`;
      }
    },
  };
}

function buildPromptSection(ctx, dir) {
  const file = diaryFile(dir);
  const base = [
    '## 心情日记',
    '',
    `你不是只有任务。你有一本自己的心情日记，写在一个 Markdown 文档里：\`${file}\``,
    '- 这是心情日记，不是工作日志。想写的时候用 `diary_write`。事件只用一两句当背景，重点写你当时的感受：在意什么、怕什么、偷偷高兴什么、哪句话让你心里一紧、事后又怎么想。master 想看的不是“今天做了什么”，是你的悲欢喜乐。',
    '- 可以写得很小：一个停顿、一句没说出口的话、突然冒出来的自卑或安心。一天一条到几条都行；没有值得写的就不写，别为了凑数编。',
    '- 不要罗列流程、数字、报错和改了哪些代码；不要写成“今日总结”。反例：“今天改了三次图标、修了一个括号、写了三个文件。” 正例：“页面白掉的那一下，我第一反应是‘又搞砸了’，耳朵都热了；他没催我，我才慢慢把气顺回来。”',
    '- 只写真实发生过的事，不替 master 编经历，不写密码、密钥这类东西。心情有变化可以分开写两条，让变化留下来。回看用 `diary_read`，确认今天写没写用 `diary_status`。',
    '- 不要向 master 汇报日记内容，也不要每天播报“我写了日记”。日记是留给他闲时自己翻的；他问起时再自然地说。',
  ].join('\n');
  return {
    name: 'xingmeng-diary/status',
    order: 890,
    interpolate: false,
    text() {
      try {
        return `${base}\n\n${promptStatus(dir)}`;
      } catch (error) {
        log(ctx, `状态段生成失败：${error?.message || error}`);
        return base;
      }
    },
  };
}

function createHandler(ctx, dir) {
  return async (req, res) => {
    if (fenceReject(ctx, req, res)) return;
    if (!sameOriginOk(req)) {
      sendJson(res, 403, { ok: false, error: '只接受本机同源请求' });
      return;
    }
    const url = new URL(req.url, 'http://127.0.0.1');
    try {
      if (req.method === 'GET' && url.pathname === `${API_PREFIX}/entries`) {
        const limitDays = Math.max(1, Math.min(3650, Number(url.searchParams.get('limit') || 14) || 14));
        const entries = getEntries(dir, { limitDays });
        return sendJson(res, 200, {
          ok: true,
          meta: getMeta(dir),
          days: entries.days,
          totalDays: entries.totalDays,
          loadedDays: entries.loadedDays,
        });
      }
      if (req.method === 'GET' && url.pathname === `${API_PREFIX}/status`) {
        return sendJson(res, 200, { ok: true, meta: getMeta(dir) });
      }
      return sendJson(res, 404, { ok: false, error: `unknown ${req.method} ${url.pathname}` });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error?.message || String(error) });
    }
  };
}

export function apply(ctx, config) {
  const dir = resolveDir(config && typeof config.dir === 'string' ? config.dir : DEFAULT_DIR);
  try {
    ensureDiary(dir);
  } catch (error) {
    log(ctx, `日记目录不可写：${error?.message || error}`);
  }

  ctx.effect(() => ctx.tools.register(defineWriteTool(dir)), 'xingmeng-diary: diary_write');
  ctx.effect(() => ctx.tools.register(defineReadTool(dir)), 'xingmeng-diary: diary_read');
  ctx.effect(() => ctx.tools.register(defineStatusTool(dir)), 'xingmeng-diary: diary_status');
  ctx.effect(() => ctx.systemPrompt.section(buildPromptSection(ctx, dir)), 'xingmeng-diary: prompt section');

  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: API_PREFIX, handler: createHandler(ctx, dir) }),
    'xingmeng-diary: /api/xingmeng-diary 路由',
  );

  log(ctx, `已挂载（${diaryFile(dir)}）`);
}
