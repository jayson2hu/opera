/**
 * Browser-only exporter for an individual Xiaohongshu text card.
 *
 * The renderer intentionally has no dependency on React or the DOM tree. A
 * card can therefore be exported even while its editor is virtualised or
 * hidden, and the fixed 1080 x 1440 output is suitable for publishing.
 */

export const CARD_IMAGE_WIDTH = 1080;
export const CARD_IMAGE_HEIGHT = 1440;
export const CARD_IMAGE_MIME = 'image/png';

export interface CardImageData {
  text: string;
  /** One-based card number shown in the header. */
  index?: number;
  /** Optional purpose label, for example "开头钩子" or "行动总结". */
  purpose?: string;
}

export type CardImageInput = string | CardImageData;

export interface CardImageExportOptions {
  /** Used by tests and non-standard browser hosts. Defaults to document.createElement. */
  canvasFactory?: () => HTMLCanvasElement;
  /** File name used by downloadCardImage. */
  filename?: string;
  /** Small brand label shown above the card content. */
  brand?: string;
  /** Optional heading shown below the brand label. */
  heading?: string;
  /** Palette overrides. */
  background?: string;
  accent?: string;
  textColor?: string;
  mutedColor?: string;
  /** Maximum number of body lines before the final ellipsis is added. */
  maxLines?: number;
  /** Whether Opera brand marks are painted into the exported image. Defaults to true. */
  showWatermark?: boolean;
}

export interface DownloadDocumentLike {
  createElement: (tagName: string) => HTMLElement;
  body?: HTMLElement | null;
}

type CanvasContext = CanvasRenderingContext2D;

export interface CanvasTextMeasurer {
  measureText: (text: string) => Pick<TextMetrics, 'width'>;
}

const DEFAULTS = {
  background: '#fffdf9',
  accent: '#ee8019',
  textColor: '#2b2521',
  mutedColor: '#7c6e60',
  brand: 'OPERA · 小红书图文卡片',
  heading: '把灵感变成可发布的内容',
  maxLines: 14,
} as const;

function asCardData(input: CardImageInput): CardImageData {
  if (typeof input === 'string') return { text: input };
  return {
    text: typeof input.text === 'string' ? input.text : String(input.text ?? ''),
    ...(Number.isFinite(input.index) ? { index: input.index } : {}),
    ...(typeof input.purpose === 'string' && input.purpose.trim()
      ? { purpose: input.purpose.trim() }
      : {}),
  };
}

function isAsciiWordCharacter(value: string): boolean {
  return /^[A-Za-z0-9]$/.test(value);
}

/**
 * Tokenise text into CJK/code-point units while keeping adjacent latin words
 * together. Keeping words together avoids awkward "publis h" breaks, while
 * splitting an over-wide word still guarantees progress for narrow columns.
 */
function tokenizeParagraph(paragraph: string): string[] {
  const codePoints = Array.from(paragraph);
  const tokens: string[] = [];
  let latinRun = '';

  const flushLatin = () => {
    if (latinRun) {
      tokens.push(latinRun);
      latinRun = '';
    }
  };

  for (const codePoint of codePoints) {
    if (isAsciiWordCharacter(codePoint)) {
      latinRun += codePoint;
      continue;
    }
    flushLatin();
    tokens.push(codePoint);
  }
  flushLatin();
  return tokens;
}

function trimLineEnd(value: string): string {
  return value.replace(/[\t ]+$/g, '');
}

const FORBIDDEN_LINE_START = new Set(Array.from('，。！？、；：）》】」』〉〕］｝”’…—～,.!?;:%)]}»'));
const FORBIDDEN_LINE_END = new Set(Array.from('（《【「『〈〔［｛“‘([{«'));

function startsWithForbiddenLineStart(value: string): boolean {
  const first = Array.from(value.trimStart())[0];
  return first !== undefined && FORBIDDEN_LINE_START.has(first);
}

function endsWithForbiddenLineEnd(value: string): boolean {
  const codePoints = Array.from(trimLineEnd(value));
  const last = codePoints.at(-1);
  return last !== undefined && FORBIDDEN_LINE_END.has(last);
}

function carryLastCodePoint(value: string): { line: string; carry: string } | null {
  const codePoints = Array.from(trimLineEnd(value));
  if (codePoints.length <= 1) return null;
  const carry = codePoints.pop();
  return carry ? { line: codePoints.join(''), carry } : null;
}

function splitOverWideToken(
  token: string,
  maxWidth: number,
  measure: (value: string) => number,
): string[] {
  const chunks: string[] = [];
  let chunk = '';
  for (const codePoint of Array.from(token)) {
    const candidate = chunk + codePoint;
    if (chunk && measure(candidate) > maxWidth) {
      chunks.push(chunk);
      chunk = codePoint;
    } else {
      chunk = candidate;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks.length > 0 ? chunks : [''];
}

/**
 * Wrap text using the actual canvas font metrics.
 *
 * Explicit newlines are preserved (including blank paragraphs). The helper
 * never loops on a token wider than the column: such tokens are split by code
 * point as a final fallback.
 */
export function wrapCanvasText(
  context: CanvasTextMeasurer,
  text: string,
  maxWidth: number,
): string[] {
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) {
    throw new Error('maxWidth must be a positive number');
  }

  const normalized = String(text ?? '').replace(/\r\n?/g, '\n');
  if (!normalized) return [];

  const measure = (value: string) => context.measureText(value).width;
  const lines: string[] = [];

  for (const paragraph of normalized.split('\n')) {
    if (paragraph.length === 0) {
      lines.push('');
      continue;
    }

    const paragraphLines: string[] = [];
    let line = '';
    for (const token of tokenizeParagraph(paragraph)) {
      if (!line) {
        const nextToken = token.trimStart();
        if (!nextToken) continue;

        if (startsWithForbiddenLineStart(nextToken) && paragraphLines.length > 0) {
          const previousIndex = paragraphLines.length - 1;
          const carried = carryLastCodePoint(paragraphLines[previousIndex] ?? '');
          if (carried) {
            paragraphLines[previousIndex] = carried.line;
            line = carried.carry + nextToken;
          } else {
            paragraphLines[previousIndex] = `${paragraphLines[previousIndex] ?? ''}${nextToken}`;
          }
          continue;
        }

        if (measure(nextToken) > maxWidth) {
          const chunks = splitOverWideToken(nextToken, maxWidth, measure);
          paragraphLines.push(...chunks.slice(0, -1));
          line = chunks.at(-1) ?? '';
        } else {
          line = nextToken;
        }
        continue;
      }

      const candidate = line + token;
      if (measure(candidate) > maxWidth) {
        const nextToken = token.trimStart();
        if (!nextToken) {
          // Whitespace at a visual boundary is discarded. Keep the current
          // line pending so an opening bracket can move with the next token.
          continue;
        }

        if (startsWithForbiddenLineStart(nextToken) || endsWithForbiddenLineEnd(line)) {
          const carried = carryLastCodePoint(line);
          if (carried) {
            paragraphLines.push(carried.line);
            line = carried.carry + nextToken;
          } else {
            // For an impossibly narrow column, preserving Chinese punctuation
            // rules is preferable to beginning the next line with punctuation.
            line = trimLineEnd(line) + nextToken;
          }
        } else {
          paragraphLines.push(trimLineEnd(line));
          line = nextToken;
        }

        if (line && measure(line) > maxWidth) {
          const chunks = splitOverWideToken(line, maxWidth, measure);
          if (chunks.length > 1 && startsWithForbiddenLineStart(chunks.at(-1) ?? '')) {
            line = chunks.join('');
          } else {
            paragraphLines.push(...chunks.slice(0, -1));
            line = chunks.at(-1) ?? '';
          }
        }
      } else {
        line = candidate;
      }
    }

    if (line) paragraphLines.push(trimLineEnd(line));
    lines.push(...paragraphLines);
  }

  return lines;
}

function fitEllipsis(context: CanvasContext, value: string, maxWidth: number): string {
  const ellipsis = '…';
  const codePoints = Array.from(value.replace(/…+$/u, ''));

  while (codePoints.length > 0) {
    const last = codePoints.at(-1);
    const candidate = codePoints.join('') + ellipsis;
    if (context.measureText(candidate).width <= maxWidth && !FORBIDDEN_LINE_END.has(last ?? '')) {
      return candidate;
    }
    codePoints.pop();
  }

  return ellipsis;
}

function colorWithAlpha(color: string, alpha: number): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!match) return color;
  const [, red, green, blue] = match;
  return `rgba(${Number.parseInt(red, 16)}, ${Number.parseInt(green, 16)}, ${Number.parseInt(blue, 16)}, ${alpha})`;
}

function resolveCanvas(factory?: () => HTMLCanvasElement): HTMLCanvasElement {
  if (factory) return factory();
  if (typeof document === 'undefined') {
    throw new Error('Canvas export requires a browser document');
  }
  return document.createElement('canvas');
}

function drawRoundedRect(
  context: CanvasContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

/** Render one card into a fixed-size 1080 x 1440 canvas. */
export function renderCardImage(
  input: CardImageInput,
  options: CardImageExportOptions = {},
): HTMLCanvasElement {
  const card = asCardData(input);
  const canvas = resolveCanvas(options.canvasFactory);
  canvas.width = CARD_IMAGE_WIDTH;
  canvas.height = CARD_IMAGE_HEIGHT;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable');

  const background = options.background ?? DEFAULTS.background;
  const accent = options.accent ?? DEFAULTS.accent;
  const textColor = options.textColor ?? DEFAULTS.textColor;
  const mutedColor = options.mutedColor ?? DEFAULTS.mutedColor;
  const maxLines = Math.max(1, Math.floor(options.maxLines ?? DEFAULTS.maxLines));
  const showWatermark = options.showWatermark ?? true;
  const padding = 96;
  const contentWidth = CARD_IMAGE_WIDTH - padding * 2;

  context.fillStyle = background;
  context.fillRect(0, 0, CARD_IMAGE_WIDTH, CARD_IMAGE_HEIGHT);

  const surfaceGradient = context.createLinearGradient(0, 0, CARD_IMAGE_WIDTH, CARD_IMAGE_HEIGHT);
  surfaceGradient.addColorStop(0, colorWithAlpha(accent, 0));
  surfaceGradient.addColorStop(0.55, colorWithAlpha(accent, 0.05));
  surfaceGradient.addColorStop(1, colorWithAlpha(accent, 0.2));
  context.fillStyle = surfaceGradient;
  context.fillRect(0, 0, CARD_IMAGE_WIDTH, CARD_IMAGE_HEIGHT);

  const accentBarGradient = context.createLinearGradient(0, 0, CARD_IMAGE_WIDTH, 0);
  accentBarGradient.addColorStop(0, accent);
  accentBarGradient.addColorStop(1, '#f6bb6d');
  context.fillStyle = accentBarGradient;
  context.fillRect(0, 0, CARD_IMAGE_WIDTH, 18);

  context.textBaseline = 'alphabetic';
  if (showWatermark) {
    context.fillStyle = mutedColor;
    context.font = '700 28px "Noto Sans SC", "Microsoft YaHei", sans-serif';
    context.fillText(options.brand ?? DEFAULTS.brand, padding, 100);
  }

  context.fillStyle = textColor;
  context.font = '900 54px "Noto Sans SC", "Microsoft YaHei", sans-serif';
  context.fillText(options.heading ?? DEFAULTS.heading, padding, 190);

  if (card.index !== undefined || card.purpose) {
    const badgeText = [
      card.index !== undefined ? `卡片 ${Math.max(1, Math.round(card.index))}` : '',
      card.purpose ?? '',
    ].filter(Boolean).join(' · ');
    context.font = '700 26px "Noto Sans SC", "Microsoft YaHei", sans-serif';
    const badgeWidth = Math.min(contentWidth, context.measureText(badgeText).width + 44);
    context.fillStyle = accent;
    drawRoundedRect(context, padding, 230, badgeWidth, 52, 26);
    context.fill();
    context.fillStyle = '#ffffff';
    context.fillText(badgeText, padding + 22, 266);
  }

  const bodyTop = card.index !== undefined || card.purpose ? 350 : 290;
  const bodyBottom = CARD_IMAGE_HEIGHT - 220;
  const bodyLineHeight = 84;
  context.font = '600 64px "Noto Sans SC", "Microsoft YaHei", sans-serif';
  context.fillStyle = textColor;

  const lines = wrapCanvasText(context, card.text.trim(), contentWidth);
  const visibleLines = lines.slice(0, maxLines);
  const hasOverflow = lines.length > visibleLines.length;
  if (hasOverflow && visibleLines.length > 0) {
    visibleLines[visibleLines.length - 1] = fitEllipsis(
      context,
      visibleLines[visibleLines.length - 1] ?? '',
      contentWidth,
    );
  }
  const maxVisibleByHeight = Math.max(1, Math.floor((bodyBottom - bodyTop) / bodyLineHeight));
  if (visibleLines.length > maxVisibleByHeight) {
    visibleLines.length = maxVisibleByHeight;
    visibleLines[maxVisibleByHeight - 1] = fitEllipsis(
      context,
      visibleLines[maxVisibleByHeight - 1] ?? '',
      contentWidth,
    );
  }

  visibleLines.forEach((line, lineIndex) => {
    context.fillText(line, padding, bodyTop + lineIndex * bodyLineHeight);
  });

  const dividerY = CARD_IMAGE_HEIGHT - 150;
  context.strokeStyle = '#ebe1d3';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(padding, dividerY);
  context.lineTo(CARD_IMAGE_WIDTH - padding, dividerY);
  context.stroke();

  context.fillStyle = mutedColor;
  context.font = '500 24px "Noto Sans SC", "Microsoft YaHei", sans-serif';
  if (showWatermark) {
    context.fillText('由 Opera 生成 · 可继续编辑', padding, CARD_IMAGE_HEIGHT - 88);
  }
  context.textAlign = 'right';
  context.fillText(`${CARD_IMAGE_WIDTH} × ${CARD_IMAGE_HEIGHT}`, CARD_IMAGE_WIDTH - padding, CARD_IMAGE_HEIGHT - 88);
  context.textAlign = 'left';

  return canvas;
}

function decodeBase64(base64: string): ArrayBuffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = base64.replace(/\s/g, '');
  const output: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of clean) {
    if (character === '=') break;
    const value = alphabet.indexOf(character);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(output).buffer;
}

/** Convert a canvas to a PNG Blob, with a data-url fallback for older hosts. */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas did not produce a PNG blob'));
      }, CARD_IMAGE_MIME);
      return;
    }

    try {
      const dataUrl = canvas.toDataURL(CARD_IMAGE_MIME);
      const comma = dataUrl.indexOf(',');
      if (comma < 0) throw new Error('Canvas returned an invalid data URL');
      const mimeMatch = /^data:([^;,]+)/.exec(dataUrl);
      const mime = mimeMatch?.[1] || CARD_IMAGE_MIME;
      resolve(new Blob([decodeBase64(dataUrl.slice(comma + 1))], { type: mime }));
    } catch (error: unknown) {
      reject(error instanceof Error ? error : new Error('Unable to export canvas as PNG'));
    }
  });
}

/** Keep download names portable while preserving Chinese labels and spaces. */
export function sanitizeFilename(filename: string, fallback = 'opera-card'): string {
  const withoutControlCharacters = Array.from(String(filename ?? ''))
    .map((character) => (character.charCodeAt(0) < 32 ? '-' : character))
    .join('');
  const cleaned = withoutControlCharacters
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+$/, '');
  const base = cleaned || fallback;
  return /\.png$/i.test(base) ? base : `${base}.png`;
}

function defaultFilename(card: CardImageData): string {
  const number = card.index !== undefined ? `-${String(Math.max(1, Math.round(card.index))).padStart(2, '0')}` : '';
  const purpose = card.purpose ? `-${card.purpose}` : '';
  return sanitizeFilename(`opera-card${number}${purpose}`);
}

/** Trigger a normal browser download and revoke the temporary object URL. */
export function downloadBlob(
  blob: Blob,
  filename: string,
  documentRef: DownloadDocumentLike = typeof document === 'undefined' ? (null as never) : document,
): void {
  if (!documentRef) throw new Error('File download requires a browser document');
  const urlApi = typeof URL === 'undefined' ? null : URL;
  if (!urlApi?.createObjectURL) throw new Error('Browser does not support object URLs');

  const objectUrl = urlApi.createObjectURL(blob);
  const anchor = documentRef.createElement('a') as HTMLAnchorElement;
  anchor.href = objectUrl;
  anchor.download = sanitizeFilename(filename);
  anchor.rel = 'noopener';
  anchor.style.position = 'fixed';
  anchor.style.left = '-9999px';
  documentRef.body?.appendChild(anchor);
  anchor.click();
  anchor.remove();

  const revoke = () => urlApi.revokeObjectURL?.(objectUrl);
  if (typeof globalThis.setTimeout === 'function') globalThis.setTimeout(revoke, 0);
  else revoke();
}

/** Render, encode, and download one card image. */
export async function downloadCardImage(
  input: CardImageInput,
  options: CardImageExportOptions = {},
): Promise<void> {
  const card = asCardData(input);
  const canvas = renderCardImage(card, options);
  const blob = await canvasToPngBlob(canvas);
  downloadBlob(blob, options.filename ?? defaultFilename(card));
}

/** Render and encode one card without triggering a download. */
export async function exportCardImage(
  input: CardImageInput,
  options: CardImageExportOptions = {},
): Promise<Blob> {
  return canvasToPngBlob(renderCardImage(input, options));
}
