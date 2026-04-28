# Content Rewrite Improvement Plan

Status date: 2026-04-28

Execution status: approved for implementation.

## Goal

Improve the current "content rewrite" flow so the product structure is clearer and the generated Xiaohongshu output is substantial enough for real use.

The target product order is:

1. WeChat Official Account content creation
2. WeChat Official Account to Xiaohongshu rewrite
3. Xiaohongshu original content creation

Docker full-stack smoke testing remains deferred and is not part of this plan.

## Current Findings

Current frontend tab mapping:

- `wechat`: WeChat Composer
- `adapter`: Content rewrite / article-to-XHS adapter
- `composer`: Xiaohongshu Composer

Current issues:

- The default first tab is `adapter`, but the desired first tab is WeChat Official Account.
- The tab order is currently content rewrite, Xiaohongshu, WeChat. It should become WeChat, rewrite, Xiaohongshu.
- The current "content rewrite" label is too generic. It does not clearly communicate "WeChat article to Xiaohongshu".
- The adapter generation prompt is too short for practical output:
  - cards: fixed at 5 cards
  - caption: only 200-300 Chinese characters
  - extraction: only 4-6 points
  - title generation: 4 titles

## Proposed Naming

Rename the current content rewrite entry from:

- `内容改写`

To:

- `公众号转小红书`

Rationale:

- It directly describes the workflow.
- It avoids generic wording.
- It makes the input/output direction obvious: WeChat Official Account article in, Xiaohongshu post out.

Recommended tab labels:

1. `微信公众号`
2. `公众号转小红书`
3. `小红书原创`

## Frontend Changes

### 1. Tab Order

Update `opera-app/src/components/TabNav.tsx` tab order to:

1. `wechat`
2. `adapter`
3. `composer`

### 2. Default Page

Update `opera-app/src/App.tsx` default active tab:

- from `adapter`
- to `wechat`

### 3. Copy Cleanup

Update visible copy in the adapter page so the page consistently describes the workflow as:

- input: WeChat Official Account article or long-form source article
- output: Xiaohongshu titles, cards, caption, and tags

Primary page heading proposal:

- `公众号文章转小红书`

Supporting copy proposal:

- `粘贴公众号文章或长文素材，生成更完整的小红书标题、图文卡片、正文和标签。`

Primary button proposal:

- `生成小红书改写稿`

### 4. Caption Length Option

Add a visible length selector on the rewrite page.

Recommended options:

| Option | Label | Target caption length |
|---|---|---|
| `short` | 精简版 | 300-500 Chinese characters |
| `medium` | 标准版 | 600-900 Chinese characters |
| `long` | 深度版 | 1000-1500 Chinese characters |

Default:

- `medium`

Rationale:

- Some users need a concise post body.
- Some users need a richer Xiaohongshu post that keeps more of the original article.
- A fixed length requirement is too rigid for different source articles.

UI placement:

- Put the length selector after tone selection and before provider/model selection.
- Use a segmented control or compact button group.
- Show the selected range in the option subtitle, for example `600-900字`.

## Backend Generation Changes

Target file:

- `opera-server-py/app/prompts.py`

### 1. Extraction Depth

Change extraction target:

- from `4-6` core points
- to `6-8` core points

Purpose:

- Give card generation and caption generation more material.
- Reduce shallow summaries.

### 2. Card Count And Density

Change card generation:

- from 5 cards
- to 7 cards

Recommended structure:

1. hook / pain point
2. core insight 1
3. core insight 2
4. core insight 3
5. method / checklist
6. example / application scenario
7. action summary

Change card length:

- from 50-80 Chinese characters each
- to 70-110 Chinese characters each

Purpose:

- Keep each card usable as Xiaohongshu slide text.
- Increase information density without turning cards into full paragraphs.

### 3. Caption Length

Change caption generation from a fixed target to a user-selected target:

- `short`: 300-500 Chinese characters
- `medium`: 600-900 Chinese characters
- `long`: 1000-1500 Chinese characters

Recommended caption structure:

- opening hook: 1-2 short paragraphs
- body: 3-5 key points expanded from the original article
- practical takeaway: 2-3 actionable steps
- closing interaction prompt

Purpose:

- Make the rewritten output usable as a complete Xiaohongshu post body.
- Avoid output that feels like only a summary.

Implementation note:

- Extend `POST /api/generate` request body with optional `targetLength`.
- Keep backward compatibility by defaulting missing `targetLength` to `medium`.
- Update backend validation to accept only `short`, `medium`, or `long`.
- Update frontend types and request payload.

### 4. Title Count

Change title generation:

- from 4 titles
- to 6 titles

Suggested formulas:

- number-based
- contrast-based
- pain-point-based
- identity-based
- benefit-based
- curiosity-based

Purpose:

- Give the user more usable title options.

## API Contract

No endpoint changes are required.

The existing endpoint remains:

- `POST /api/generate`

Request body adds one optional field:

- `targetLength?`: `short` | `medium` | `long`

Expected SSE events remain:

- `step`
- `titles`
- `cards`
- `caption`
- `tags`
- `error`

Only the generated content volume, prompt requirements, and optional request payload should change.

## Card Visual Enhancement

The current generated card output is too understated. Improve the visible card presentation so users can quickly see that these are Xiaohongshu slide cards.

Target component:

- `opera-app/src/components/SlideCards.tsx`

Recommended visual changes:

- Add a stronger card number badge, for example `01`, `02`, `03`.
- Use subtle per-card accent colors or gradient strips, not a one-color layout.
- Add a clear card header such as `小红书卡片`.
- Increase body text size and line height for readability.
- Add hover lift and shadow on desktop.
- Add an active/focus state for keyboard users.
- Keep each card copy button easy to find.

Constraints:

- Do not make cards visually noisy.
- Do not use decorative orbs or unrelated illustrations.
- Keep mobile layout stable; card height should not jump heavily on hover.
- Avoid nested cards.

Optional enhancement:

- Add a small `复制` action in each card header.
- Add a `预览排版` feel using a light colored top bar and card index, but keep it text-first.

## Test Plan

Run after implementation:

```bash
cd opera-server-py
python -m pytest -q
python scripts/test_e2e.py

cd ../opera-app
npm.cmd run lint
npm.cmd run build
```

Manual checks:

- App opens on `微信公众号` by default.
- Tab order is `微信公众号` -> `公众号转小红书` -> `小红书原创`.
- The rewrite tab heading and button clearly say it converts official account articles to Xiaohongshu.
- Rewrite page has a caption length selector with `精简版`, `标准版`, and `深度版`.
- Rewrite output includes:
  - 6 title options
  - 7 card texts
  - caption length follows the selected range
  - tag groups
- Generated slide cards have stronger visual hierarchy and are clearly recognizable as card outputs.

## Implementation Order

1. Update frontend tab labels, order, default tab, and adapter page copy.
2. Add rewrite caption length selector and wire it into `/api/generate`.
3. Update backend adapter request validation and prompts for length ranges.
4. Update backend adapter prompts for deeper extraction, more titles, and more cards.
5. Improve slide card visual styling and interaction states.
6. Update tests that assume exact event payload shape or item count.
7. Run automated tests.
8. Manually smoke test the running frontend.
9. Update `docs/PLAN.md` and `docs/REVIEW.md` with results.
10. Commit and push after validation.

## Development Task Breakdown

### Task 1: Navigation And Naming

Status: completed

Files:

- `opera-app/src/components/TabNav.tsx`
- `opera-app/src/App.tsx`
- `opera-app/src/components/Header.tsx`
- `opera-app/src/pages/AdapterPage.tsx`

Work:

- Change default tab to `wechat`.
- Change tab order to `wechat`, `adapter`, `composer`.
- Rename adapter tab to `公众号转小红书`.
- Use clear readable Chinese copy for the adapter page heading, subtitle, button, completion labels, and empty state.

Self-test:

- `npm.cmd run lint`
- `npm.cmd run build`

Manual acceptance:

- First page after load is `微信公众号`.
- Tab order is `微信公众号`, `公众号转小红书`, `小红书原创`.
- Rewrite page copy clearly explains official account article to Xiaohongshu conversion.

### Task 2: Rewrite Caption Length Selector

Status: completed

Files:

- `opera-app/src/types.ts`
- `opera-app/src/constants.ts`
- `opera-app/src/pages/AdapterPage.tsx`
- `opera-server-py/app/types.py`
- `opera-server-py/app/routes/generate.py`

Work:

- Add adapter `targetLength` state with default `medium`.
- Add a compact selector with `精简版`, `标准版`, `深度版`.
- Send `targetLength` in `/api/generate` request body.
- Validate backend accepted values: `short`, `medium`, `long`.
- Default missing backend `targetLength` to `medium` for backward compatibility.

Self-test:

- `python -m pytest -q`
- `npm.cmd run lint`
- `npm.cmd run build`

Manual acceptance:

- Rewrite page shows all three length options.
- The selected option remains highlighted during generation.
- Existing clients without `targetLength` still work.

### Task 3: Rewrite Output Depth

Status: completed

Files:

- `opera-server-py/app/prompts.py`
- `opera-server-py/scripts/test_e2e.py`
- `opera-server-py/tests/test_api_contract.py`

Work:

- Extract 6-8 core points.
- Generate 6 title options.
- Generate 7 slide cards.
- Generate caption by selected length range:
  - `short`: 300-500 Chinese characters
  - `medium`: 600-900 Chinese characters
  - `long`: 1000-1500 Chinese characters

Self-test:

- `python -m pytest -q`
- `python scripts/test_e2e.py`

Manual acceptance:

- Rewrite output feels complete, not just a short summary.
- Card count is 7.
- Title count is 6.
- Caption length follows the selected range.

### Task 4: Slide Card Visual Enhancement

Status: completed

Files:

- `opera-app/src/components/SlideCards.tsx`

Work:

- Add stronger `01`, `02`, `03` card index badges.
- Add subtle accent top bars and per-card visual variation.
- Increase text readability.
- Add hover/focus lift and stronger card hierarchy.
- Keep copy/edit actions visible.

Self-test:

- `npm.cmd run lint`
- `npm.cmd run build`

Manual acceptance:

- Generated cards are visually obvious as slide cards.
- Cards remain readable on desktop and mobile widths.
- Edit and copy actions still work.

### Task 5: Documentation And Final Validation

Status: completed

Files:

- `docs/CONTENT_REWRITE_IMPROVEMENT_PLAN.md`
- `docs/PLAN.md`
- `docs/REVIEW.md`

Work:

- Update task statuses after implementation.
- Record test results.
- Keep Docker full-stack smoke test deferred.

Final self-test:

```bash
cd opera-server-py
python -m pytest -q
python scripts/test_e2e.py

cd ../opera-app
npm.cmd run lint
npm.cmd run build
```

Manual smoke:

- `GET http://127.0.0.1:3001/api/health`
- `GET http://127.0.0.1:5173`
- Browser check for tab order and rewrite page controls.

## Final Validation Result

Status: passed

- `python -m pytest -q`: passed, 26 tests.
- `python scripts/test_e2e.py`: passed with real provider credentials.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed outside the restricted command sandbox.
- `GET http://127.0.0.1:3001/api/health`: 200.
- `GET http://127.0.0.1:5173`: 200.
- Source scan confirmed the expected tab labels and rewrite length options are present.

Docker full-stack smoke testing remains deferred by request.
