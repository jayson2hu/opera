# Opera UI 改进开发计划

> 基于 UX 体验报告高优先级改进项，设计稿已审核通过

## 目标

实现 3 个核心改进：
1. 选择性复制（封面标题 + 图文卡片 + 正文）
2. 核心观点展示与用户干预
3. 字数统计与超长警告

## 阶段划分

### Phase 1：选择性复制（预计 3 天）

**改动文件：**
- `opera-app/src/components/CoverTitles.tsx` — 增加 checkbox + 单条复制按钮
- `opera-app/src/components/SlideCards.tsx` — 增加 checkbox + 用途标签 + 单条复制
- `opera-app/src/components/Caption.tsx` — 增加字数显示 + 单独复制按钮
- `opera-app/src/components/CopyButton.tsx` — 扩展支持"复制选中 (N)"模式
- `opera-app/src/pages/AdapterPage.tsx` — 管理选中状态，替换顶部操作栏

**实现要点：**
- AdapterPage 维护 `selectedTitles: Set<number>`、`selectedCards: Set<number>`、`captionSelected: boolean`
- 每个子组件通过 props 接收 selected 状态和 onToggle 回调
- 复制逻辑：标题用 `\n---\n` 分隔，卡片用 `\n\n---\n\n` 分隔
- 复制成功后显示 1.5s 绿色反馈态

**验收标准：**
- [ ] 每个标题/卡片可单独复制
- [ ] 勾选多个后"复制选中"按钮激活
- [ ] 复制成功有视觉反馈
- [ ] 未选中时"复制全部"仍可用

---

### Phase 2：字数统计与超长警告（预计 1 天）

**改动文件：**
- `opera-app/src/components/Caption.tsx` — 字数 badge + 警告条
- `opera-app/src/constants.ts` — 新增 `CAPTION_WARN_THRESHOLD = 800`

**实现要点：**
- 字数统计：`text.replace(/\s/g, '').length`（去空格计中文字符）
- 正常态：灰色 badge `623 字`
- 警告态（>800）：琥珀色 badge `1,142 字` + 黄色提示条
- 短文态（<500）：绿色 badge `387 字 · 适合发布`

**验收标准：**
- [ ] 字数实时显示
- [ ] 超过 800 字显示警告提示
- [ ] 500 字以内显示"适合发布"

---

### Phase 3：核心观点展示与用户干预（预计 4 天）

**改动文件：**

后端：
- `opera-server-py/app/routes/generate.py` — 提取完成后发送 `extraction_points` SSE 事件，等待前端确认
- `opera-server-py/app/routes/generate.py` — 新增 `POST /api/generate/continue` 接口接收用户选中的观点

前端：
- 新建 `opera-app/src/components/ExtractionPointsPanel.tsx` — 观点列表面板
- `opera-app/src/pages/AdapterPage.tsx` — 接收观点事件，暂停流程，展示面板
- `opera-app/src/types.ts` — 新增 `ExtractionPoint` 类型

**实现要点：**

后端流程变更：
```
原流程：extracting → titles → cards → caption → tags → done
新流程：extracting → extraction_points(暂停) → 用户确认 → titles → cards → caption → tags → done
```

方案选择：**两段式请求**
1. 第一次请求 `/api/generate`：只做提取，返回观点列表后结束 SSE
2. 用户确认后，第二次请求 `/api/generate/continue`：带上选中的观点，继续生成标题/卡片/正文/标签

这样避免了长连接等待的复杂性。

前端交互：
- 提取完成后进度条暂停，展开内联面板
- 面板显示 6-8 个观点，默认全选
- 用户可取消不需要的观点
- 点击"继续生成"发起第二段请求
- 至少保留 3 个观点才能继续

**验收标准：**
- [ ] 提取完成后展示观点列表
- [ ] 用户可取消勾选观点
- [ ] 少于 3 个观点时"继续生成"按钮禁用
- [ ] 确认后基于选中观点继续生成
- [ ] 全选/取消全选快捷操作可用

---

## 开发顺序

```
Week 1:
  Day 1-2: Phase 1 — CoverTitles + SlideCards 选择性复制
  Day 3:   Phase 1 — AdapterPage 状态管理 + 操作栏
  Day 4:   Phase 2 — Caption 字数统计

Week 2:
  Day 5:   Phase 3 — 后端拆分（extraction_points 事件 + continue 接口）
  Day 6-7: Phase 3 — 前端 ExtractionPointsPanel + AdapterPage 流程改造
  Day 8:   集成测试 + 边界情况处理
```

## 技术约束

- 不引入新依赖，复用现有 Tailwind + React 模式
- 选中状态仅存在于组件生命周期内，不持久化到 localStorage
- 后端新接口复用现有 provider/validation 逻辑
- SSE 事件格式保持与现有 `format_sse` 一致

## 测试策略

- Phase 1/2：启动前端 dev server，手动验证各状态
- Phase 3：先用 curl 测试后端两段式接口，再集成前端验证完整流程
- 所有 Phase：确认移动端响应式布局正常
