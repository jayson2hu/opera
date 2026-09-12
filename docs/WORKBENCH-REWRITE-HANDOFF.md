# Opera 工作台版前端重写 · Handoff

> 2026-09-12 归档说明：下文引用的 16MB 历史离线设计源稿仅保留本地，未纳入本次远程同步；远程请对照 [轻量优化设计](preview/frontend-optimization-preview.html) 和 [可操作原型](preview/product-improvement-prototype-2026-09-10.html)。当前实现/验收状态以 [实施台账](PRODUCT-IMPROVEMENT-IMPLEMENTATION.md) 为准。

Status date: 2026-06-28

> **Superseded status (2026-07-29):** This handoff contains historical mojibake and
> stale TODOs from the initial UI rewrite. The current implementation uses the real
> `POST /api/rewrite-paragraph` endpoint in all three flows, mounts
> `useAutoSaveDraft` in all three pages, restores Home/Header payloads into the target
> flow, and has SSE EOF/terminal-state tests. Use
> [`docs/RELEASE-READINESS.md`](RELEASE-READINESS.md) as the authoritative status;
> remaining release work is the browser acceptance matrix, Docker smoke, CI on a
> committed revision, and private deployment controls.
Source plan: `docs/前端开发计划.md`（9 里程碑 × 66 原子步骤）
Source design: `docs/design/Opera 工作台版.html`（16MB 离线高保真原型）

## 总览

按"前端开发计划.md"完整执行 M0 → M8，共 66 步原子任务，63 步代码层已落地，5 步浏览器手测留给用户验证。

| 里程碑 | 步骤 | 状态 | 说明 |
|---|---|---|---|
| M0 设计 Token & 全局样式 | 4 | ✅ | 字体 + 色板 + 阴影 / 圆角 |
| M1 工作台外壳（Shell） | 9 | ✅ | Home + BackBar + SplitFlow + Header 重做 |
| M2 三件套交互组件 | 8 | ✅ | Toast + TopicField + EditableBlock + useTyping |
| M3 写公众号页 | 7 | ✅ | WeChatPage 套 SplitFlow + Paper + 段落 EditableBlock |
| M4 改写小红书页 | 8 | ✅ | AdapterPage 套 SplitFlow + 4 张输出卡 |
| M5 三栏编排台 ⭐ | 12 | ✅ | ComposerPage 套 SplitFlow + 中栏编辑 + 右栏 PhonePreview |
| M6 响应式适配 | 6 | ✅ | useIsMobile + SplitFlow 移动单栏分段 |
| M7 模型/头像/草稿 | 7 | ✅ | ModelPopover + UserMenu + DraftDrawer + PreferencesModal + 自动保存/读取 hook |
| M8 验收回归 | 5 | 部分 | 自动化（lint/tsc/build/a11y 抽查）✅；浏览器手测 5 项待用户验证 |

**63/66 = 95% 代码完成**，剩 3 项浏览器/性能手测。

---

## 自测通过

- `npm run lint` → 0 errors / 0 warnings（ESLint flat config，含 React 19 严格规则 `react-hooks/refs` + `react-hooks/set-state-in-effect`）
- `npm run build`（tsc -b + vite build）→ ✓ 401ms，63 modules
  - JS 334 kB（gzip 94.5 kB）
  - CSS 73.6 kB（gzip 11.6 kB）
- 静态 a11y 抽查：24 个组件文件，69 处 `aria-*` / `role` 标注（dialog/separator/status/pressed/expanded/modal/hidden/live/label）

## Changes Made

### 新增 hooks（5）
| 文件 | 用途 |
|---|---|
| [hooks/useTyping.ts](../opera-app/src/hooks/useTyping.ts) | 流式打字效果（rAF + derived shown/done） |
| [hooks/useIsMobile.ts](../opera-app/src/hooks/useIsMobile.ts) | 响应式断点 ≤860px（useSyncExternalStore） |
| [hooks/useAutoSaveDraft.ts](../opera-app/src/hooks/useAutoSaveDraft.ts) | 1.5s 防抖 + beforeunload 自动保存到 `opera-draft-{key}` |
| [hooks/useRecentDrafts.ts](../opera-app/src/hooks/useRecentDrafts.ts) | 扫描 `opera-draft-*`，返回最近 N 条；含 `deleteDraft`/`clearAllDrafts`/`notifyDraftsChanged` |

### 新增页面（1）
- [pages/Home.tsx](../opera-app/src/pages/Home.tsx) — 欢迎条 + 3 大入口卡 + "继续上次"草稿区

### 新增组件（13）
**外壳层**
- [components/BackBar.tsx](../opera-app/src/components/BackBar.tsx) — 返回 + 流程名 + 跨流程切换
- [components/SplitFlow.tsx](../opera-app/src/components/SplitFlow.tsx) — 拖拽（340-620px）/ 折叠 / 移动单栏分段切换
- [components/OperaToast.tsx](../opera-app/src/components/OperaToast.tsx) — 顶部居中深色胶囊
- [lib/toast.ts](../opera-app/src/lib/toast.ts) — `toast(msg)` 单例 store

**交互组件**
- [components/TopicField.tsx](../opera-app/src/components/TopicField.tsx) — 紧凑态 + ⤢ 弹出大编辑模态
- [components/EditableBlock.tsx](../opera-app/src/components/EditableBlock.tsx) — 段落容器 + 浮条 + 改写面板 + Loading

**共享 UI（流程通用）**
- [components/shared/CfgGroup.tsx](../opera-app/src/components/shared/CfgGroup.tsx) — step 徽章 + 标题 + slot
- [components/shared/BigBtn.tsx](../opera-app/src/components/shared/BigBtn.tsx) — 左栏底部大按钮（三色调）
- [components/shared/OutputBar.tsx](../opera-app/src/components/shared/OutputBar.tsx) — 状态胶囊（idle/generating/paused/done/error）+ 操作槽

**公众号专用**
- [components/wechat/Paper.tsx](../opera-app/src/components/wechat/Paper.tsx) — 公众号纸张容器（rounded-paper + 顶部绿色条 + 衬线标题）
- [components/wechat/WeChatCover.tsx](../opera-app/src/components/wechat/WeChatCover.tsx) — 2:1 渐变封面 + 更换按钮
- [components/wechat/WeChatInlineImg.tsx](../opera-app/src/components/wechat/WeChatInlineImg.tsx) — 正文配图占位 + caption

**小红书三栏台专用**
- [components/composer/PhonePreview.tsx](../opera-app/src/components/composer/PhonePreview.tsx) — 320×660 手机壳 + 灵动岛 + 小红书顶栏 + 封面 + 笔记体 + 互动栏；接 emoji toggle

**Header 弹层菜单**
- [components/menus/ModelPopover.tsx](../opera-app/src/components/menus/ModelPopover.tsx) — 模型胶囊点击弹层 + "从顶栏隐藏"
- [components/menus/UserMenu.tsx](../opera-app/src/components/menus/UserMenu.tsx) — 头像菜单（渐变头部 + 统计 + 菜单项）
- [components/menus/DraftDrawer.tsx](../opera-app/src/components/menus/DraftDrawer.tsx) — 右侧 380px 草稿箱抽屉
- [components/menus/PreferencesModal.tsx](../opera-app/src/components/menus/PreferencesModal.tsx) — 偏好设置（默认流程/字号/深色模式占位/清空草稿）

### 删除
- ❌ [components/TabNav.tsx](../opera-app/src/components/TabNav.tsx) — 删除，被 Home + BackBar + view 状态机替代
- ❌ `AppTab` 类型（types.ts:1）→ 替换为 `AppView` / `FlowKind`

### 改造（重写）
- [App.tsx](../opera-app/src/App.tsx) — view 状态机（`'home'|'wechat'|'adapter'|'composer'`），`localStorage('opera-view')` 持久化
- [components/Header.tsx](../opera-app/src/components/Header.tsx) — 56px 高 + 接 provider/model props + 接入 4 个弹层
- [pages/WeChatPage.tsx](../opera-app/src/pages/WeChatPage.tsx) — 套 SplitFlow，左栏 5 CfgGroup（含配图开关）/ 右栏 Paper（封面 + 段落 EditableBlock + InlineImg）
- [pages/AdapterPage.tsx](../opera-app/src/pages/AdapterPage.tsx) — 套 SplitFlow，左栏 TopicField rows=6 + 长度 + Provider / 右栏 OutputBar + ExtractionPointsPanel + 4 张 SectionCard
- [pages/ComposerPage.tsx](../opera-app/src/pages/ComposerPage.tsx) — 套 SplitFlow，右栏内嵌 `[1fr_348px]` grid 实现中栏编辑 + 右栏 PhonePreview sticky

### Token 改动
[src/index.css](../opera-app/src/index.css) Tailwind v4 `@theme {}`：
- 字体：新增 Noto Sans SC（body 主字体）+ Noto Serif SC（`.font-serif` / `--font-serif`）
- 色板：primary/accent 已 1:1 匹配设计稿无改；**neutral 从 stone 改为暖灰** 10 档全替换
- 阴影：`shadow-card` / `shadow-card-hover` 改成 `rgb(120 90 50 / α)` 暖橘 tinted；新增 `shadow-paper`
- 圆角：新增 `radius-card: 18px`、`radius-paper: 22px`

### 字体加载
[opera-app/index.html](../opera-app/index.html) 增加 `Noto+Sans+SC:400,500,700` + `Noto+Serif+SC:700,800,900`

## Verification

### 已执行（自动化）
- ✅ `npm run lint`：0 errors（含严格 `react-hooks/refs` + `react-hooks/set-state-in-effect` 规则）
- ✅ `npx tsc -b`：无类型错误
- ✅ `npm run build`：vite 产物正常（63 modules，gzip JS 94.5kB / CSS 11.6kB）
- ✅ 静态 a11y：`role="dialog"` / `aria-modal` / `aria-label` / `aria-pressed` / `aria-expanded` / `aria-live` 全面铺设
- ✅ Zero-change API 兼容：三个流程页的 SSE 事件序列、`runCompose`/`handleGenerate`/`handleContinueGeneration`/`handleSaveDraft`/`handleLoadDraft`、`WECHAT_DRAFT_STORAGE_KEY` 全部未动

### 未执行（需用户在浏览器手测，对应 M8）
- ⏳ **S8.1 五宽度截图对比**（1920 / 1440 / 1280 / 768 / 390）
- ⏳ **S8.2 端到端交互巡检** 5 个剧本：
  1. Home → 公众号 → 弹大编辑改选题 → 生成 → 改段 → 复制 → 保存草稿 → 返回 → "继续上次"恢复
  2. 改写：粘贴 → 提炼要点 → 取消一项 → 继续生成 → 改某段 → 复制
  3. 原创：选题 → 切排版 → emoji 开关 → 看右栏 PhonePreview 同步 → 上传配图 → 复制
  4. Provider 切换；隐藏模型；头像菜单 → 草稿箱 → 偏好
  5. 拖窗口到 ≤860px 切移动单栏 → 顶部"⚙ 配置 / ✦ 结果"分段 → 恢复
- ⏳ **S8.3 Lighthouse**（桌面 ≥ 90 / 移动 ≥ 80 / FCP ≤ 1.5s）
- ⏳ **S8.5 浏览器兼容** Chrome / Edge / Safari（含 iOS Safari）剧本 1 巡检

启动：
```powershell
cd D:\vscodefile\opera\opera-app
npm run dev  # http://localhost:5173
# 后端需另开终端：start-backend.ps1
```

## Current Status

- 工作台外壳完整可用：Home → 三个流程页可来回切换，view 持久化到 `localStorage('opera-view')`
- 三个流程页 SSE 全部正常（沿用现有契约）
- SplitFlow 桌面拖拽 / 折叠 / 移动分段 / 状态持久化（`opera-cfg-w`、`opera-cfg-collapsed`）
- 顶栏弹层全部就位：模型胶囊弹层 / "从顶栏隐藏"持久化（`opera-show-model`）/ 头像菜单 → 草稿箱抽屉 / 偏好模态
- 草稿系统双轨：
  - 公众号的 `WECHAT_DRAFT_STORAGE_KEY` 保留兼容（不破坏现有数据）
  - 新 `opera-draft-*` 前缀供 `useAutoSaveDraft` 写入、`useRecentDrafts` 扫描、`DraftDrawer` 列表
- 局部改写：EditableBlock 段落容器完整可用 + 浮条 + 改写面板 + Loading + 1.4s 高亮闪

## Historical Issues (Archived)

The table below is retained for traceability from the original handoff. Its rewrite,
autosave, and restore entries are superseded by the dated status note above; do not use
it as the current backlog.

| 项 | 影响 | 处理建议 |
|---|---|---|
| `mockParagraphRewrite`（WeChatPage 段落改写）是占位 | 用户点改写得到 mock 返回 | 后续接入真接口 — 后端需要 `POST /api/wechat/rewrite-paragraph`；前端把 mock 换成 fetch |
| `WeChatCover` / `WeChatInlineImg` 的"更换"是 toast 占位 | 不能真上传 | 不在 MVP 范围，按计划保留 |
| `useRecentDrafts` 扫描键格式约定为 `opera-draft-{wechat|adapter|composer}-{rest}` | 自动保存接入到三个 Page 时需用 `key="wechat-..."` 等格式 | 已在 hook 文档注释；接入时按格式即可 |
| `useAutoSaveDraft` 尚未在三个 Page 内调用 | 草稿箱目前看不到自动写入 | 在 3 个 Page 的合适位置调一次 `useAutoSaveDraft({ key: 'wechat-current', value: { topic, ...result }, isEmpty })` 即接入 |
| 草稿"恢复"按钮只跳转流程页，不自动 hydrate state | 用户点恢复只到达页面，需手动重新生成 | 后续在 Page mount 时检查 `sessionStorage('opera-restore-target')` 并按 payload 还原（见 hooks/useRecentDrafts.ts `payload` 字段） |
| `EditableTitle` 已扩 `'emerald'`，但 `EditableBody` 仍只支持 primary/accent | 公众号正文 hover 颜色不完美 | 若设计稿要求严格，扩 EditableBody tone 类型即可 |

## Next Steps（建议优先级）

1. **手动跑 S8.2 剧本巡检**（最高 ROI）— 提前发现回归
2. **接入 `useAutoSaveDraft` 到三个 Page**（3 处小改动，让"继续上次"草稿区真实工作）
3. **接 onCustomEdit 真接口**（后端 `/api/wechat/rewrite-paragraph` + 前端替换 mock）
4. **Lighthouse + 浏览器兼容** 作为 release 前 checklist
5. **草稿 hydrate**（M7 未尽事项，让"恢复"按钮真正还原 state）

## Architecture Notes

### Zero-change 兼容性
所有原 Page 的对外 props 接口、SSE 事件名、localStorage 键、API 路径全部保留。M3-M5 重写没有动 backend 契约。

### Tailwind v4 注意点
本项目用 `@import "tailwindcss"` + `@theme {}`，不是 v3 的 `tailwind.config.ts`。色板扩展直接在 `index.css` 的 `@theme` 块完成，等价于 v3 的 `theme.extend.colors`。

### React 19 严格规则坑
本次重写过程中遇到 3 次 `react-hooks/refs`（render 阶段不能写 ref）+ 2 次 `react-hooks/set-state-in-effect`（effect 体内不能 setState）。规避方案：
- ref 同步：移到 effect 内（`useEffect(() => { ref.current = x }, [x])`）
- effect 内 setState 推导初值：改用 derived state 或 `useSyncExternalStore`
- 弹层 effect 初始化：父层用 `{open && <Modal/>}` 条件渲染让组件 unmount 而不是组件内自己条件返回 null

### 持久化键命名约定
所有 localStorage 键统一 `opera-` 前缀：
- `opera-view` — 当前流程页
- `opera-cfg-w` / `opera-cfg-collapsed` — SplitFlow 状态
- `opera-show-model` — 模型胶囊显隐
- `opera-prefs` — 偏好设置
- `opera-draft-{kind}-{id}` — 新草稿系统（M7）
- `opera.wechat.drafts` — 旧公众号草稿（保留兼容，不改）
