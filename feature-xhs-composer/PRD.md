# PRD：小红书原创内容创作功能（XHS Composer）

> 产出方：PM Agent + Claude Code
> 日期：2026-04-01
> 状态：已确认，Composer Phase 1 已落地并完成当前轮自测，后续验收以 FastAPI 基线为准

---

## 1. 需求澄清

### 表层请求 vs 真实目标

用户说的：「做个写小红书文章的功能，写完可以复制，后面可以自动发布」

真实目标：**让用户能从零开始创作一篇小红书帖子，而不只是改写已有文章**

这是两个**平行且独立**的功能，前端通过两个入口分别进入：

| 入口 | 功能名称 | 工作流起点 | 核心价值 |
|---|---|---|---|
| Tab 1：**转换** | 内容适配（现有） | 已有公众号长文 | 节省改写时间 |
| Tab 2：**创作** | 小红书原创创作（新建） | 一个主题想法 | 降低创作门槛 |

两个功能不存在上下游关系，用户按需选择入口，互不干扰。

**两个入口的工作流对比：**

| 维度 | 转换（内容适配） | 创作（原创创作） |
|---|---|---|
| 起点 | 粘贴已有公众号长文 | 用自然语言描述想写的主题 |
| 用户行为 | 粘贴 → 选调性 → 生成 | 描述意图 → 选类型 → 生成 → 编辑 |
| 输出 | 封面标题 + 卡片文字 + 正文 + 标签 | 标题 + 正文 + 标签（可直接编辑） |
| 输出是否可编辑 | 否（复制即用） | 是（生成后可在线编辑） |

### 「自动发布」边界决策

**V1 不做自动发布**，理由：
- XHS 无公开发布 API，走非官方渠道有封号风险
- 需要账号授权，增加复杂度
- V1 核心价值是「帮写」，不是「帮发」
- 设计上预留入口（置灰 + 「即将上线」提示），不做死

---

## 2. 功能定位

**功能名称：** XHS Composer（小红书原创创作）

**一句话定义：** 告诉 AI 你想写什么，AI 帮你写成一篇完整的小红书帖子，你来编辑和发布。

**与现有功能区隔：**
- 独立 Tab 入口（不在同一个流程里）
- 独立数据流（新的 API endpoint，不复用 `/api/generate`）
- UI 区域完全分开，视觉上用不同强调色区分
- 功能名称不同：现有叫「内容适配」，新的叫「原创创作」

---

## 3. V1 功能范围

### 必须有

- 主题/意图输入框（用户用自然语言描述想写什么）
- 内容类型选择（种草推荐 / 干货分享 / 个人经历 / 知识科普）
- 调性选择（复用现有 3 种）
- AI 生成带 SSE 流式输出（标题 + 正文 + 标签）
- 输出可直接编辑（textarea，不是只读）
- 各块独立复制按钮
- 一键复制全文按钮
- 字数统计（正文）

### 明确不做（V1）

- 自动发布到小红书（账号授权、API 对接）
- 图片生成或上传
- 草稿保存 / 历史记录
- 多账号管理
- 协作编辑
- SEO 关键词分析

### V2 预留扩展点

- 发布能力：V1 仅保留置灰按钮，按钮文案固定为「即将上线」，不接真实发布链路

### 2026-04-02 已锁定实现补充

- Header 下方新增双入口 Tab：`内容转换` 与 `原创创作`
- 全局产品文案统一为「内容创作工具」
- 原创创作走独立 `POST /api/compose`，不污染现有 `POST /api/generate`
- `/api/compose` 支持可选字段 `regenerate?: 'title' | 'body' | 'tags'`，用于块级重生成
- Composer SSE 顺序固定为：`step(extracting)` → `step(title)` → `title` → `step(body)` → 多次 `body(delta)` → `step(tags)` → `tags` → `step(done)`
- 正文必须为真实流式输出，前端边生成边展示，标题/标签/配图建议仍按整块返回
- 发布按钮仅做占位，不接账号授权或第三方发布能力

### 图片功能（V1.5，独立迭代）

小红书带图内容互动率显著高于纯文字帖子，图片是用户实际发布的必要环节。V1 先不做，但图片功能单独作为下一优先级迭代，不归入 V2 大版本：

**支持两种上图方式：**

| 方式 | 说明 |
|---|---|
| **本地上传** | 用户自己上传图片，支持多张，支持预览和排序 |
| **AI 生成** | 根据正文内容自动生成建议配图（需接入图片生成 API，待评估） |

**V1.5 图片功能范围：**
- 本地上传：必做，门槛低，覆盖大部分用户需求
- 多图预览：最多 9 张（XHS 限制），拖拽排序
- AI 生成：待评估图片 API 成本后决策，可选做

**V1 过渡处理：**
- 输出区显示「建议配图关键词」文字区块（根据正文内容生成 3-5 个关键词）
- 提示用户可去 Unsplash / 自拍 / AI 工具搜图
- 为上传组件预留 UI 位置，V1.5 直接填入

---

## 4. 用户操作流程（完整 step-by-step）

```
1. 用户点击顶部 Tab「原创创作」进入新功能页
2. 在主题输入框中描述想写的内容
   例：「分享我用番茄工作法提升效率的亲身经历，3个月干掉拖延症」
3. 选择内容类型（种草推荐 / 干货分享 / 个人经历 / 知识科普）
4. 选择内容调性（复用现有三种：干货体 / 轻松科普体 / 闺蜜种草体）
5. 可选：设置字数目标（200字 / 400字 / 600字+）
6. 点击「开始创作」
7. 流式输出：标题先出 → 正文逐步显示 → 标签最后出
8. 用户直接在输出框内编辑修改（标题、正文均可编辑）
9. 点击各块的「复制」按钮按需复制，或点击「复制全文」
10. 去小红书 App 手动粘贴发布
```

---

## 5. 内容模型

```typescript
interface XHSPost {
  title: string;          // 标题，25字以内
  body: string;           // 正文，150-1000字
  tags: string[];         // 标签，8-12个
  imageKeywords: string[]; // 建议配图关键词（V1 文字显示）
}

interface ComposerRequest {
  topic: string;          // 用户描述的主题，10-500字
  contentType: ContentType;
  tone: ToneType;         // 复用现有类型
  targetLength: 'short' | 'medium' | 'long'; // 200/400/600+
  provider?: ProviderId;  // 可选，覆盖后端默认 provider
  model?: string;         // 可选，覆盖后端默认 model
  regenerate?: RegenerateTarget;
}

type ContentType = 'recommend' | 'knowledge' | 'story' | 'tutorial';
type RegenerateTarget = 'title' | 'body' | 'tags';
```

---

## 6. AI 辅助写作设计

### Prompt 结构（5步压缩成3步）

现有适配功能用 5 次 LLM 调用，原创创作可以压缩：

1. **Step 1**：理解主题 + 规划结构（内部，不 SSE）
2. **Step 2**：生成标题（SSE `title` 事件）
3. **Step 3**：生成正文（SSE `body` 事件，流式 token 输出）
4. **Step 4**：生成标签（SSE `tags` 事件）

总调用次数：3-4 次，比现有的 5 次少，成本更低。

### 用户编辑体验

- 标题：单行 input，可直接点击编辑
- 正文：多行 textarea，自动撑高，可直接编辑
- 标签：tag chip 列表，可单个删除，可手动添加

---

## 7. 成功指标（V1）

| 指标 | 目标 |
|---|---|
| 用户完成一次生成 | 生成完成率 > 70% |
| 用户编辑后复制 | 复制率 > 50%（说明内容有用） |
| 生成质量 | 用户无需大量修改即可直接使用 |
| 主观反馈 | 至少 1 位用户实际发布了用此功能创作的内容 |

---

## 8. 风险与假设

| 风险 | 等级 | 应对 |
|---|---|---|
| AI 生成内容过于通用，缺乏个人感 | 高 | prompt 要求结合用户提供的细节/经历 |
| 用户主题描述太短，AI 无从下手 | 中 | 输入框给引导示例，设置最少字数提示 |
| 与现有功能混淆，用户不知道选哪个 | 中 | Tab 标签文案要清晰区分 |
| 正文太长导致 token 超限 | 低 | 设置 max_tokens，超长时截断并提示 |

---

## 9. 验收与自测基线（2026-04-02）

- 前端：`cd opera-app && npm run build` 通过
- 后端：`cd opera-server-py && D:\software\anacond\python.exe -m pytest -q` 通过，当前为 `12 passed`
- 真实流式烟测：`cd opera-server-py && D:\software\anacond\python.exe scripts/test_e2e.py` 通过，已覆盖 `generate` 与 `compose` 全链路
- 运行入口：Windows 用仓库根目录 `start-backend.ps1`；Linux/macOS 用 `./start-backend.sh`；云端 Docker/Compose 用仓库根目录 `docker compose up --build`
- 部署约束：前端 API 基址支持 `VITE_API_BASE_URL`，开发默认 `http://localhost:3001`，容器 / 生产默认同源 `/api`；`opera-server/` 不再作为运行或验收入口
- 交付前要求：保留现有内容转换链路零回归；原创创作支持标题/正文/标签块级重生成；发布入口仍为置灰占位

## 10. 与现有代码的集成建议

> 后端开发基线已切换到 `opera-server-py/`。`opera-server/` 仅保留为 legacy rollback/reference，不再作为默认扩展目标。

### 新增后端

```text
opera-server-py/app/
  prompts_composer.py         # 原创创作专用 prompt 模板
  routes/compose.py           # POST /api/compose（SSE）
```

### 新增前端组件

```
opera-app/src/
  pages/
    ComposerPage.tsx          # 原创创作页主组件
  components/
    TopicInput.tsx            # 主题输入框
    ContentTypeSelector.tsx   # 内容类型选择
    LengthSelector.tsx        # 字数目标选择
    EditableTitle.tsx         # 可编辑标题块
    EditableBody.tsx          # 可编辑正文块
    EditableTags.tsx          # 可编辑标签块
    PublishActions.tsx        # 复制／发布操作区
```

### 路由/页面切换

在 `App.tsx` 顶部增加 Tab 导航，用 `useState` 控制当前激活页（`'adapter' | 'composer'`），无需引入 React Router。
