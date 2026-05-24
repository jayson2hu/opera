# Opera UI 设计稿

> 打开方式：直接在浏览器中打开 `.html` 文件即可预览（需联网加载 Tailwind CDN）

## 文件清单

| 文件 | 组件 | 改进点 |
|------|------|--------|
| `01-cover-titles-selective-copy.html` | 封面标题区 | 单条复制 + 多选批量复制 |
| `02-slide-cards-selective-copy.html` | 图文卡片区 | 卡片用途标签 + 字数 + 选择性复制 |
| `03-extraction-points-panel.html` | 核心观点面板 | 提取结果展示 + 用户可取消观点再继续 |
| `04-caption-word-count.html` | 正文区 | 字数统计 + 超长警告（800 字阈值） |
| `05-copy-actions-bar.html` | 复制操作栏 | 统一顶部操作条的 3 种状态 |

## 设计系统

所有设计稿使用项目现有的 Tailwind 配色：

- **Primary**（橙色 #ee8019）：主操作、选中态、进度
- **Accent**（紫色 #8b5cf6）：次要强调、卡片装饰
- **Neutral**（石色）：文字、边框、背景
- **Success**（绿色 #22c55e）：复制成功反馈
- **Warning**（琥珀色 #f59e0b）：字数超长警告

## 审核要点

1. 每个文件展示了组件的多种状态（默认、选中、反馈）
2. 交互逻辑通过 vanilla JS 实现，可直接点击体验
3. 确认设计后将转为 React 组件实现

## 对应 React 组件

| 设计稿 | 现有组件 | 改动类型 |
|--------|----------|----------|
| 01 | `CoverTitles.tsx` | 修改 |
| 02 | `SlideCards.tsx` | 修改 |
| 03 | 新增 `ExtractionPointsPanel.tsx` | 新建 |
| 04 | `Caption.tsx` | 修改 |
| 05 | 顶部操作栏（嵌入 `AdapterPage.tsx`） | 修改 |

## 后端改动

`generate.py` 需要新增一个 SSE 事件 `extraction_points`，在提取完成后将观点列表发送给前端，等待用户确认后再继续生成。
