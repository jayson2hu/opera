# PRD：微信公众号原创写作功能（WeChat Composer）

> 产出方：Claude Code
> 日期：2026-04-03
> 状态：Phase 1 已完成当前轮开发与自测，当前版本聚焦公众号原创写作与本地草稿箱待发能力

---

## 1. 需求澄清

### 用户目标

用户希望在现有内容创作工具中新增一个独立入口，用于：

- 从主题描述直接生成适合微信公众号发布的原创文章
- 文章生成后继续在线编辑
- 支持复制全文，方便人工发布或外部继续加工
- 提供“保存到草稿箱 / 待发”的产品入口

### 本期边界

本期 **不接真实公众号账号**，因此：

- 不做公众号授权登录
- 不做官方草稿箱真实同步
- 不做真实发布
- 不做素材上传

本期的“草稿箱”定义为：

- 产品与交互层完整可用
- 本地保存最近草稿
- 状态明确标注为 `待同步`
- 为后续真实公众号接入保留数据结构和入口

---

## 2. 功能定位

**功能名称：** 微信公众号原创写作

**一句话定义：** 给 AI 一个选题，生成一篇更适合公众号阅读和发布的完整原创文章，并先保存到待同步草稿箱。

### 与现有功能关系

| 入口 | 起点 | 输出 | 使用场景 |
|---|---|---|---|
| 内容转换 | 已有公众号长文 | 小红书内容包 | 已有长文二次分发 |
| 原创创作 | 一个主题想法 | 小红书帖子 | 生成短内容 |
| 微信公众号 | 一个主题想法 | 公众号标题 + 摘要 + 正文 | 生成长文内容 |

决策：微信公众号能力采用 **第三条独立内容链路**，不污染现有 `/api/generate` 与 `/api/compose`。

---

## 3. V1 功能范围

### 必须有

- 独立 Tab：`微信公众号`
- 主题输入框
- 文章类型选择
- 调性选择（复用现有 3 种）
- 篇幅选择（复用 short / medium / long）
- 模型 Provider / Model 选择（复用现有能力）
- SSE 生成标题、摘要、正文
- 标题 / 摘要 / 正文可在线编辑
- 标题 / 摘要 / 正文支持块级重生成
- 复制全文
- 保存到草稿箱
- 本地草稿列表 + 待同步状态展示

### 明确不做（V1）

- 微信公众号真实账号接入
- 官方草稿箱同步
- 群发 / 发布
- 素材上传与封面管理
- 多账号管理
- 历史版本对比

### 后续扩展点（V2）

- 微信公众号 OAuth / 账号绑定
- 官方草稿箱同步
- 多账号选择与状态管理
- 图文素材与封面图流程
- 定时发布 / 审核流

---

## 4. 核心交互流程

```text
1. 用户点击顶部 Tab「微信公众号」
2. 输入选题描述
3. 选择文章类型、调性、篇幅
4. 可选：切换模型 Provider / Model
5. 点击「开始写公众号文章」
6. 系统依次输出：标题 -> 摘要 -> 正文（流式）
7. 用户直接在线编辑标题、摘要、正文
8. 用户可对任一块单独重生成
9. 用户点击「保存到草稿箱」
10. 草稿进入本地待发列表，状态展示为「待同步」
11. 用户复制全文，后续人工发布或等待未来同步能力
```

---

## 5. 内容模型

```typescript
interface WeChatComposeRequest {
  topic: string;
  articleType: 'insight' | 'guide' | 'story' | 'briefing';
  tone: 'knowledge' | 'casual' | 'bff';
  targetLength: 'short' | 'medium' | 'long';
  provider?: 'anthropic' | 'deepseek' | 'custom';
  model?: string;
  regenerate?: 'title' | 'digest' | 'body';
}

interface WeChatComposeResult {
  title: string;
  digest: string;
  body: string;
}

interface WeChatDraftItem {
  id: string;
  topic: string;
  title: string;
  digest: string;
  body: string;
  articleType: 'insight' | 'guide' | 'story' | 'briefing';
  tone: 'knowledge' | 'casual' | 'bff';
  targetLength: 'short' | 'medium' | 'long';
  status: 'not_saved' | 'queued';
  savedAt: string;
}
```

---

## 6. SSE 协议设计

### 全量生成事件顺序

```text
step(extracting)
step(title)
title
step(digest)
digest
step(body)
body(delta)...
step(done)
```

### 块级重生成

- `title`：`extracting -> title -> done`
- `digest`：`extracting -> digest -> done`
- `body`：`extracting -> body(stream) -> done`

---

## 7. 页面结构

### 左侧主内容区

- Hero 说明区
- 主题输入
- 文章类型选择
- 调性选择
- 篇幅选择
- 模型选择
- 主按钮区
- 进度条
- 标题 / 摘要 / 正文编辑卡片

### 右侧草稿区

- 当前草稿状态
- 保存到草稿箱按钮
- 复制待发全文按钮
- 最近草稿列表
- 待同步说明

---

## 8. 验收标准

### 产品验收

- 顶部导航存在第三个入口 `微信公众号`
- 可完整走通：输入 -> 生成 -> 编辑 -> 保存草稿 -> 复制全文
- 草稿箱必须清晰显示“本地待发 / 未接账号 / 待同步”语义
- 不出现误导性的“已接入公众号发布”文案

### 技术验收

- 前端 `npm run build` 通过
- 后端 `pytest -q` 通过
- `scripts/test_e2e.py` 覆盖 `/api/wechat/compose`
- 现有 `/api/generate` 与 `/api/compose` 零回归

---

## 9. 风险与注意事项

| 风险 | 等级 | 应对 |
|---|---|---|
| 用户误以为已接真实公众号 | 高 | 草稿状态统一使用 `待同步` / `未连接` 文案 |
| 长文输出过于模板化 | 高 | prompt 明确强调结构、判断与个人经验 |
| 正文过长导致等待时间上升 | 中 | 仅正文做高频 SSE，标题/摘要整块返回 |
| 草稿只保存在本地，跨设备不同步 | 中 | 在 UI 中明确说明这是本地草稿箱 |

---

## 10. 与现有代码的集成点

### 前端

- `opera-app/src/App.tsx`
- `opera-app/src/components/TabNav.tsx`
- `opera-app/src/pages/WeChatPage.tsx`
- `opera-app/src/components/wechat/*`
- `opera-app/src/types.ts`
- `opera-app/src/constants.ts`

### 后端

- `opera-server-py/app/main.py`
- `opera-server-py/app/routes/wechat_compose.py`
- `opera-server-py/app/prompts_wechat.py`
- `opera-server-py/app/types.py`
- `opera-server-py/tests/test_api_contract.py`
- `opera-server-py/scripts/test_e2e.py`
