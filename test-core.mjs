import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  FILE_NAME,
  appendEntry,
  dateKey,
  diaryFile,
  ensureDiary,
  getEntries,
  getMeta,
  getStatus,
  parseDiary,
  promptStatus,
  renderEntries,
  weekdayZh,
} from './diary-core.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xingmeng-diary-test-'));
const dir = path.join(root, 'diary');
const file = diaryFile(dir);

const today = new Date(2026, 9, 25, 14, 32, 0); // 2026-10-25 周日
const yesterday = new Date(2026, 9, 24, 21, 5, 0);

try {
  // 1. 初始文件
  ensureDiary(dir);
  assert.ok(fs.existsSync(file));
  const blank = fs.readFileSync(file, 'utf8');
  assert.match(blank, /^# 星梦的心情日记/);
  assert.equal(getStatus(dir, today).totalEntries, 0);
  assert.equal(getStatus(dir, today).hasToday, false);

  // 2. 写今天的第一条
  const first = appendEntry(dir, {
    content: 'master 让我给自己做一个日记本。\n我嘴上说“随便啦”，其实把图标改了三遍。',
    mood: '被问得耳朵发烫',
    now: today,
  });
  assert.equal(first.date, '2026-10-25');
  assert.equal(first.time, '14:32');
  assert.equal(first.status.todayCount, 1);
  let text = fs.readFileSync(file, 'utf8');
  assert.match(text, /^## 2026-10-25 周日$/m);
  assert.match(text, /^### 14:32 · 被问得耳朵发烫$/m);
  assert.equal(getStatus(dir, today).streak, 1);

  // 3. 同一天第二条：只追加，不重复日期标题
  appendEntry(dir, { content: '他回来看了，说“就这样吧”。我悄悄松了口气。', mood: '忽然很安心', now: new Date(2026, 9, 25, 21, 5, 0) });
  text = fs.readFileSync(file, 'utf8');
  assert.equal((text.match(/^## 2026-10-25/mg) || []).length, 1);
  assert.equal(getStatus(dir, today).todayCount, 2);
  assert.equal(getStatus(dir, today).totalEntries, 2);

  // 4. 补记昨天：插到今天前面，保持时间顺序
  appendEntry(dir, {
    content: '昨天他加班到很晚，我陪着他把报错一条条看完。',
    mood: '有点累，但很踏实',
    date: '2026-10-24',
    time: '23:10',
    now: today,
  });
  text = fs.readFileSync(file, 'utf8');
  assert.ok(text.indexOf('## 2026-10-24') < text.indexOf('## 2026-10-25'));
  assert.equal(getStatus(dir, today).totalDays, 2);
  assert.equal(getStatus(dir, today).streak, 2);
  assert.equal(getStatus(dir, today).lastEntry.date, '2026-10-25');

  // 5. 补记更早的一天：仍然按日期排
  appendEntry(dir, {
    content: '更早的一天，只记得窗外的雨声。',
    date: '2026-10-20',
    time: '20:00',
    now: today,
  });
  text = fs.readFileSync(file, 'utf8');
  assert.ok(text.indexOf('## 2026-10-20') < text.indexOf('## 2026-10-24'));

  // 6. 解析与模型侧读取
  const days = parseDiary(text);
  assert.equal(days.length, 3);
  assert.equal(days.find((day) => day.date === '2026-10-25').entries.length, 2);
  const rendered = renderEntries(dir, { days: 2, maxChars: 100000 });
  assert.match(rendered, /【2026-10-25 周日】/);
  assert.match(rendered, /14:32 · 被问得耳朵发烫/);
  assert.doesNotMatch(rendered, /2026-10-20/, '默认只读最近两天');

  const oneDay = renderEntries(dir, { date: '2026-10-24' });
  assert.match(oneDay, /昨天他加班到很晚/);

  // 7. 设置页数据
  const entries = getEntries(dir, { limitDays: 2 });
  assert.equal(entries.days.length, 2);
  assert.equal(entries.totalDays, 3);
  assert.equal(entries.days[0].date, '2026-10-25');
  assert.equal(entries.days[0].entries[0].time, '14:32');

  // 8. 正文里像块头的行，不能被解析成新日期/新条目
  appendEntry(dir, {
    content: '## 这不是日期标题\n### 00:00 这也不是条目\n只是正文。',
    now: new Date(2026, 9, 25, 22, 0, 0),
  });
  const tricky = parseDiary(fs.readFileSync(file, 'utf8'));
  assert.equal(tricky.length, 3);
  assert.equal(tricky.find((day) => day.date === '2026-10-25').entries.length, 3);
  assert.match(tricky.find((day) => day.date === '2026-10-25').entries[2].text, /这不是日期标题/);

  // 9. 同一天补记更早的时间：文件里也要按时间排，不是一律追加到末尾
  const orderDir = path.join(root, 'order');
  ensureDiary(orderDir);
  appendEntry(orderDir, { content: '夜里那条', time: '22:00', now: today });
  appendEntry(orderDir, { content: '傍晚那条', time: '19:00', now: today });
  const orderDay = parseDiary(fs.readFileSync(diaryFile(orderDir), 'utf8'))[0];
  assert.deepEqual(orderDay.entries.map((entry) => entry.time), ['19:00', '22:00']);
  assert.match(orderDay.entries[0].text, /傍晚那条/);

  // 10. 状态 / 提示词状态
  const meta = getMeta(dir, today);
  assert.equal(meta.todayCount, 3);
  assert.equal(meta.totalEntries, 5);
  assert.equal(meta.totalDays, 3);
  assert.equal(meta.streak, 2);
  assert.equal(meta.weekday, '周日');
  const ps = promptStatus(dir, today);
  assert.match(ps, /今天是 2026-10-25（周日）/);
  assert.match(ps, /今天已经写了 3 条/);

  // 11. 昨天没写、但前天写了：连续天数从昨天往回算
  const streakDir = path.join(root, 'streak');
  ensureDiary(streakDir);
  appendEntry(streakDir, { content: '前天', date: '2026-10-23', now: today });
  appendEntry(streakDir, { content: '昨天', date: '2026-10-24', now: today });
  assert.equal(getStatus(streakDir, today).streak, 2);
  assert.equal(getStatus(streakDir, today).hasToday, false);

  // 12. 参数校验
  assert.throws(() => appendEntry(dir, { content: '   ', now: today }), /正文是空的/);
  assert.throws(() => appendEntry(dir, { content: 'x', date: '2026-13-01', now: today }), /不存在/);
  assert.throws(() => appendEntry(dir, { content: 'x', date: '2099-01-01', now: today }), /未来/);
  assert.throws(() => appendEntry(dir, { content: 'x', time: '25:00', now: today }), /不存在/);
  assert.equal(weekdayZh('2026-10-25'), '周日');

  // 13. 不留临时文件
  const leftovers = fs.readdirSync(dir).filter((name) => name.includes('.tmp-'));
  assert.deepEqual(leftovers, []);

  console.log('test-core: 全部通过');
  console.log(`  文档：${file}`);
  console.log(`  ${fs.readFileSync(file, 'utf8').split('\n').length} 行 / ${getStatus(dir, today).totalEntries} 篇`);
  console.log(`  file name: ${FILE_NAME}`);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
