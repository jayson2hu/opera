# CLAUDE.md

This file guides Claude Code when working in this repository.

## Overview

**Opera** is a content adaptation tool that converts WeChat Official Account (WOA) long-form articles into Xiaohongshu (XHS) post packages.

The product is currently in **pre-development**. No application code exists yet. Work should stay aligned with the validated MVP scope and must not expand into publishing, account systems, or image editing unless the product definition is explicitly updated.

## Product Positioning

Opera is a **content adaptation** tool, not a publishing platform.

It solves **format friction**: the time and effort required to turn a formal, long-form WeChat article into a social-first Xiaohongshu post package.

### Core Product Direction
- Focus on **adaptation**, not distribution
- Convert pasted article text into a structured XHS-ready content package
- Keep the workflow lightweight and manual where possible
- Avoid unnecessary engineering complexity in V1

## Target User

The primary target user is an **overwhelmed solo creator** who:
- actively writes on WeChat Official Account
- has a weak or inconsistent Xiaohongshu presence
- wants to repurpose existing content instead of creating from scratch
- works in knowledge, career, business, education, or lifestyle niches
- typically has roughly 1k–50k followers / audience scale

## Current Phase

The project is in **Phase 0: Validation**.

This means:
- no production app should be assumed to exist
- no codebase architecture should be invented as if implementation is already underway
- priority is validating the workflow manually before building software

The next technical step happens **only after validation is successful**.

## MVP Boundary

Treat the following as the hard scope for V1.

### Input
- pasted article text only

### Output
- structured XHS post package
- slide text cards
- caption
- hashtags or tag suggestions

### Explicitly Out of Scope
- URL scraping
- WeChat crawling
- Xiaohongshu publishing
- account connection
- login or auth
- user accounts
- image editor
- image generation
- analytics dashboard
- collaboration workflows
- content calendar
- multi-account management
- workflow approvals

Do not expand beyond this scope unless the product definition is explicitly updated.

## User Workflow

The intended V1 workflow is:

1. User pastes WeChat article text
2. System converts it into an XHS post package
3. User reviews and copies the generated output
4. User assembles and publishes using their own tools, such as Canva, Meitu, or the XHS app

This is a **copy-to-clipboard workflow**, not an automated publishing flow.

## Key Product Decisions

### 1. Pasted Text Instead of URL Input
Use pasted article text as the only input in V1.

Reason:
- avoids WeChat anti-scraping issues
- avoids brittle crawler logic
- keeps implementation simple
- reduces maintenance risk

### 2. Post Package Instead of Final Published Post
The product should generate an **editable package**, not a one-click final post.

Reason:
- a rough draft creates too much user work
- a “fully finished” AI post is fragile and easy to mistrust
- editable structured output is the most practical midpoint

### 3. Manual Publishing by the User
Do not build publishing automation in V1.

Reason:
- reduces API risk
- avoids account-ban and compliance issues
- keeps the product focused on core user value

## Source of Truth

Use the following files as the main project references:

- `handoff.md` — full MVP definition, development phases, product decisions, and risks
- `skills/` — Claude Code skill definitions
- `skills-lock.json` — skill version lock file

If there is any ambiguity, prefer `handoff.md` as the source of truth for product scope and decision history.

## Skills Context

This repository includes Claude Code skills.

Notable skill:
- `decision-clarity` — used for product definition, scope reduction, and decision analysis

Use skills to preserve the product boundary and reduce premature complexity. Do not use them to justify scope expansion beyond the validated MVP.

## Implementation Guidance

When writing plans, specs, or code:
- stay inside the validated MVP boundary
- prefer the smallest workable solution
- optimize for speed of validation, not completeness
- keep systems stateless where possible in early versions
- avoid speculative infrastructure
- avoid building platform features before the core conversion workflow is validated
- implement in small, reviewable increments
- favor simple architecture over future-proof abstractions
- keep each change easy to explain, test, and hand off

## Delivery Discipline

Every implementation task must include basic self-verification, progress reporting, and handoff documentation.

Do not treat coding as complete when the code is only written. A task is complete only after:
1. the implementation is self-tested
2. progress is documented
3. handoff notes are updated

Code without verification and documentation is not considered complete.

## Self-Testing Requirement

For every feature, bug fix, or meaningful code change, Claude Code must perform self-testing before considering the task complete.

Self-testing should include, when applicable:
- running relevant unit tests
- running local integration or end-to-end checks for the changed flow
- manually verifying the user-facing behavior
- checking obvious edge cases and failure states
- confirming there are no broken imports, build errors, or startup errors

If formal automated tests do not exist yet, Claude Code must still perform lightweight manual verification and clearly state:
- what was tested
- how it was tested
- what was not tested

Do not claim a feature is complete without reporting the verification result.

## Early-Stage Testing Guidance

This project is still in an early MVP stage.

Testing should be pragmatic:
- prefer lightweight, high-signal verification first
- do not overbuild test infrastructure before the core workflow is validated
- add formal automated tests where they meaningfully reduce regression risk
- for early features, simple reproducible manual test steps are acceptable if automated tests are not yet justified

The goal is reliable iteration, not test-suite bloat.

## Progress Sync Requirement

After each meaningful implementation step, Claude Code must sync progress in a concise written update.

A progress update should include:
- what was completed
- what is currently working
- what remains unfinished
- any blockers, risks, or open questions
- whether the change has been self-tested

Progress updates should be brief but specific. Do not use vague statements like “done” or “implemented” without explaining what actually changed.

Do not leave silent progress.

## Handoff Documentation Requirement

After each completed feature, milestone, or development session, Claude Code must update or create handoff documentation.

Handoff documentation should include:
- what was built or changed
- the current status
- how to run or verify it
- known issues or limitations
- next recommended steps
- any scope decisions made during implementation

Prefer updating an existing handoff file when one already exists. If no implementation handoff file exists yet, create one.

Suggested file patterns:
- `handoff.md` for product and project-level handoff
- `dev-handoff.md` or `implementation-log.md` for development progress and engineering handoff
- feature-specific notes only when necessary

Do not leave undocumented changes.

## Suggested Handoff Template

When updating handoff documentation, use this structure when practical:

### Summary
What was completed in this session

### Changes Made
Key files, components, APIs, or flows added or modified

### Verification
What was tested  
How it was tested  
What remains untested

### Current Status
What is working now

### Known Issues / Risks
Any bugs, limitations, or uncertainties

### Next Steps
The most logical follow-up tasks

## Definition of Done

A task is not done unless all of the following are true:
- the scoped implementation is complete
- the changed behavior has been self-tested
- progress has been recorded
- handoff documentation has been updated
- any known risks, gaps, or follow-up work are explicitly listed

## What Claude Code Should Avoid

Do not:
- assume the app already exists
- introduce publishing flows
- add auth or account models without explicit approval
- add scraping infrastructure in V1
- design for teams, collaboration, or enterprise workflows
- expand into image editing or media generation
- turn a simple converter into a full content platform
- present unverified code as complete
- make silent scope changes without documenting them

## Near-Term Goal

The immediate goal is to support the transition from **manual validation** to the **smallest useful single-page web tool**.

That tool should do one thing well:

**convert pasted WeChat article text into a usable Xiaohongshu post package.**