import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { apply } from './index.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xingmeng-diary-plugin-'));
const dir = path.join(root, 'diary');

const disposers = [];
const tools = new Map();
const logs = [];
let section = null;
let route = null;

const ctx = {
  logger: { info: (message) => logs.push(String(message)) },
  effect(fn, label) {
    const dispose = fn();
    disposers.push({ label, dispose });
    return dispose;
  },
  tools: {
    register(def) {
      tools.set(def.name, def);
      return () => tools.delete(def.name);
    },
  },
  systemPrompt: {
    section(def) {
      section = def;
      return () => { section = null; };
    },
  },
  webServer: {
    register(def) {
      route = def;
      return () => { route = null; };
    },
  },
  get(name) {
    if (name === 'connection') {
      return {
        // 模拟 DSH 的 Host/Origin 栅栏：这台机器上放行，外部来源拒绝。
        requestRejection({ headers }) {
          const origin = String(headers?.origin || '');
          return !origin || origin.startsWith('http://127.0.0.1') ? undefined : 403;
        },
      };
    }
    return undefined;
  },
};

function jsonResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers || {};
    },
    end(body) {
      this.body = body || '';
    },
  };
}

try {
  apply(ctx, { dir });

  // 工具注册
  assert.deepEqual([...tools.keys()].sort(), ['diary_read', 'diary_status', 'diary_write']);
  for (const def of tools.values()) {
    assert.equal(def.parameters.type, 'object');
    assert.equal(typeof def.execute, 'function');
    assert.equal(typeof def.output.render, 'function');
    assert.equal(def.output.schema.type, 'string');
  }

  // 写
  const write = tools.get('diary_write');
  const message = write.execute({
    content: '今天 master 让我把日记做成插件。我一边怕做不好，一边又有点偷偷高兴。',
    mood: '紧张又雀跃',
  });
  assert.match(message, /^已记下：\d{4}-\d{2}-\d{2} \d{2}:\d{2} · 紧张又雀跃/);

  // 读
  const read = tools.get('diary_read');
  const text = read.execute({ days: 1 });
  assert.match(text, /紧张又雀跃/);
  assert.match(text, /今天 master 让我把日记做成插件/);

  // 状态
  const status = tools.get('diary_status').execute({});
  assert.match(status, /心情日记：/);
  assert.match(status, /已写 1 条/);

  // 系统提示词
  assert.ok(section, '应注册提示词段');
  assert.equal(section.name, 'xingmeng-diary/status');
  assert.equal(section.interpolate, false);
  const prompt = section.text();
  assert.match(prompt, /## 心情日记/);
  assert.match(prompt, /diary_write/);
  assert.match(prompt, /不是工作日志/);
  assert.match(prompt, /悲欢喜乐/);
  assert.match(prompt, /今天已经写了 1 条/);
  assert.ok(prompt.includes(path.join(dir, '心情日记.md')));

  // 设置页接口：正常同源
  assert.equal(route.kind, 'prefix');
  assert.equal(route.path, '/api/xingmeng-diary');
  const req = { method: 'GET', url: '/api/xingmeng-diary/entries?limit=14', headers: { host: '127.0.0.1:49254', origin: 'http://127.0.0.1:49254' } };
  const res = jsonResponse();
  await route.handler(req, res);
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.meta.totalEntries, 1);
  assert.equal(body.days.length, 1);
  assert.equal(body.days[0].entries[0].mood, '紧张又雀跃');
  assert.match(body.meta.path, /心情日记\.md$/);

  // 设置页接口：外部来源
  const badRes = jsonResponse();
  await route.handler({ method: 'GET', url: '/api/xingmeng-diary/entries', headers: { host: '127.0.0.1:49254', origin: 'http://evil.example' } }, badRes);
  assert.equal(badRes.statusCode, 403);

  // 未知路径
  const missRes = jsonResponse();
  await route.handler({ method: 'GET', url: '/api/xingmeng-diary/nope', headers: { host: '127.0.0.1:49254', origin: 'http://127.0.0.1:49254' } }, missRes);
  assert.equal(missRes.statusCode, 404);

  // 工具参数错误返回可读提示，不抛异常
  assert.match(write.execute({ content: '   ' }), /没写成：日记正文是空的/);
  assert.match(write.execute({ content: 'x', date: '2099-01-01' }), /没写成：不能写未来的日记/);

  console.log('test-plugin: 全部通过');
  console.log(`  工具：${[...tools.keys()].join(' / ')}`);
  console.log(`  提示词段：${prompt.length} 字`);
  console.log(`  日志：${logs[0] || '(none)'}`);
} finally {
  for (const entry of disposers) {
    try { entry.dispose?.(); } catch { /* 清理失败不影响测试 */ }
  }
  fs.rmSync(root, { recursive: true, force: true });
}
