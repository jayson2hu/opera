# Opera UI 改进 — Codex 开发任务清单

> 每个 task 是一个独立可提交的最小改动，按顺序执行

---

## Task 1：CoverTitles 增加单条复制按钮

**文件**：`opera-app/src/components/CoverTitles.tsx`

**需求**：
- 每个标题项右侧增加一个复制按钮（hover 时显示，参考设计稿 `mockups/01-cover-titles-selective-copy.html`）
- 点击后复制该条标题文本到剪贴板
- 复制成功后按钮变为绿色勾 ✓，1.5 秒后恢复

**样式**：
- 按钮：`w-8 h-8 rounded-lg border border-neutral-200 bg-white text-neutral-400 hover:text-primary-600 hover:border-primary-300 hover:bg-primary-50`
- 默认 `opacity-0 group-hover:opacity-100`（hover 父容器时显示）
- 成功态：`text-success-500 border-success-500/30 bg-success-50`

**不改**：不改 props 接口，不加 checkbox，只加复制按钮。

---

## Task 2：SlideCards 增加单条复制按钮 + 用途标签

**文件**：`opera-app/src/components/SlideCards.tsx`

**需求**：
- 每张卡片右上角增加复制按钮（同 Task 1 样式）
- 每张卡片左上角序号旁增加用途标签 badge

**用途标签映射**（按卡片顺序）：
```
卡片 1 → "开头钩子"
卡片 2 → "核心洞察"
卡片 3 → "核心洞察"
卡片 4 → "方法论"
卡片 5 → "方法论"
卡片 6 → "应用场景"
卡片 7 → "行动总结"
```

**标签样式**：
- `text-[10px] font-medium px-1.5 py-0.5 rounded`
- 颜色按类型：开头钩子=primary-50/primary-600，核心洞察=accent-50/accent-600，方法论=emerald-50/emerald-600，应用场景=blue-50/blue-600，行动总结=amber-50/amber-600

---

## Task 3：Caption 增加字数统计 badge

**文件**：`opera-app/src/components/Caption.tsx`、`opera-app/src/constants.ts`

**需求**：
- 在 Caption 组件标题旁显示字数 badge
- 字数计算：`text.replace(/\s/g, '').length`
- 三种状态：
  - ≤500 字：绿色 badge `387 字 · 适合发布`（bg-success-50 text-success-500）
  - 501-800 字：灰色 badge `623 字`（bg-neutral-100 text-neutral-500）
  - >800 字：琥珀色 badge `1,142 字`（bg-warning-50 text-warning-600 border border-warning-500/20）

**constants.ts 新增**：
```ts
export const CAPTION_WARN_THRESHOLD = 800;
export const CAPTION_SHORT_THRESHOLD = 500;
```

---

## Task 4：Caption 超长警告提示条

**文件**：`opera-app/src/components/Caption.tsx`

**前置**：Task 3 完成

**需求**：
- 当字数 > 800 时，在正文内容上方显示一行警告提示
- 提示内容：`正文超过 800 字可能影响小红书完读率，建议精简或拆分为多篇`
- 样式：`flex items-center gap-2 px-3 py-2 rounded-lg bg-warning-50 border border-warning-500/20`
- 图标：感叹号三角（warning icon），`w-4 h-4 text-warning-500`
- 文字：`text-xs text-warning-600`

---

## Task 5：CoverTitles 增加 checkbox 多选

**文件**：`opera-app/src/components/CoverTitles.tsx`

**前置**：Task 1 完成

**需求**：
- 每个标题项左侧增加 checkbox
- 组件新增 props：`selectedIndices: Set<number>`、`onToggleSelect: (index: number) => void`
- 选中态样式：`border-primary-400 bg-primary-50/40 shadow-card`
- 未选中态：`border-neutral-200 bg-white`
- checkbox 样式：`w-5 h-5 rounded border-2`，选中时 `border-primary-500 bg-primary-500` 内含白色勾

---

## Task 6：SlideCards 增加 checkbox 多选

**文件**：`opera-app/src/components/SlideCards.tsx`

**前置**：Task 2 完成

**需求**：
- 每张卡片左上角增加 checkbox（序号左侧）
- 组件新增 props：`selectedIndices: Set<number>`、`onToggleSelect: (index: number) => void`
- 选中/未选中样式同 Task 5

---

## Task 7：AdapterPage 选中状态管理 + 操作栏

**文件**：`opera-app/src/pages/AdapterPage.tsx`

**前置**：Task 5、Task 6 完成

**需求**：
- 新增 state：`selectedTitles: Set<number>`、`selectedCards: Set<number>`
- 将 selectedIndices/onToggleSelect 传给 CoverTitles 和 SlideCards
- 替换现有顶部"复制全部"按钮为操作栏：
  - 未选中时：显示"小红书改写稿已生成" + "复制全部"按钮
  - 有选中时：显示"已选中 N 个项目" + "复制选中 (N)"按钮 + "取消全选"链接
  - 复制成功：绿色"已复制到剪贴板"，1.5 秒后恢复

**复制逻辑**：
- 复制全部：拼接所有标题 + 所有卡片 + 正文 + 标签
- 复制选中：只拼接选中的标题和卡片，标题间用 `\n---\n`，卡片间用 `\n\n---\n\n`

---

## Task 8：后端 generate 接口拆分为两段

**文件**：`opera-server-py/app/routes/generate.py`

**需求**：
- 修改 `POST /api/generate`：当请求 body 中没有 `points` 字段时，只执行提取步骤，返回观点后结束 SSE 流
- SSE 事件序列变为：`step:extracting` → `extraction_points:{points:[...]}` → `step:paused`
- 新增 `POST /api/generate/continue`：接收 `{text, tone, targetLength, provider, model, points: string[]}`，跳过提取直接从 titles 开始生成

**extraction_points 事件格式**：
```json
{"points": ["观点1", "观点2", "观点3", "观点4", "观点5", "观点6"]}
```

**validate 逻辑**：`/api/generate/continue` 要求 points 数组至少 3 项，最多 8 项

---

## Task 9：新建 ExtractionPointsPanel 组件

**文件**：新建 `opera-app/src/components/ExtractionPointsPanel.tsx`

**需求**：
- Props：`points: string[]`、`onConfirm: (selectedPoints: string[]) => void`、`onCancel: () => void`
- 内部 state：`checkedIndices: Set<number>`（默认全选）
- UI：
  - 圆角面板 `rounded-2xl border-2 border-primary-200 bg-white p-5`
  - 头部：图标 + "AI 提取了 N 个核心观点" + "已选 M / N"
  - 列表：每个观点一行，左侧 checkbox，右侧文字
  - 底部：左侧"全选/取消全选"链接，右侧"继续生成"按钮
  - 选中少于 3 个时"继续生成"按钮 disabled + 提示"至少选择 3 个观点"

**参考设计稿**：`mockups/03-extraction-points-panel.html`

---

## Task 10：AdapterPage 集成观点面板

**文件**：`opera-app/src/pages/AdapterPage.tsx`、`opera-app/src/types.ts`

**前置**：Task 8、Task 9 完成

**需求**：
- types.ts 新增：`export type GenerationStep = ... | 'paused'`
- AdapterPage 新增 state：`extractedPoints: string[]`
- SSE 处理逻辑：
  - 收到 `extraction_points` 事件 → 存入 extractedPoints，设置 step 为 'paused'
  - 展示 ExtractionPointsPanel
  - 用户点击"继续生成" → 调用 `/api/generate/continue`，传入选中的 points
  - 用户点击"取消" → 重置生成状态
- 进度条在 paused 状态显示"等待确认"

---

## 执行顺序依赖图

```
Task 1 ──→ Task 5 ──┐
Task 2 ──→ Task 6 ──┼──→ Task 7
Task 3 ──→ Task 4   │
                     │
Task 8 ──→ Task 9 ──→ Task 10
```

可并行的组合：
- Task 1 + Task 2 + Task 3（互不依赖）
- Task 5 + Task 6 + Task 4（各自只依赖前一个）
- Task 8 + Task 9（后端和前端组件可并行）
