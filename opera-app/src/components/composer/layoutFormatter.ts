import type { ComposerLayoutOptions, ComposerLayoutTemplate } from '../../types';

const TEMPLATE_PREFIXES: Record<ComposerLayoutTemplate, string[]> = {
  clean: [],
  list: ['1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.'],
  story: ['开头', '经历', '发现', '做法', '总结'],
  tutorial: ['步骤 1', '步骤 2', '步骤 3', '步骤 4', '步骤 5', '步骤 6'],
};

const TEMPLATE_EMOJI: Record<ComposerLayoutTemplate, string[]> = {
  clean: ['✨', '📌', '💡'],
  list: ['✅', '🔎', '📝'],
  story: ['🌿', '💬', '✨'],
  tutorial: ['🧭', '✅', '📌'],
};

function normalizeLines(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitLongParagraph(line: string) {
  if (line.length <= 90) return [line];

  const parts = line
    .split(/(?<=[。！？!?])\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) return [line];

  const chunks: string[] = [];
  let current = '';

  for (const part of parts) {
    if (current && `${current}${part}`.length > 90) {
      chunks.push(current);
      current = part;
    } else {
      current = `${current}${part}`;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function stripHashTags(line: string) {
  return line.replace(/#[\p{L}\p{N}_\u4e00-\u9fa5-]+/gu, '').trim();
}

function uniqueTags(tags: string[]) {
  const seen = new Set<string>();
  return tags
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter(Boolean)
    .filter((tag) => {
      const key = tag.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function applyTemplate(lines: string[], options: ComposerLayoutOptions) {
  if (options.template === 'clean') return lines;

  const prefixes = TEMPLATE_PREFIXES[options.template];

  return lines.map((line, index) => {
    const prefix = prefixes[index] ?? prefixes[prefixes.length - 1];
    if (!prefix) return line;

    if (options.template === 'list') return `${prefix} ${line}`;
    return `${prefix}｜${line}`;
  });
}

function applyEmoji(lines: string[], options: ComposerLayoutOptions) {
  if (!options.useEmoji) return lines;

  const emoji = TEMPLATE_EMOJI[options.template];
  return lines.map((line, index) => {
    if (/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(line)) return line;
    return `${emoji[index % emoji.length]} ${line}`;
  });
}

export function formatComposerText({
  title,
  body,
  tags,
  options,
}: {
  title: string;
  body: string;
  tags: string[];
  options: ComposerLayoutOptions;
}) {
  const normalizedTitle = title.trim();
  const rawLines = normalizeLines(body)
    .flatMap(splitLongParagraph)
    .map((line) => (options.keepTagsAtEnd ? stripHashTags(line) : line))
    .filter(Boolean);
  const templatedLines = applyEmoji(applyTemplate(rawLines, options), options);
  const divider = options.useDividers ? '\n\n—\n\n' : '\n\n';
  const content = templatedLines.join(divider);
  const cleanTags = uniqueTags(tags);
  const tagBlock = options.keepTagsAtEnd && cleanTags.length ? cleanTags.map((tag) => `#${tag}`).join(' ') : '';

  return [normalizedTitle, content, tagBlock].filter(Boolean).join('\n\n');
}

