# Documentation Index

This directory is the canonical documentation location for the project.

## Current Docs

- [Opera UI 全面设计探索](design/opera-ui-exploration-2026-09-15.md): 三套 UI 方向、当前产品与信息架构分析、可交互 `/explore` 原型说明、对比与推荐结论。
- [ACCEPTANCE-2026-09-12-RECHECK.md](ACCEPTANCE-2026-09-12-RECHECK.md): **最新验收结果**，`f724cd7` 的 Ubuntu/Docker/Chromium 复验、189 项后端测试、依赖检查、源码指纹与清理记录。
- [FINAL-ACCEPTANCE-2026-09-12.md](FINAL-ACCEPTANCE-2026-09-12.md): 同一修复提交的独立提交后验收，干净副本验证、构建产物核对及单独的清理证据；与复验报告互补，不混用两次运行的环境或指纹。
- [ACCEPTANCE-2026-09-12.md](ACCEPTANCE-2026-09-12.md): 首轮验收历史记录，保留 10 类缺陷、架构对照和验收边界；最新结果见复验报告。
- [PROGRESS-2026-09-12.md](PROGRESS-2026-09-12.md): 进展归档、推送前复测、远程同步范围与待验收项；推送不代表发布完成。
- [PRODUCT-IMPROVEMENT-IMPLEMENTATION.md](PRODUCT-IMPROVEMENT-IMPLEMENTATION.md): **2026-09-10 当前实施状态**，设计冲突取舍、问题台账、自动化结果和剩余验收。
- [DRAFT-WORKSPACE-CONTRACT.md](DRAFT-WORKSPACE-CONTRACT.md): 本轮草稿/候选/局部生成契约、数据范围及手工验收步骤。
- [改善审核清单](product-improvement-review-2026-09-10.html) 与 [可操作原型](preview/product-improvement-prototype-2026-09-10.html): 设计审核依据，不等于已发布功能或验收证据。

- `PROJECT.md`: product scope, architecture, runtime contract, and repository layout.
- `DEPLOYMENT.md`: local, Docker, and release deployment guidance.
- `REVIEW.md`: current review findings, validation result, and follow-up risks.
- `RELEASE-READINESS.md`: current release gates, verification evidence, and go/no-go decision.
- `PLAN.md`: remaining follow-up work and current execution status.
- `CONTENT_REWRITE_IMPROVEMENT_PLAN.md`: completed plan for the Official Account to Xiaohongshu rewrite improvements.
- `XHS_COMPOSER_LAYOUT_IMAGE_PLAN.md`: pending plan for Xiaohongshu composer layout templates and local image attachments.
- `CLAUDE_CHATGPT_PROVIDER_PLAN.md`: pending plan for first-class Claude and ChatGPT/OpenAI model provider support.

## Historical Docs

- `archive/`: previous handoff documents kept for traceability.
- `features/`: feature PRDs and frontend design notes.

Tool-specific files may remain outside this directory when their location is part of the tool contract, for example `CLAUDE.md`.
