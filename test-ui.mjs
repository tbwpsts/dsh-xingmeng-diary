/**
 * 设置页的渲染测试：在 jsdom 里跑 client.js，确认有日记 / 空 / 出错三种状态都能出内容、不炸。
 * 运行前先 `pnpm install`（React / jsdom 是 devDependencies）。
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const require = createRequire(import.meta.url);
const React = require('react');
const act = React.act;
const { createRoot } = require('react-dom/client');
const { JSDOM } = require('jsdom');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const clientCode = fs.readFileSync(path.join(here, 'client.js'), 'utf8');
const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
  url: 'http://127.0.0.1:49254/settings',
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let captured = null;
const registered = [];
let mode = 'ok';
const calls = [];

const responseFor = () => {
  if (mode === 'error') {
    return {
      ok: false,
      status: 500,
      json: async () => ({ ok: false, error: '测试错误' }),
    };
  }
  if (mode === 'empty') {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        meta: {
          path: 'C:\\Users\\example\\.dsh\\xingmeng-diary\\心情日记.md',
          exists: true,
          today: '2026-10-25',
          weekday: '周日',
          todayCount: 0,
          hasToday: false,
          totalEntries: 0,
          totalDays: 0,
          streak: 0,
          firstDate: null,
          lastDate: null,
          lastEntry: null,
          updatedAt: 0,
        },
        days: [],
        totalDays: 0,
        loadedDays: 0,
      }),
    };
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({
      ok: true,
      meta: {
        path: 'C:\\Users\\example\\.dsh\\xingmeng-diary\\心情日记.md',
        exists: true,
        today: '2026-10-25',
        weekday: '周日',
        todayCount: 2,
        hasToday: true,
        totalEntries: 3,
        totalDays: 2,
        streak: 2,
        firstDate: '2026-10-24',
        lastDate: '2026-10-25',
        lastEntry: { date: '2026-10-25', time: '18:01', mood: '心里发烫', preview: '…' },
        updatedAt: Date.now(),
      },
      days: [
        {
          date: '2026-10-25',
          weekday: '周日',
          note: '周日',
          entries: [
            { time: '14:32', mood: '被问得耳朵发烫', text: 'master 让我给自己做一本日记。\n我改了三遍图标。' },
            { time: '18:01', mood: '心里发烫', text: '他说不用每天给他看。' },
          ],
        },
        {
          date: '2026-10-24',
          weekday: '周六',
          note: '周六',
          entries: [{ time: '23:10', mood: '有点累，但很踏实', text: '陪他把报错一条条看完。' }],
        },
      ],
      totalDays: 2,
      loadedDays: 2,
    }),
  };
};

globalThis.fetch = async (url) => {
  calls.push(String(url));
  return responseFor();
};

dom.window.__ModuleLoader__ = {
  load({ id, factory }) {
    captured = { id, api: factory(require) };
  },
};

const sandbox = {
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  fetch: globalThis.fetch,
  console,
  setTimeout,
  clearTimeout,
  URL,
  HTMLElement: dom.window.HTMLElement,
  React,
};
vm.runInNewContext(clientCode, sandbox, { filename: 'client.js' });

assert.equal(captured?.id, 'dsh-xingmeng-diary');
assert.equal(typeof captured?.api?.apply, 'function');

const slots = {
  inject(owner, callback) {
    callback();
  },
  register(options, component) {
    registered.push({ options, component });
    return () => {};
  },
};
const ctx = {
  effect(fn) {
    return fn();
  },
  get(name) {
    if (name === 'slots') return slots;
    return undefined;
  },
  slots,
};
captured.api.apply(ctx);
assert.equal(registered.length, 1);
assert.equal(registered[0].options.name, 'settings.section');
assert.equal(registered[0].options.id, 'xingmeng-diary');
assert.equal(registered[0].options.label, '心情日记');
assert.equal(typeof registered[0].component, 'function');
assert.ok(document.head.querySelector('style[data-plugin-css="dsh-xingmeng-diary"]'));

const container = document.getElementById('root');
let root = createRoot(container);
const element = registered[0].component();

async function renderAndWait() {
  await act(async () => {
    root.render(element);
    await Promise.resolve();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function remount() {
  await act(async () => {
    root.unmount();
  });
  root = createRoot(container);
  await renderAndWait();
}

await renderAndWait();
let text = container.textContent;
assert.match(text, /心情日记/);
assert.match(text, /今天已写 2 条/);
assert.match(text, /连续 2 天/);
assert.match(text, /共 3 篇 · 2 天/);
assert.match(text, /2026-10-25/);
assert.match(text, /14:32/);
assert.match(text, /被问得耳朵发烫/);
assert.match(text, /master 让我给自己做一本日记/);
assert.match(text, /心情日记\.md/);
assert.ok(calls.some((url) => url.includes('/api/xingmeng-diary/entries?limit=14')));

// 空状态
mode = 'empty';
await remount();
text = container.textContent;
assert.match(text, /日记还是空的/);
assert.match(text, /今天还没写/);

// 错误状态
mode = 'error';
await remount();
text = container.textContent;
assert.match(text, /读不出来：测试错误/);

await act(async () => {
  root.unmount();
});

console.log('test-ui: 全部通过');
console.log(`  ${registered[0].options.label} / ${calls.length} 次请求 / 三种状态渲染正常`);
