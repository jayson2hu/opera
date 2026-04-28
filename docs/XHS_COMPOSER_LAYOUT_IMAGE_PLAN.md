# Xiaohongshu Composer Layout And Image Plan

Status date: 2026-04-28

Execution status: implemented and frontend self-tested.

## Goal

Improve the Xiaohongshu original composer so users can:

1. Format generated or manually edited Xiaohongshu copy before copying it.
2. Preview the final formatted text.
3. Add local images to the draft and manage them visually.
4. Keep existing AI image keyword suggestions as creative references.

This plan only covers the Xiaohongshu original composer flow, currently mapped to the `composer` tab and `ComposerPage`.

## Current Findings

Relevant current files:

- `opera-app/src/pages/ComposerPage.tsx`
- `opera-app/src/components/composer/EditableBody.tsx`
- `opera-app/src/components/composer/ImageSuggestion.tsx`
- `opera-app/src/components/composer/PublishActions.tsx`
- `opera-server-py/app/routes/compose.py`

Current behavior:

- The backend `/api/compose` flow returns title, body, tags, and image keyword suggestions.
- The body editor is a plain auto-growing textarea.
- The image panel only displays keyword suggestions. The upload button is currently disabled.
- Copy actions are text-only.
- There is no backend image upload, image persistence, or publish-to-Xiaohongshu contract.

## Scope Decision

Recommended MVP:

- Frontend-only layout formatting.
- Frontend-only local image attachment and preview.
- No backend image storage in this pass.
- No real platform publishing in this pass.

Reason:

- It solves the current editing workflow without adding storage and deployment risk.
- It keeps the feature small enough to self-test properly.
- It does not block later backend upload support if persistent drafts are required.

## Functional Breakdown

### F01: Layout Template State

Status: completed.

User value:

- Users can choose how the Xiaohongshu note should be structured before copying.

Implementation:

- Add a layout template type, for example `clean`, `list`, `story`, `tutorial`.
- Store selected template in `ComposerPage`.
- Default to `clean`.
- Reset selected template to default when the composer is cleared, if a clear/reset action exists.

Likely files:

- `opera-app/src/pages/ComposerPage.tsx`
- New utility or type file if needed, for example `opera-app/src/components/composer/layoutFormatter.ts`

Self-test:

- Open Xiaohongshu original composer.
- Generate or paste body content.
- Switch all layout template values.
- Verify selected state changes without losing title/body/tags.

Acceptance:

- Template selection is visible and interactive.
- Changing templates does not modify the raw textarea content.
- Existing composer generation still works.

### F02: Deterministic Text Formatter

Status: completed.

User value:

- Users get a cleaner, Xiaohongshu-style formatted output without needing another AI request.

Implementation:

- Add a deterministic formatter that takes:
  - title
  - raw body
  - tags
  - selected layout template
  - optional formatting flags
- Return formatted text for preview and copy.
- Preserve user edits as the source of truth.
- Avoid destructive rewriting; format structure only.

Template behavior:

| Template | Expected behavior |
|---|---|
| `clean` | Split long text into short paragraphs and remove excessive blank lines. |
| `list` | Convert key points into compact list-style paragraphs. |
| `story` | Keep narrative flow: hook, experience, takeaway, interaction. |
| `tutorial` | Emphasize steps, methods, and action-oriented paragraphs. |

Edge rules:

- Empty body should not produce broken output.
- Existing hashtags should not be duplicated.
- Tags should remain grouped at the end.
- Very short text should not be over-split.

Likely files:

- New `opera-app/src/components/composer/layoutFormatter.ts`
- Possible tests if the project already has a frontend test pattern.

Self-test:

- Test empty body.
- Test one short paragraph.
- Test long multi-paragraph body.
- Test body that already includes hashtags.
- Test tags returned by backend and manually edited body together.

Acceptance:

- Formatter output is stable and readable.
- No duplicate hashtag block is created.
- Raw content remains editable and unchanged.
- Preview and copy can reuse the same formatted output.

### F03: Layout Control UI

Status: completed.

User value:

- Users can quickly choose a Xiaohongshu layout style.

Implementation:

- Add a compact layout control panel near the body editor or preview area.
- Use a segmented control or button group for templates.
- Add optional toggles only if they remain clear and compact:
  - emoji accents
  - section dividers
  - keep hashtags at end
- Avoid long in-app instruction text.

Likely files:

- New `opera-app/src/components/composer/ComposerLayoutPanel.tsx`
- `opera-app/src/pages/ComposerPage.tsx`

Self-test:

- Click each template button.
- Toggle optional controls if implemented.
- Confirm active state is visually obvious.
- Confirm controls remain usable at mobile width.

Acceptance:

- Layout options are easy to distinguish.
- Active selection is visually clear.
- Controls do not overlap with editor or preview.
- UI matches the existing app style.

### F04: Formatted Preview

Status: completed.

User value:

- Users can see what will be copied before they copy it.

Implementation:

- Add a formatted preview component.
- Render the formatter output.
- Keep preview read-only.
- Update preview automatically when:
  - title changes
  - body changes
  - tags change
  - template changes
  - optional formatting flags change

Likely files:

- New `opera-app/src/components/composer/FormattedPreview.tsx`
- `opera-app/src/pages/ComposerPage.tsx`

Self-test:

- Edit title and confirm preview updates.
- Edit body and confirm preview updates.
- Change layout template and confirm preview updates.
- Generate new content and confirm preview refreshes.

Acceptance:

- Preview always reflects current draft state.
- Preview is readable on desktop and mobile.
- Preview does not replace the editable body field.

### F05: Copy Formatted Output

Status: completed.

User value:

- Users copy the polished Xiaohongshu note directly, not the raw draft.

Implementation:

- Update copy behavior to use formatted preview text.
- Keep existing copy success and error behavior.
- Decide whether image filenames should be included. Recommended MVP: do not include filenames; copy only title, formatted body, and tags.
- Binary images are not copied in this pass.

Likely files:

- `opera-app/src/components/composer/PublishActions.tsx`
- `opera-app/src/pages/ComposerPage.tsx`

Self-test:

- Copy after generation.
- Copy after manually editing body.
- Copy after switching templates.
- Paste into a plain text editor and compare with preview.

Acceptance:

- Copied text matches formatted preview.
- Title/body/tags are included in the expected order.
- Existing copy button states still work.

### F06: Enable Local Image Selection

Status: completed.

User value:

- Users can add images to the Xiaohongshu draft while preparing the post.

Implementation:

- Enable the existing disabled upload action or replace it with a working file input.
- Accept:
  - `image/png`
  - `image/jpeg`
  - `image/webp`
- Recommended limits:
  - maximum 9 images
  - maximum 8 MB per image
- Store selected files in local component state.

Draft image model:

```ts
type ComposerDraftImage = {
  id: string;
  file: File;
  name: string;
  previewUrl: string;
  alt?: string;
};
```

Likely files:

- `opera-app/src/components/composer/ImageSuggestion.tsx`
- Or new `opera-app/src/components/composer/ImageUploadPanel.tsx`
- `opera-app/src/pages/ComposerPage.tsx`

Self-test:

- Add a PNG image.
- Add a JPEG image.
- Add a WebP image.
- Try a non-image file.
- Try more than 9 images.
- Try an image over the size limit.

Acceptance:

- Valid images are accepted.
- Invalid files are rejected with a clear UI state.
- The composer does not crash on invalid input.
- Existing AI image keywords remain visible.

### F07: Image Thumbnail List

Status: completed.

User value:

- Users can confirm which images are attached before using the draft.

Implementation:

- Show thumbnails for all selected images.
- Show compact metadata such as filename or image count.
- Add remove action per image.
- Keep thumbnails in a stable grid.
- Use `URL.createObjectURL` for preview.
- Revoke object URLs when images are removed or draft is reset.

Likely files:

- `opera-app/src/components/composer/ImageSuggestion.tsx`
- Or new `opera-app/src/components/composer/ImageUploadPanel.tsx`

Self-test:

- Add multiple images and verify thumbnails render.
- Remove the first image.
- Remove the last image.
- Add images again after removal.
- Reset composer and verify images clear.

Acceptance:

- Thumbnail list reflects current image state.
- Remove action works for every image.
- Layout remains stable when images are added or removed.
- No broken image previews remain after removal.

### F08: Image Validation And Error State

Status: completed.

User value:

- Users understand why an image cannot be added.

Implementation:

- Add validation for type, size, and count.
- Show a concise inline error or status state near the image panel.
- Clear the error after a valid action or when the user retries.
- Do not use blocking browser alerts.

Likely files:

- `ImageSuggestion.tsx` or `ImageUploadPanel.tsx`

Self-test:

- Upload unsupported file type.
- Upload image exceeding the size limit.
- Upload beyond maximum count.
- Then upload a valid image and verify error clears.

Acceptance:

- Invalid action is blocked.
- User sees a concise reason.
- Valid uploads still work after an error.

### F09: Preserve Existing AI Image Keywords

Status: completed.

User value:

- Users keep AI-generated image direction while also adding their own images.

Implementation:

- Keep the current image keyword section.
- Place uploaded images and keyword suggestions in the same panel or adjacent subsections.
- Uploaded images should not overwrite keyword suggestions.

Likely files:

- `ImageSuggestion.tsx`
- `ComposerPage.tsx`

Self-test:

- Generate a post with image keyword suggestions.
- Add local images.
- Remove local images.
- Confirm keywords remain unchanged.

Acceptance:

- Image keyword suggestions still display after generation.
- Local image state is independent from AI suggestions.

### F10: Responsive Layout And Visual Polish

Status: completed.

User value:

- The new controls look intentional and remain usable on different screen sizes.

Implementation:

- Ensure layout panel, preview, and image grid work on desktop and mobile.
- Keep buttons and labels within their containers.
- Add modest card/control emphasis so the new feature is visually discoverable.
- Avoid nested cards and oversized marketing-style blocks.

Likely files:

- Composer components and associated CSS/Tailwind classes.

Self-test:

- Desktop browser width around 1440px.
- Tablet width around 768px.
- Mobile width around 390px.
- Check long title/body/tags.
- Check 9 image thumbnails.

Acceptance:

- No overlapping text or controls.
- Buttons remain readable and clickable.
- Preview and image grid do not cause horizontal scrolling.

## Delivery Sequence

### Phase 1: Layout Foundation

Status: completed.

Includes:

- F01 Layout Template State
- F02 Deterministic Text Formatter
- F03 Layout Control UI

Self-test gate:

- Templates switch correctly.
- Raw text remains unchanged.
- Existing generation flow still works.

### Phase 2: Preview And Copy

Status: completed.

Includes:

- F04 Formatted Preview
- F05 Copy Formatted Output

Self-test gate:

- Preview updates from all draft changes.
- Copied text matches preview.

### Phase 3: Image Attachments

Status: completed.

Includes:

- F06 Enable Local Image Selection
- F07 Image Thumbnail List
- F08 Image Validation And Error State
- F09 Preserve Existing AI Image Keywords

Self-test gate:

- Valid images can be added.
- Invalid images are rejected.
- Images can be removed.
- AI keyword suggestions remain visible.

### Phase 4: Responsive And Regression Pass

Status: completed.

Includes:

- F10 Responsive Layout And Visual Polish
- Frontend lint/build verification
- Backend tests only if backend files are changed

Self-test gate:

- Desktop and mobile manual checks pass.
- `npm.cmd run lint` passes.
- `npm.cmd run build` passes.
- `python -m pytest -q` passes only if backend behavior is changed.

Deferred:

- Docker full-stack smoke test remains deferred and should not be run in this pass.

## Full Self-Test Checklist

Execution result:

- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed outside the restricted sandbox after the first sandbox run hit Windows `spawn EPERM` while loading the Tailwind native dependency.
- Backend tests were not run because this pass did not change backend behavior.
- Docker full-stack smoke test remains deferred by prior request.

Manual checks:

- Generate Xiaohongshu original content successfully.
- Edit title and body manually.
- Switch each layout template.
- Confirm formatted preview updates.
- Copy formatted output and compare pasted result with preview.
- Add PNG, JPG, and WebP images.
- Remove images one by one.
- Try unsupported file type.
- Try image count over limit.
- Try image over size limit.
- Confirm AI image keywords remain visible.
- Confirm mobile layout has no overlap.

Automated checks:

- `npm.cmd run lint`
- `npm.cmd run build`
- `python -m pytest -q` only if backend behavior changes

Not run in this pass:

- `docker compose up --build`

## Final Acceptance Criteria

The feature is acceptable when all of the following are true:

- Xiaohongshu original composer has visible layout controls.
- Users can switch templates without losing raw body edits.
- Preview reflects the selected layout and current draft.
- Copy output matches preview text.
- Users can attach local images and see thumbnails.
- Users can remove attached images.
- Invalid image files are rejected without breaking the composer.
- Existing AI image keyword suggestions still work.
- Desktop and mobile layouts have no visible overlap.
- Frontend lint and build pass.
- Backend tests pass if backend behavior changes.
- Docker full-stack smoke test remains documented as deferred.

## Open Decisions For Review

1. Images: keep frontend-only local draft images for MVP, or add backend upload and persistence now?
2. Formatting: use deterministic frontend formatting first, or add an AI-powered "重新排版" action?
3. Copy output: copy only title/body/tags, or include image filenames as placeholders?
4. Templates: keep four fixed templates, or add custom template input?

## Recommended Review Decision

Approve the frontend-only MVP:

- Four fixed layout templates.
- Formatted preview.
- Copy formatted text.
- Local image upload with thumbnails.
- No backend image persistence.
- No Docker full-stack smoke test in this pass.
