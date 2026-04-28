# Feature Notes

This folder contains historical product and design planning documents. They are retained for traceability, not as the current source of truth.

Use the current docs first:

- `../PROJECT.md`
- `../DEPLOYMENT.md`
- `../REVIEW.md`
- `../PLAN.md`

## File Status

- `xhs-composer-PRD.md`: historical PRD for the XHS Composer flow. The file contains extensive mojibake and should not be used as an authoritative implementation spec.
- `wechat-composer-PRD.md`: historical PRD for the WeChat Composer flow. The file contains extensive mojibake and should not be used as an authoritative implementation spec.
- `frontend-DESIGN.md`: historical frontend design notes. The file contains extensive mojibake; current UI behavior should be verified from the running frontend and source files.

## Reliable Current Feature Summary

- Content Adapter: paste source article text and generate XHS cover titles, slide cards, caption, and hashtag groups.
- XHS Composer: start from a topic and generate title, body, tags, and image keywords.
- WeChat Composer: start from a topic and generate title, digest, body, and local draft content.

## Encoding Repair Decision

The corrupted historical text cannot be restored safely from the current repository contents. Instead of guessing the original wording, this folder keeps the original files unchanged and provides this clean index to mark their reliability.
