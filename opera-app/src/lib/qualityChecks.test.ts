import { describe, expect, it } from 'vitest';
import { BODY_TARGETS, bodyTargetLabel, getQualityChecks } from './qualityChecks';
import type { FlowKind, TargetLength } from '../types';

describe('explainable, flow-specific quality checks', () => {
  for (const flow of Object.keys(BODY_TARGETS) as FlowKind[]) {
    for (const length of ['short', 'medium', 'long'] as TargetLength[]) {
      it(flow + ' / ' + length + ' uses the actual generation target', () => {
        const target = BODY_TARGETS[flow][length];
        const check = (size: number) => getQualityChecks({ flow, targetLength: length, title: '标题', body: '文'.repeat(size) })[0];
        expect(check(target.min - 1).pass).toBe(false);
        expect(check(target.min).pass).toBe(true);
        expect(check(target.max ?? target.min * 2).pass).toBe(true);
        if (target.max) expect(check(target.max + 1).pass).toBe(false);
        expect(check(target.min).detail).toContain(bodyTargetLabel(flow, length));
      });
    }
  }
  it('does not infer title attractiveness, predicted percentages or image rights', () => {
    const checks = getQualityChecks({ flow: 'composer', targetLength: 'short', title: '这是一篇普通但非常清楚具体的创作记录', body: '字'.repeat(200), tags: ['a', 'a', '#a'], imageCount: 9 });
    expect(checks.find((c) => c.id === 'body')?.pass).toBe(true);
    expect(checks.find((c) => c.id === 'title')?.pass).toBe(true);
    expect(checks.find((c) => c.id === 'tags')?.pass).toBe(false);
    expect(checks.find((c) => c.id === 'images')?.manual).toBe(true);
    expect(JSON.stringify(checks)).not.toMatch(/%|完读率|互动潜力/);
  });
  it('checks actual WeChat digest range', () => {
    const checks = getQualityChecks({ flow: 'wechat', targetLength: 'short', title: '标题', body: '文'.repeat(600), digest: '摘'.repeat(60) });
    expect(checks.find((c) => c.id === 'digest')?.pass).toBe(true);
    expect(checks.some((c) => c.id === 'tags')).toBe(false);
  });
});
