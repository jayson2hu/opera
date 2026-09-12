# Opera 前端优化开发计划

> 2026-09-10 合并说明：保留本计划作为历史设计依据。C2/C3 已改为按真实目标的基础检查，撤去完读率等预估；C4 未实现的 Cmd/Ctrl+K 占位提示已移除。当前执行/问题状态以 [产品改善实施记录](PRODUCT-IMPROVEMENT-IMPLEMENTATION.md) 为准。

> 依据：`docs/preview/frontend-optimization-preview.html`（高保真对比预览，已确认改动点）
> 范围：`opera-app`（前端）+ `opera-server-py`（仅 Phase 3 涉及少量 prompt 扩展）
> 约束：不引入新的 npm 依赖；复用现有 Tailwind 设计 token；所有改动可独立验收、独立回退

---

## 0. 改动点总览

| 编号 | 场景 | 改动项 | 优先级 | 预计工时 | 依赖 |
|------|------|--------|--------|----------|------|
| H1 | 首页 | Hero 视觉升级（光晕 + 渐变标题 + 创作连续性） | P1 | 0.5d | Phase 0 |
| H2 | 首页 | Flow 卡片信息层级（类型标签 + 使用统计 + 悬浮光效） | P1 | 0.5d | Phase 0 |
| H3 | 首页 | 草稿区重设计（进度条 + 状态文案 + 横向滚动） | P1 | 1d | Phase 0 |
| C1 | 编排台 | 步骤完成态导航（勾选态 + 当前高亮 + 进度计数） | P0 | 1d | Phase 0 |
| C2 | 编排台 | 发布前质量检测面板（字数/标签/钩子/配图） | P0 | 1d | 无 |
| C3 | 编排台 | 发布预估条（完读率/互动潜力/标签覆盖，启发式） | P2 | 0.5d | C2 |
| C4 | 编排台 | 快捷键（⌘⏎ 生成 / ⌘K 快捷面板入口） | P2 | 0.5d | 无 |
| A1 | 改写页 | 卡片用途标签升级为 AI 驱动（后端 prompt + SSE 扩展） | P1 | 1.5d | 后端 |
| A2 | 改写页 | 导出卡片为图片（Canvas 零依赖渲染） | P1 | 1d | 无 |
| A3 | 改写页 | 换语气快速重生（保留原文，仅切语气重跑） | P1 | 0.5d | 无 |
| S1 | 设计系统 | 阴影 4 级层级 token 化 | P0 | 0.5d | 无 |
| S2 | 设计系统 | 微交互动效（按钮光晕 / 复制反馈 / 骨架屏） | P1 | 0.5d | S1 |
| S3 | 设计系统 | 深色模式（data-theme 覆盖层 + 偏好持久化） | P2 | 2d | S1 |

**里程碑排期（共约 10 个工作日）：**

```
Week 1:  Phase 0 (S1+S2, 1d) → Phase 1 首页 (H1+H2+H3, 2d) → Phase 2 编排台 C1+C2 (2d)
Week 2:  Phase 2 收尾 C3+C4 (1d) → Phase 3 改写页 A1+A2+A3 (3d) → Phase 4 深色模式 + 联调 (1d 起)
```

---

## Phase 0：设计系统基础（S1 + S2）

> 目标：把预览中的视觉规范沉淀为可复用 token，后续所有 Phase 直接消费。

### S1 阴影层级 token 化

**现状**：[index.css](file:///D:/vscodefile/opera/opera-app/src/index.css) 已有 `shadow-card / card-hover / paper / float` 四级，但语义未分层（"何时用哪级"靠直觉）。

**改动文件**：`opera-app/src/index.css`、`opera-app/tailwind.config`（@theme 段）

**实现要点**：
- 保留现有 4 个 token 不改值（避免全局视觉漂移），仅新增语义别名注释：
  - `shadow-card` → Lv1 列表项/输入框
  - `shadow-card-hover` → Lv2 悬浮卡片
  - `shadow-paper` → Lv3 主内容卡/模态
  - `shadow-float` → Lv4 悬浮面板（手机外壳、Popover）
- 新增 `shadow-glow-primary / shadow-glow-accent`（预览中 Flow 卡片悬浮光晕）：
  ```css
  --shadow-glow-primary: 0 0 40px -8px rgb(238 128 25 / 0.4);
  --shadow-glow-accent: 0 0 40px -8px rgb(139 92 246 / 0.4);
  ```

**验收**：`npm run build` 通过；现有页面视觉无变化（纯增量）。

### S2 微交互动效

**改动文件**：`index.css`、涉及按钮的共享组件（`BigBtn.tsx`、`CopyButton.tsx`）

**实现要点**：
- 按钮光晕：BigBtn hover 时叠加 `hover:shadow-glow-{tone} hover:scale-[1.01] active:scale-[0.99]`
- 复制反馈：CopyButton 已有 1.5s 绿色态，补充 `scale` 进入动画（`animate-fade-in` 复用）
- 骨架屏：新增 `.skeleton` 工具类（复用已有 `shimmer` keyframes），供生成中占位使用
  ```css
  .skeleton {
    background: linear-gradient(90deg, var(--color-neutral-100) 25%, var(--color-neutral-200) 50%, var(--color-neutral-100) 75%);
    background-size: 200% 100%;
    animation: shimmer 2s linear infinite;
  }
  ```

**验收**：三个流程页主按钮 hover 有光晕；生成中状态出现 shimmer 骨架。

---

## Phase 1：首页（H1 + H2 + H3）

**改动文件**：[Home.tsx](file:///D:/vscodefile/opera/opera-app/src/pages/Home.tsx)、[useRecentDrafts.ts](file:///D:/vscodefile/opera/opera-app/src/hooks/useRecentDrafts.ts)

### H1 Hero 视觉升级

**实现要点**：
- 在 `<main>` 内顶部增加两个绝对定位光晕 `div`（`bg-primary-200/50`、`bg-accent-200/40`，`filter: blur(80px)`，`pointer-events-none`，`aria-hidden`）
- 标题改为两行结构，第二行使用渐变文字：
  ```tsx
  <span className="bg-gradient-to-r from-primary-500 via-primary-600 to-accent-500 bg-clip-text text-transparent">
    可发布的内容
  </span>
  ```
- 问候胶囊中"N 个草稿"替换为"已连续创作 N 天"：
  - 数据来源：遍历 `opera-draft-*` 的 `savedAt` 日期集合，计算从今天往回连续有草稿的天数
  - 实现位置：`useRecentDrafts` 新增 `useCreationStreak()` hook（纯函数，易测试）
  - 边界：0 天时降级显示原"本地工作台 · N 个草稿"文案

### H2 Flow 卡片信息层级

**实现要点**：
- `FLOW_CARDS` 数组每项新增 `tag: string`（长文/改写/原创）字段
- 卡片布局调整：右上类型标签 chip；底部行拆为左右两区——左侧"本月已写 N 篇"，右侧"开始 →"（默认 `opacity-0`，`group-hover` 淡入）
- 悬浮光效：`hover:shadow-glow-primary`（按卡片 tone 选 glow 颜色）+ 边框色 `hover:border-{tone}-200`
- "本月已写 N 篇"统计：基于 `useRecentDrafts(50)` 的 `savedAt` 过滤当月 + 按 kind 分组计数。注意这是**草稿数**而非发布数，文案用"本月 N 篇草稿"避免误导

### H3 草稿区重设计

**实现要点**：
- 外层容器改为 `rounded-3xl border bg-gradient-to-br from-neutral-50/80 to-white p-5`
- 标题行左侧加时钟图标徽章，右侧"查看全部 N 个草稿 →"（点击触发 Header 的 DraftDrawer——需把 drawer 打开能力下沉：方案是新增自定义事件 `window.dispatchEvent(new CustomEvent('opera:open-drafts'))`，Header 监听后 `setDraftsOpen(true)`，避免把状态提升到 App）
- 草稿卡片改为横向滚动列表（`flex gap-3 overflow-x-auto`，单卡 `w-[240px] shrink-0`）：
  - 顶部：类型 chip（复用 FLOW_META 色系）+ 相对时间
  - 中部：标题 truncate
  - 底部：进度条 + 状态文案
- **进度数据来源（关键设计）**：草稿 payload 中已有 `resultStatus: 'complete' | 'incomplete'`（见 [ComposerPage.tsx](file:///D:/vscodefile/opera/opera-app/src/pages/ComposerPage.tsx) 的 useAutoSaveDraft 调用）。进度条规则：
  - `complete` → 100%，文案"✓ 已完成 · 可复用"（绿色）
  - `incomplete` 且有部分结果 → 60%，文案"进行中 · 已生成部分内容"
  - `incomplete` 且无结果 → 25%，文案"草稿阶段"
  - 实现位置：`useRecentDrafts` 的 `readRaw()` 解析 payload 时派生 `progress: 0|25|60|100` 字段

**验收**：
- [ ] 首屏光晕不遮挡文字、不影响点击
- [ ] 连续天数在 0/1/N 天三种状态下文案正确
- [ ] 草稿卡片进度与 payload.resultStatus 一致
- [ ] "查看全部"能打开 DraftDrawer
- [ ] 移动端横向滚动流畅、无布局抖动

---

## Phase 2：小红书编排台（C1 + C2 + C3 + C4）

**改动文件**：[ComposerPage.tsx](file:///D:/vscodefile/opera/opera-app/src/pages/ComposerPage.tsx)、[CfgGroup.tsx](file:///D:/vscodefile/opera/opera-app/src/components/shared/CfgGroup.tsx)、新增 `components/composer/PublishChecklist.tsx`

### C1 步骤完成态导航（P0）

**现状问题**：左栏 4 个 CfgGroup 平铺，用户无法一眼看到"还差哪步"；`missingRequirements` 只在按钮下方用小字提示。

**实现要点**：
- **不改动 CfgGroup 内部**（WeChatPage / AdapterPage 也在用），在 ComposerPage 左栏顶部新增一个 `ConfigStepNav` 组件：
  ```tsx
  interface StepState { id: string; title: string; done: boolean; active: boolean; summary?: string }
  ```
- 四个步骤状态派生自现有 state：
  - 选题：`topicCharCount >= MIN_TOPIC_CHARS`，summary 为 topic 截断 20 字
  - 内容类型：`contentType !== null`，summary 为选中 label
  - 语气：`selectedTone !== null`
  - 篇幅：`targetLength` 有默认值 'medium'，始终 done（summary 显示当前档位）
- 视觉：完成步骤显示绿色对勾圆点；第一个未完成步骤显示 accent 高亮圈 + `ring-1`；点击步骤平滑滚动到对应 CfgGroup（给每个 CfgGroup 容器加 `id={`cfg-${step}`}` + `scrollIntoView`）
- 顶部进度计数"3/4 完成"
- 折叠策略：预览中的"已选语气"折叠区**不做**（保持现有 CfgGroup 全部展开，避免双倍维护状态）；步骤导航只做"定位 + 总览"

**验收**：
- [ ] 填写选题后第 1 步即时变绿
- [ ] 点击步骤导航滚动到对应配置区
- [ ] 生成中导航禁用（视觉上 opacity-60）

### C2 发布前质量检测面板（P0）

**新增文件**：`opera-app/src/components/composer/PublishChecklist.tsx`

**实现要点**（全部纯前端、零 LLM 调用，复用 [constants.ts](file:///D:/vscodefile/opera/opera-app/src/constants.ts) 的 `countChars`）：

| 检测项 | 规则 | 通过态 |
|--------|------|--------|
| 正文长度 | `countChars(body)` ≤ `CAPTION_WARN_THRESHOLD`(800) 且 ≥ `CAPTION_SHORT_THRESHOLD`(500) | "623 字 · 在推荐区间" |
| 标签数量 | `tags.length >= 4` | "含 6 个相关标签" |
| 标题钩子 | 正则：含数字 `\d` 或疑问词 `吗/呢/怎么/为什么/如何` 或 emoji | "标题含互动钩子" |
| 配图 | `draftImages.length >= 2` | 未通过时警告态："建议补充 2-3 张配图" |

- 面板位置：中栏笔记草稿卡下方、ImageSuggestion 上方
- 顶部状态徽章：全部通过 → 绿色"适合发布"；任一未过 → 琥珀色"可优化"
- 单条规则组件化：`CheckItem({ pass, label })`，图标用 emerald 对勾 / amber 叹号
- 仅当 `isComplete === true` 时渲染

**验收**：
- [ ] 四种规则各自独立触发通过/警告态
- [ ] 面板在生成中不显示
- [ ] 编辑正文后检测结果实时更新（依赖 result state 即可，无需额外订阅）

### C3 发布预估条（P2，启发式）

**实现要点**：
- 与 C2 同面板或独立小卡（建议并入 C2 面板底部，减少卡片数量）
- 三条进度条全部由启发式分数驱动，**不调 LLM**：
  - 完读率预估：`800 - countChars(body)` 归一化到 0-100，越短越高
  - 互动潜力：标题钩子命中数 + 结尾是否含疑问句（`body.trimEnd()` 末段含 `？/?`）
  - 标签覆盖度：`min(tags.length / 8, 1) * 100`
- 面板底部固定一条建议文案（按规则选择）：如结尾无疑问句 → "建议在结尾添加提问式互动，可提升评论率"
- **UI 上必须标注"预估仅供参考"**，避免用户误认为平台真实数据

### C4 快捷键

**实现要点**：
- `ComposerPage` 新增 `useEffect` 全局 keydown 监听：
  - `Cmd/Ctrl + Enter`：`canGenerate` 时触发 `runCompose()`（生成中忽略）
  - `Cmd/Ctrl + K`：预留入口——本期仅 `toast('快捷面板即将上线')`，不做完整 command palette
- BigBtn 文案右侧加 `<kbd>⌘⏎</kbd>` 提示（仅 `navigator.platform` 含 Mac 时显示 ⌘，否则显示 Ctrl）
- Header 右侧的 "⌘K 快捷操作" 提示**不做**（避免承诺未实现功能）

**验收**：
- [ ] ⌘⏎ 在输入框聚焦时不与换行冲突（textarea 内 `e.preventDefault()` 仅在满足生成条件时）
- [ ] 生成中按快捷键无重复触发

---

## Phase 3：改写结果页（A1 + A2 + A3）

**改动文件**：[AdapterPage.tsx](file:///D:/vscodefile/opera/opera-app/src/pages/AdapterPage.tsx)、[SlideCards.tsx](file:///D:/vscodefile/opera/opera-app/src/components/SlideCards.tsx)、`opera-server-py/app/routes/generate.py`、`opera-server-py/app/prompts.py`

### A1 卡片用途标签 AI 化（P1）

**现状**：[SlideCards.tsx](file:///D:/vscodefile/opera/opera-app/src/components/SlideCards.tsx) 第 28-36 行 `CARD_PURPOSES` 按索引硬编码（第 1 张永远是"开头钩子"），AI 实际生成的卡片顺序可能不匹配。

**实现要点（两段式，可降级）**：

后端（`opera-server-py`）：
- `prompts.py` 的 cards prompt 追加输出要求：每张卡片返回 `{ "type": "hook|insight|method|scenario|summary", "content": "..." }` 结构
- `generate.py` 的 cards SSE 事件 payload 从 `string[]` 变为 `{ type, content }[]`
- **SSE 协议向后兼容**：新增事件名 `cards_v2`，旧 `cards` 事件保留（前端优先消费 v2）

前端：
- `types.ts` 新增 `interface SlideCard { type: 'hook'|'insight'|'method'|'scenario'|'summary'; content: string }`
- `AdapterPage` 的 `GenerationResult.cards` 类型升级；`streamGeneration` 中优先解析 `cards_v2`
- SlideCards 的 `purpose` 改为从 `card.type` 映射标签文案/配色（映射表复用现有 CARD_PURPOSES 样式）
- **降级路径**：若后端返回旧格式（纯 string[]），保持现有按索引映射行为不变

**验收**：
- [ ] 新协议下标签与卡片内容语义匹配（人工抽查 3 篇）
- [ ] 旧后端 + 新前端组合不报错（降级生效）
- [ ] 勾选/复制/编辑行为与改造前一致

### A2 导出卡片为图片（P1，零依赖）

**新增文件**：`opera-app/src/lib/cardImageExporter.ts`

**实现要点（Canvas 2D 手写渲染，不引 html2canvas）**：
- 输出规格：1080×1440（3:4 小红书标准），`canvas.toBlob('image/png')`
- 渲染内容：渐变背景（复用卡片 accent 色）+ 用途标签 + 卡片正文（自动换行，Canvas `measureText` 逐字排版）+ 底部 "Made with Opera" 水印（可在偏好中关闭）
- 入口：
  - 每张卡片 hover 操作区新增"🖼"按钮 → 导出单张
  - OutputBar 增加"导出图片"下拉 → "导出选中 (N)" / "导出全部"（多图打包：逐张触发下载，命名 `opera-card-{i+1}.png`；不引入 zip 库，接受多次下载）
- 字体：使用系统字体栈 `600 64px "Noto Sans SC", sans-serif`，避免加载 webfont 阻塞

**验收**：
- [ ] 导出的 PNG 文字清晰、无截断（长文案 110 字内）
- [ ] 中文换行无标点悬挂问题（行首不为标点，简单规则处理）
- [ ] 选中 3 张导出产生 3 次下载

### A3 换语气快速重生（P1）

**实现要点**：
- 位置：左栏"重新改写"按钮下方新增"换个语气试试"区块
- 选项：从 `TONE_OPTIONS` 过滤掉当前 `selectedTone`，渲染剩余 2 个为 chip 按钮
- 点击行为：`setSelectedTone(tone)` 后立即调用 `handleGenerate()`（用函数式更新确保拿到新 tone：`handleGenerate` 当前依赖 `selectedTone` state，需改造为接受覆盖参数 `handleGenerate({ toneOverride })`，内部 `tone = toneOverride ?? selectedTone`）
- 原文保留：`inputText` 不动，符合预览承诺"保留原文但切换参数"
- 生成中禁用

**验收**：
- [ ] 点击后无需手动改语气即开始重新生成
- [ ] 结果区正确替换为新语气产物
- [ ] 草稿自动保存记录最新 tone

---

## Phase 4：深色模式（S3，P2）

**改动文件**：[index.css](file:///D:/vscodefile/opera/opera-app/src/index.css)、[preferences.ts](file:///D:/vscodefile/opera/opera-app/src/lib/preferences.ts)、[PreferencesModal.tsx](file:///D:/vscodefile/opera/opera-app/src/components/menus/PreferencesModal.tsx)

**实现要点**：
- `index.css` 新增 `[data-theme="dark"]` 作用域，覆盖全部 `--color-neutral-*`、语义色（背景/卡片/边框）：
  - 背景：`neutral-50` → `#1c1815`；卡片白 → `#2b2521`；边框 → `#423831`
  - 阴影改用黑色基底 `rgb(0 0 0 / 0.3)` 系
- `preferences.ts` 的 `Preferences` 类型新增 `theme: 'light' | 'dark' | 'system'`，默认 `system`
- 新增 `applyThemePreference(theme)`：`document.documentElement.dataset.theme = ...`；`system` 时监听 `matchMedia('(prefers-color-scheme: dark)')`
- PreferencesModal 增加"外观"分组：浅色 / 深色 / 跟随系统 三选项
- `App.tsx` 挂载时与 `applyFontSizePreference` 同样方式订阅应用

**风险**：组件中存在硬编码 `bg-white`、`text-neutral-*` 的 Tailwind 类，深色下需要这些类消费 CSS 变量才能自动切换。**落地策略**：先做 token 层 + 三处核心容器（Header、主背景、卡片），逐步覆盖；验收以"首页 + 编排台"两页可用为准，其余页面列入后续迭代。

**验收**：
- [ ] 偏好设置切换后即时生效、刷新后保持
- [ ] system 模式下跟随 OS 切换
- [ ] 首页/编排台无"白块穿帮"

---

## 技术约束（全程适用）

1. **不引入新 npm 依赖**（沿用 DEV-PLAN-UI-IMPROVEMENTS.md 既定约束；导出图片用 Canvas 2D 手写）
2. 所有新文案使用中文；图标优先内联 SVG，其次 emoji（与现状一致）
3. 改动必须通过 `npm run lint` 与 `npm run build`；涉及 hooks 的新增逻辑配 vitest 单测（参考 `preferences.test.ts` / `draftIntegrity.test.ts` 现有模式）
4. SSE 协议变更只允许"新增事件名"，不允许修改既有事件结构（保证前后端可独立发布）
5. localStorage 键只增不改；草稿结构变更需兼容旧数据（读取时缺字段给默认值）

## 测试与验证

- 每个 Phase 完成后：`npm run lint && npm run build && npm run test`
- A1 后端改动：`cd opera-server-py && pytest`
- 人工验收：对照 `docs/preview/frontend-optimization-preview.html` 逐项点击核对
- 移动端：每个 Phase 至少一次 375px 宽响应式检查

## 风险与回退

| 风险 | 应对 |
|------|------|
| A1 后端 prompt 变更导致卡片 JSON 解析失败 | 前端 try/catch 降级到 string[] 渲染；后端保留旧事件 |
| H1 光晕在低端机上掉帧 | `prefers-reduced-motion` 媒体查询下隐藏光晕动画 |
| S3 深色模式覆盖面不足 | 默认不暴露入口（偏好中隐藏），灰度成熟后再开放 |
| A2 Canvas 中文字体在部分系统发虚 | 导出分辨率固定 2x（2160×2880）后缩放显示 |

## 与既有文档的关系

- 本计划是 [DEV-PLAN-UI-IMPROVEMENTS.md](file:///D:/vscodefile/opera/docs/DEV-PLAN-UI-IMPROVEMENTS.md) 的延续（该文档的选择性复制/观点干预/字数统计已落地）
- [UX-REVIEW-REPORT.md](file:///D:/vscodefile/opera/docs/UX-REVIEW-REPORT.md) 中"卡片用途提示"（第 7 条）由 A1 完整闭环
- A2 导出图片为预览新增能力，超出原 UX 报告范围，验收标准以本文档为准
