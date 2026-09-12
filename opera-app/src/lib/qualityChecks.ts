import { countChars } from '../constants';
import type { FlowKind, TargetLength } from '../types';

export const BODY_TARGETS: Record<FlowKind, Record<TargetLength, { min: number; max?: number }>> = {
  composer: { short: { min: 180, max: 240 }, medium: { min: 320, max: 450 }, long: { min: 600 } },
  adapter: { short: { min: 300, max: 500 }, medium: { min: 600, max: 900 }, long: { min: 1000 } },
  wechat: { short: { min: 500, max: 800 }, medium: { min: 900, max: 1400 }, long: { min: 1600 } },
};
export const bodyTargetLabel = (flow: FlowKind, length: TargetLength): string => {
  const target = BODY_TARGETS[flow][length];
  return target.max ? target.min + '–' + target.max + ' 字' : target.min + ' 字以上';
};
export interface QualityInput {
  flow: FlowKind; targetLength: TargetLength; title: string; body: string;
  tags?: string[]; digest?: string; imageCount?: number;
}
export interface QualityCheck { id: string; label: string; pass: boolean; detail: string; manual?: boolean }

export function getQualityChecks(input: QualityInput): QualityCheck[] {
  const bodyChars = countChars(input.body), titleChars = countChars(input.title);
  const target = BODY_TARGETS[input.flow][input.targetLength];
  const inRange = bodyChars >= target.min && (target.max === undefined || bodyChars <= target.max);
  const titleMin = input.flow === 'wechat' ? 14 : input.flow === 'composer' ? 15 : 1;
  const titleMax = input.flow === 'wechat' ? 32 : 25;
  const checks: QualityCheck[] = [
    { id: 'body', label: '正文篇幅', pass: inRange, detail: bodyChars + ' 字 · 当前稿件目标 ' + bodyTargetLabel(input.flow, input.targetLength) + (inRange ? '，已达到' : '，请按内容需要调整') },
    { id: 'title', label: '标题长度', pass: titleChars >= titleMin && titleChars <= titleMax,
      detail: titleChars + ' 字 · 写作建议 ' + titleMin + '–' + titleMax + ' 字；不评估吸引力或平台审核结果' },
  ];
  if (input.flow === 'composer') {
    const tags = Array.from(new Set((input.tags ?? []).map((tag) => tag.trim().replace(/^#/, '')).filter(Boolean)));
    checks.push({ id: 'tags', label: '标签数量', pass: tags.length >= 6 && tags.length <= 10,
      detail: tags.length + ' 个去重标签 · 生成目标 6–10 个；相关性需人工核对' });
  }
  if (input.flow === 'wechat') {
    const chars = countChars(input.digest ?? '');
    checks.push({ id: 'digest', label: '摘要长度', pass: chars >= 60 && chars <= 120,
      detail: chars + ' 字 · 生成目标 60–120 字' });
  }
  checks.push(
    { id: 'facts', label: '事实与表达', pass: false, manual: true, detail: '人工核对数字、来源、引语和亲身经历；模型不能替代事实核验。' },
    { id: 'images', label: '图片与授权', pass: false, manual: true,
      detail: input.imageCount !== undefined ? '当前选择 ' + input.imageCount + ' 张临时图片；确认版权及图文一致性，刷新后需重新选择。' : '确认封面和配图已准备、取得使用授权；装饰占位图不是已生成的图片。' },
  );
  return checks;
}
