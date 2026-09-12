import { describe, expect, it, vi } from 'vitest';

import {
  CARD_IMAGE_HEIGHT,
  CARD_IMAGE_WIDTH,
  canvasToPngBlob,
  renderCardImage,
  sanitizeFilename,
  wrapCanvasText,
} from './cardImageExporter';

function measuringContext() {
  return {
    measureText: (value: string) => ({ width: Array.from(value).length * 10 }),
  };
}

describe('card image exporter', () => {
  it('wraps CJK text, keeps latin words together, and preserves blank lines', () => {
    const lines = wrapCanvasText(measuringContext(), '中文内容 ABCD\n\n第二段', 60);

    expect(lines).toEqual(['中文内容', 'ABCD', '', '第二段']);
  });

  it('splits a single over-wide token so wrapping always makes progress', () => {
    const lines = wrapCanvasText(measuringContext(), 'ABCDEFGHIJ', 30);

    expect(lines).toEqual(['ABC', 'DEF', 'GHI', 'J']);
  });

  it('does not leave Chinese closing punctuation at the start of a wrapped line', () => {
    const lines = wrapCanvasText(measuringContext(), '内容很好，但是继续完善。', 40);

    expect(lines.join('')).toBe('内容很好，但是继续完善。');
    expect(lines.slice(1).every((line) => !/^[，。！？、；：）》】」』]/u.test(line))).toBe(true);
  });

  it('does not leave Chinese opening punctuation at the end of a wrapped line', () => {
    const lines = wrapCanvasText(measuringContext(), '开始（说明）继续', 30);

    expect(lines.join('')).toBe('开始（说明）继续');
    expect(lines.slice(0, -1).every((line) => !/[（《【「『]$/u.test(line))).toBe(true);
  });

  it('keeps an opening bracket with following text when boundary whitespace is discarded', () => {
    const lines = wrapCanvasText(measuringContext(), '内容ABC（ 说明）', 40);

    expect(lines.join('')).toBe('内容ABC（说明）');
    expect(lines.slice(0, -1).every((line) => !/[（《【「『]$/u.test(line))).toBe(true);
  });

  it('rejects invalid widths instead of silently returning malformed output', () => {
    expect(() => wrapCanvasText(measuringContext(), 'text', 0)).toThrow(/maxWidth/);
    expect(() => wrapCanvasText(measuringContext(), 'text', Number.NaN)).toThrow(/maxWidth/);
  });

  it('sanitizes path characters and adds a png extension', () => {
    expect(sanitizeFilename('  ../我的卡片:01  ')).toBe('..-我的卡片-01.png');
    expect(sanitizeFilename('already.PNG')).toBe('already.PNG');
    expect(sanitizeFilename('   ', 'fallback')).toBe('fallback.png');
  });

  it('renders a fixed 1080 x 1440 canvas', () => {
    const fillText = vi.fn();
    const gradient = { addColorStop: vi.fn() };
    const context = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textBaseline: '',
      textAlign: 'left',
      measureText: (value: string) => ({ width: Array.from(value).length * 18 }),
      createLinearGradient: vi.fn(() => gradient),
      fillRect: vi.fn(),
      fillText,
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;

    const rendered = renderCardImage(
      { text: '一段用于验证导出的内容', index: 2, purpose: '核心洞察' },
      { canvasFactory: () => canvas, maxLines: 3 },
    );

    expect(rendered).toBe(canvas);
    expect(canvas.width).toBe(CARD_IMAGE_WIDTH);
    expect(canvas.height).toBe(CARD_IMAGE_HEIGHT);
    expect(fillText).toHaveBeenCalled();
    expect(context.createLinearGradient).toHaveBeenCalledTimes(2);
    expect(context.fillRect.mock.calls.filter(([, , width, height]) => (
      width === CARD_IMAGE_WIDTH && height === CARD_IMAGE_HEIGHT
    ))).toHaveLength(2);
  });

  it('uses the documented body type scale and marks max-line truncation with an ellipsis', () => {
    const fillText = vi.fn();
    const painted: Array<{ text: string; font: string; y: number }> = [];
    const gradient = { addColorStop: vi.fn() };
    const context = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textBaseline: '', textAlign: 'left',
      measureText: (value: string) => ({ width: Array.from(value).length * 100 }),
      createLinearGradient: vi.fn(() => gradient), fillRect: vi.fn(), fillText,
      beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), quadraticCurveTo: vi.fn(),
      closePath: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
    };
    context.fillText = vi.fn((value: string, _x: number, y: number) => {
      painted.push({ text: value, font: context.font, y });
    });
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => context) } as unknown as HTMLCanvasElement;

    renderCardImage({ text: '一二三四五六七八九十甲乙丙丁', purpose: '测试' }, {
      canvasFactory: () => canvas,
      maxLines: 1,
    });

    const bodyPaint = painted.find(({ y }) => y === 350);
    expect(bodyPaint?.text).toMatch(/…$/u);
    expect(bodyPaint?.font).toBe('600 64px "Noto Sans SC", "Microsoft YaHei", sans-serif');
  });

  it('marks height-based truncation with an ellipsis', () => {
    const fillText = vi.fn();
    const gradient = { addColorStop: vi.fn() };
    const context = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textBaseline: '', textAlign: 'left',
      measureText: (value: string) => ({ width: Array.from(value).length * 100 }),
      createLinearGradient: vi.fn(() => gradient), fillRect: vi.fn(), fillText,
      beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), quadraticCurveTo: vi.fn(),
      closePath: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
    };
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => context) } as unknown as HTMLCanvasElement;

    renderCardImage({ text: '正文'.repeat(80), purpose: '测试' }, {
      canvasFactory: () => canvas,
      maxLines: 99,
    });

    const bodyCalls = fillText.mock.calls.filter(([, , y]) => typeof y === 'number' && y >= 350 && y < 1220);
    expect(bodyCalls.at(-1)?.[0]).toMatch(/…$/u);
  });

  it('omits Opera brand marks when watermark export is disabled', () => {
    const fillText = vi.fn();
    const gradient = { addColorStop: vi.fn() };
    const context = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textBaseline: '',
      textAlign: 'left',
      measureText: (value: string) => ({ width: Array.from(value).length * 18 }),
      createLinearGradient: vi.fn(() => gradient),
      fillRect: vi.fn(),
      fillText,
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement;

    renderCardImage('正文', { canvasFactory: () => canvas, showWatermark: false });

    const paintedText = fillText.mock.calls.map(([value]) => String(value));
    expect(paintedText.some((value) => value.includes('OPERA'))).toBe(false);
    expect(paintedText.some((value) => value.includes('由 Opera 生成'))).toBe(false);
    expect(paintedText).toContain('把灵感变成可发布的内容');
  });

  it('converts a canvas through toBlob', async () => {
    const expected = new Blob(['png'], { type: 'image/png' });
    const canvas = {
      toBlob: vi.fn((callback: BlobCallback) => callback(expected)),
    } as unknown as HTMLCanvasElement;

    await expect(canvasToPngBlob(canvas)).resolves.toBe(expected);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png');
  });

  it('falls back to a data URL when toBlob is unavailable', async () => {
    const bytes = btoa('png');
    const canvas = {
      toDataURL: vi.fn(() => `data:image/png;base64,${bytes}`),
    } as unknown as HTMLCanvasElement;

    const blob = await canvasToPngBlob(canvas);
    expect(blob.type).toBe('image/png');
    await expect(blob.text()).resolves.toBe('png');
  });
});
