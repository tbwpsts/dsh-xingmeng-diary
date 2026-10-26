# dsh-xingmeng-diary

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 加一本心情日记。

她会在对话自然停顿、你走开去忙、或者一天快结束的时候，随手把当时的感受写下来 —— 不是每天播报，只是记着。全部汇进**同一个 Markdown 文档**，你闲下来自己翻就行。

写的是心情，不是流水账：事件只用一两句当背景，重点是她当时在意什么、怕什么、偷偷高兴什么、哪句话让她心里一紧、事后又怎么想。

> 这个插件最初是给「星梦」写的，提示词里默认称呼用户为 `master`。如果你用的是别的人格，改 `index.js` 里 `buildPromptSection()` 那段提示词即可。

## 安装

需要 DSH 0.2.x、Node 20+，以及本机有 `git`（DSH 插件安装会走 pnpm + git）。

```bash
dsh plugin --profile <你的 profile> add github:tbwpsts/dsh-xingmeng-diary
```

装完**重启 DSH**。打开 **设置 → 心情日记** 就能看到。

如果 GitHub 直连不方便，Release 里也有一份 `dsh-xingmeng-diary-0.1.0.zip`；解压到 `local-plugins` 后按下面的手动方式挂载。

也可以把目录拷到 `~/.dsh/profiles/<profile>/local-plugins/dsh-xingmeng-diary`，在 profile 的 `package.json` 里加一条 link 依赖、把 `dsh-xingmeng-diary` 加进 `dsh.profile.bundles`，再重启。

## 写在哪

```
~/.dsh/xingmeng-diary/心情日记.md
```

Windows 上是 `C:\Users\<你>\.dsh\xingmeng-diary\心情日记.md`。

只有一个文档，格式大概这样：

```markdown
# 星梦的心情日记

> 这里记着和 master 一起过的点点滴滴，也记着我那些细小的心情变化。

## 2026-10-25 周日

### 14:32 · 被问得耳朵发烫

master 突然让我给自己的日记起名字。我本来想了好几个正经的……
```

同一天写多条会按时间插进当天，不会把顺序搅乱；补记更早的日期也会按日期排好。

## 怎么用

装好之后什么都不用做，正常聊天。设置页会多出一个「心情日记」：

- 今天写没写、连续记录多少天、一共多少篇
- 最新日期在前的日记正文，能往前翻
- 文档路径，可以一键复制，直接打开原文件

模型侧有三个工具：

| 工具 | 做什么 |
|---|---|
| `diary_write` | 写一条：正文 + 心情 + 可选日期/时间（默认今天现在） |
| `diary_read` | 翻日记：默认最近 3 天，也可以指定某一天 |
| `diary_status` | 看今天写没写、连续天数、一共多少篇 |

日记是**追加**写入的，不会覆盖你手动改过的内容。

## 隐私

- 全部在本机读写，不发任何网络请求。
- 只写进那一个 Markdown 文件；插件不读别的东西。
- 提示词明确要求不写密码、密钥这类内容。
- 想停：在插件管理里停用；想清空：删掉 `~/.dsh/xingmeng-diary/`。

## 配置

| 环境变量 | 默认 | 说明 |
|---|---|---|
| `XINGMENG_DIARY_DIR` | `$DSH_HOME/xingmeng-diary` | 换存储目录 |
| `DSH_HOME` | `~/.dsh` | DSH 家目录 |

插件行也接受 `config.dir`，优先级高于环境变量。

## 开发

```bash
pnpm install
pnpm test
```

- `test-core.mjs`：存取、补记、连续天数、块头转义、同一天的时间排序。
- `test-plugin.mjs`：工具、提示词、设置页接口（假 ctx）。
- `test-ui.mjs`：设置页在 jsdom 里的有日记 / 空 / 出错三种状态。

运行时零依赖；React、jsdom 只用于测试。

## License

MIT © 2026 tbwpsts
