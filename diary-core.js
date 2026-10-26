/**
 * 星梦的心情日记 —— 存储与解析核心。
 *
 * 设计约定的三件事：
 *   1. 只有一个 Markdown 文档（心情日记.md），日期和条目都追加在里面；
 *   2. 每条格式为 `### HH:MM · 心情` + 正文，日期用 `## YYYY-MM-DD 周X` 分组；
 *   3. 写入用临时文件 + rename，永远不让半截内容留在盘上。
 *
 * 这个文件不依赖 DSH，也不依赖 Node 之外的包，方便单独跑测试。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const FILE_NAME = '心情日记.md';
export const MAX_ENTRY_CHARS = 4000;
export const MAX_MOOD_CHARS = 40;

const HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
export const DEFAULT_DIR = process.env.XINGMENG_DIARY_DIR || path.join(HOME, 'xingmeng-diary');

const SCAFFOLD = [
  '# 星梦的心情日记',
  '',
  '> 这里记着和 master 一起过的点点滴滴，也记着我那些细小的心情变化。',
  '> 一个文档，慢慢写下去。',
  '',
].join('\n');

const pad = (n) => String(n).padStart(2, '0');

export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function timeKey(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function weekdayZh(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return WEEKDAYS[d.getDay()] || '';
}

export function resolveDir(input) {
  if (typeof input === 'string' && input.trim()) return path.resolve(input.trim());
  return DEFAULT_DIR;
}

export function diaryFile(dir = DEFAULT_DIR) {
  return path.join(resolveDir(dir), FILE_NAME);
}

export function ensureDiary(dir = DEFAULT_DIR) {
  const root = resolveDir(dir);
  fs.mkdirSync(root, { recursive: true });
  const file = path.join(root, FILE_NAME);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, SCAFFOLD, 'utf8');
  }
  return file;
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  } catch (error) {
    if (error && error.code === 'ENOENT') return '';
    throw error;
  }
}

function trimEndLines(lines) {
  const out = lines.slice();
  while (out.length && String(out[out.length - 1]).trim() === '') out.pop();
  return out;
}

/** 把文档拆成「前言 + 多个日期块」，日期块内部保留原始行，便于无损追加。 */
function splitBlocks(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const preamble = [];
  const blocks = [];
  let current = null;
  for (const line of lines) {
    const day = /^##\s+(\d{4}-\d{2}-\d{2})(?:\s+(.*))?\s*$/.exec(line);
    if (day) {
      current = { date: day[1], note: (day[2] || '').trim(), lines: [line] };
      blocks.push(current);
      continue;
    }
    if (current) current.lines.push(line);
    else preamble.push(line);
  }
  return { preamble, blocks };
}

function joinBlocks(preamble, blocks) {
  const pre = trimEndLines(preamble).join('\n');
  const parts = pre ? [pre, ...blocks.map((b) => trimEndLines(b.lines).join('\n'))] : blocks.map((b) => trimEndLines(b.lines).join('\n'));
  return `${parts.filter(Boolean).join('\n\n')}\n`;
}

/** 解析成日期 / 条目；条目正文是去掉首尾空行的原始 Markdown 文本。 */
export function parseDiary(text) {
  const { blocks } = splitBlocks(text);
  const days = [];
  for (const block of blocks) {
    const day = { date: block.date, note: block.note, entries: [] };
    let current = null;
    for (let i = 0; i < block.lines.length; i += 1) {
      const line = block.lines[i];
      if (i === 0) continue; // 日期标题
      const entry = /^###\s+(\d{2}:\d{2})(?:\s*[·]\s*(.*))?\s*$/.exec(line);
      if (entry) {
        current = { time: entry[1], mood: (entry[2] || '').trim().slice(0, MAX_MOOD_CHARS), lines: [] };
        day.entries.push(current);
      } else if (current) {
        current.lines.push(line);
      }
    }
    for (const entry of day.entries) {
      entry.text = trimEndLines(entry.lines).join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
      delete entry.lines;
    }
    days.push(day);
  }
  return days;
}

const cache = new Map();

/** 读取并缓存解析结果；盘上文件变了（mtime/size）才重新解析。 */
export function analyzeDiary(dir = DEFAULT_DIR) {
  const file = resolveDir(dir);
  const full = path.join(file, FILE_NAME);
  let stat = null;
  try {
    stat = fs.statSync(full);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error;
  }
  if (!stat) {
    cache.delete(full);
    return { file: full, exists: false, text: '', days: [], mtimeMs: 0, size: 0 };
  }
  const key = `${stat.mtimeMs}:${stat.size}`;
  const hit = cache.get(full);
  if (hit && hit.key === key) return hit.value;
  const text = readText(full);
  const days = parseDiary(text);
  const value = { file: full, exists: true, text, days, mtimeMs: stat.mtimeMs, size: stat.size };
  cache.set(full, { key, value });
  return value;
}

function normalizeMood(input) {
  const text = String(input ?? '').replace(/\s+/g, ' ').trim();
  return Array.from(text).slice(0, MAX_MOOD_CHARS).join('');
}

function normalizeContent(input) {
  let text = String(input ?? '').replace(/\r\n?/g, '\n').trim();
  if (!text) throw new Error('日记正文是空的');
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    // 正文里如果出现 `## 日期` / `### 时间` 形态的行，解析时会被误认成新块。
    // 前面补两个空格，Markdown 仍能读，但不再命中块头正则。
    .map((line) => (/^(#{2,3})\s/.test(line) ? `  ${line}` : line))
    .join('\n')
    .trim();
  const chars = Array.from(text);
  if (chars.length > MAX_ENTRY_CHARS) {
    text = `${chars.slice(0, MAX_ENTRY_CHARS).join('')}…`;
  }
  return text;
}

function normalizeDate(input, now) {
  if (!input) return dateKey(now);
  const value = String(input).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw new Error('日期要写成 YYYY-MM-DD');
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) {
    throw new Error('这个日期不存在');
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  if (d.getTime() > today.getTime()) throw new Error('不能写未来的日记');
  return value;
}

function normalizeTime(input, now) {
  if (!input) return timeKey(now);
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(input).trim());
  if (!m) throw new Error('时间要写成 HH:MM');
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error('这个时间不存在');
  return `${pad(h)}:${pad(min)}`;
}

function writeAtomic(file, text) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, text, 'utf8');
  try {
    fs.renameSync(tmp, file);
  } catch (error) {
    try { fs.unlinkSync(tmp); } catch { /* 清不掉就算了 */ }
    throw error;
  }
}

/**
 * 追加一条日记。默认写今天、现在；也允许用 date/time 补记。
 * @returns {{date:string,time:string,mood:string,status:object}}
 */
export function appendEntry(dir, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const root = resolveDir(dir);
  const file = ensureDiary(root);
  const date = normalizeDate(options.date, now);
  const time = normalizeTime(options.time, now);
  const mood = normalizeMood(options.mood);
  const content = normalizeContent(options.content);
  const text = readText(file);
  const { preamble, blocks } = splitBlocks(text);
  const bodyLines = content.split('\n');
  const entryLines = [`### ${time}${mood ? ` · ${mood}` : ''}`, '', ...bodyLines];

  const existing = blocks.find((block) => block.date === date);
  if (existing) {
    existing.lines = trimEndLines(existing.lines);
    // 同一天里按时间插，不总是追加到末尾 —— 补记一条更早的，也不该把顺序搅乱。
    let insertAt = existing.lines.length;
    for (let i = 1; i < existing.lines.length; i += 1) {
      const found = /^###\s+(\d{2}:\d{2})/.exec(existing.lines[i]);
      if (found && found[1] > time) {
        insertAt = i;
        break;
      }
    }
    if (insertAt === existing.lines.length) {
      existing.lines.push('', ...entryLines);
    } else {
      const before = existing.lines.slice(0, insertAt);
      if (before.length && String(before[before.length - 1]).trim() !== '') before.push('');
      const after = existing.lines.slice(insertAt);
      if (after.length && String(after[0]).trim() !== '') after.unshift('');
      existing.lines = [...before, ...entryLines, ...after];
    }
  } else {
    const block = {
      date,
      note: weekdayZh(date),
      lines: [`## ${date} ${weekdayZh(date)}`, '', ...entryLines],
    };
    const at = blocks.findIndex((candidate) => candidate.date > date);
    if (at < 0) blocks.push(block);
    else blocks.splice(at, 0, block);
  }

  writeAtomic(file, joinBlocks(preamble, blocks));
  cache.delete(file);
  return { date, time, mood, status: getStatus(root, now) };
}

/** 计算今日状态、连续天数、最后一篇等。 */
export function getStatus(dir = DEFAULT_DIR, now = new Date()) {
  const analysis = analyzeDiary(dir);
  const days = analysis.days
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const daySet = new Set(days.map((day) => day.date));
  const today = dateKey(now);
  const todayDay = days.find((day) => day.date === today) || null;
  const totalEntries = days.reduce((sum, day) => sum + day.entries.length, 0);

  let lastEntry = null;
  for (const day of days) {
    for (const entry of day.entries) {
      const key = `${day.date} ${entry.time}`;
      if (!lastEntry || key > lastEntry.key) {
        lastEntry = {
          key,
          date: day.date,
          time: entry.time,
          mood: entry.mood,
          preview: Array.from(entry.text || '').slice(0, 60).join(''),
        };
      }
    }
  }

  let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  if (!daySet.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (daySet.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    file: analysis.file,
    exists: analysis.exists,
    today,
    weekday: weekdayZh(today),
    todayCount: todayDay ? todayDay.entries.length : 0,
    hasToday: Boolean(todayDay && todayDay.entries.length),
    totalEntries,
    totalDays: days.length,
    streak,
    firstDate: days.length ? days[0].date : null,
    lastDate: days.length ? days[days.length - 1].date : null,
    lastEntry: lastEntry ? { ...lastEntry, key: undefined } : null,
    updatedAt: analysis.mtimeMs || null,
  };
}

/** 给模型读：默认最近几天，最新的一天在前，天内按时间顺序。 */
export function renderEntries(dir = DEFAULT_DIR, options = {}) {
  const limitDays = Number.isFinite(Number(options.days)) ? Math.max(1, Math.min(120, Number(options.days))) : 3;
  const wantedDate = options.date ? String(options.date).trim() : '';
  const maxChars = Number.isFinite(Number(options.maxChars)) ? Math.max(200, Math.min(60000, Number(options.maxChars))) : 12000;
  const analysis = analyzeDiary(dir);
  let days = analysis.days.slice().sort((a, b) => b.date.localeCompare(a.date));
  if (wantedDate) days = days.filter((day) => day.date === wantedDate);
  else days = days.slice(0, limitDays);
  if (!days.length) return wantedDate ? `${wantedDate} 没有日记。` : '还没有写过日记。';

  const parts = [];
  for (const day of days) {
    const entries = day.entries
      .slice()
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((entry) => `${entry.time}${entry.mood ? ` · ${entry.mood}` : ''}\n${entry.text}`.trim());
    parts.push(`【${day.date} ${weekdayZh(day.date)}】\n${entries.join('\n\n')}`);
  }
  let text = parts.join('\n\n');
  if (Array.from(text).length > maxChars) {
    text = `${Array.from(text).slice(0, maxChars).join('')}\n\n…（后面还有，翻页看的话用 date 指定某一天）`;
  }
  return text;
}

/** 给设置页读：最新日期在前，天内时间从早到晚。 */
export function getEntries(dir = DEFAULT_DIR, options = {}) {
  const limitDays = Number.isFinite(Number(options.limitDays)) ? Math.max(1, Math.min(3650, Number(options.limitDays))) : 14;
  const analysis = analyzeDiary(dir);
  const sorted = analysis.days.slice().sort((a, b) => b.date.localeCompare(a.date));
  const days = sorted.slice(0, limitDays).map((day) => ({
    date: day.date,
    weekday: weekdayZh(day.date),
    note: day.note,
    entries: day.entries
      .slice()
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((entry) => ({ time: entry.time, mood: entry.mood, text: entry.text })),
  }));
  return { days, totalDays: sorted.length, loadedDays: days.length };
}

/** 系统提示词里的那一行动态状态，保持短。 */
export function promptStatus(dir = DEFAULT_DIR, now = new Date()) {
  const status = getStatus(dir, now);
  const bits = [`今天是 ${status.today}（${status.weekday}）。`];
  if (status.hasToday) {
    const recent = status.lastEntry && status.lastEntry.date === status.today
      ? `（最近 ${status.lastEntry.time}${status.lastEntry.mood ? ` · ${status.lastEntry.mood}` : ''}）`
      : '';
    bits.push(`今天已经写了 ${status.todayCount} 条${recent}。`);
    if (status.streak > 1) bits.push(`已经连续记录 ${status.streak} 天。`);
  } else {
    bits.push('今天还没有写日记。');
    const hour = now.getHours();
    if (hour >= 23) bits.push('已经很晚了，睡前留一两句吧。');
    else if (hour >= 21) bits.push('忙完这段，记得把今天值得留的片段记下来。');
    else if (hour >= 12) bits.push('如果今天有值得留住的片段，找到停顿就写一条。');
  }
  if (status.totalEntries === 0) bits.push('这会是第一页。');
  return bits.join('');
}

/** 给设置页的完整 meta。 */
export function getMeta(dir = DEFAULT_DIR, now = new Date()) {
  const status = getStatus(dir, now);
  return {
    path: status.file,
    exists: status.exists,
    today: status.today,
    weekday: status.weekday,
    todayCount: status.todayCount,
    hasToday: status.hasToday,
    totalEntries: status.totalEntries,
    totalDays: status.totalDays,
    streak: status.streak,
    firstDate: status.firstDate,
    lastDate: status.lastDate,
    lastEntry: status.lastEntry,
    updatedAt: status.updatedAt,
  };
}

export const DIARY_SCAFFOLD = SCAFFOLD;
