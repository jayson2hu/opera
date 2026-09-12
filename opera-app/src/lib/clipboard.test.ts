import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyTextToClipboard } from './clipboard';

afterEach(() => vi.unstubAllGlobals());

function setupFallback(result: boolean | Error) {
  const textarea = { value: '', style: {}, select: vi.fn(), remove: vi.fn() };
  const execCommand = vi.fn(() => {
    if (result instanceof Error) throw result;
    return result;
  });
  const createElement = vi.fn(() => textarea);
  vi.stubGlobal('document', { createElement, body: { appendChild: vi.fn() }, execCommand });
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
  return { textarea, execCommand, createElement };
}

describe('clipboard success and failure boundary', () => {
  it('copies exact text with the Clipboard API without creating temporary elements', async () => {
    const { createElement } = setupFallback(false);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const text = '标题\n\n原稿中的空行和中文。\n';
    expect(await copyTextToClipboard(text)).toBe(true);
    expect(writeText).toHaveBeenCalledWith(text);
    expect(createElement).not.toHaveBeenCalled();
  });

  it('accepts a successful fallback after clipboard permission is denied', async () => {
    const { textarea, execCommand } = setupFallback(true);
    expect(await copyTextToClipboard('正文\n下一段')).toBe(true);
    expect(textarea.value).toBe('正文\n下一段');
    expect(textarea.select).toHaveBeenCalledOnce();
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(textarea.remove).toHaveBeenCalledOnce();
  });

  it('uses the fallback when the Clipboard API is unavailable', async () => {
    const { textarea } = setupFallback(true);
    vi.stubGlobal('navigator', {});
    expect(await copyTextToClipboard('旧浏览器正文')).toBe(true);
    expect(textarea.remove).toHaveBeenCalledOnce();
  });

  it.each([false, new Error('copy blocked')])('reports fallback failure and removes temporary text (%s)', async (result) => {
    const { textarea } = setupFallback(result);
    expect(await copyTextToClipboard('尚未复制的原稿')).toBe(false);
    expect(textarea.remove).toHaveBeenCalledOnce();
  });
});
