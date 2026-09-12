export const COPY_FAILURE_MESSAGE = '复制失败，请选中文本手动复制，或导出稿件备份。';

/** Both clipboard paths must confirm success before the UI acknowledges a copy. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* Older browsers and denied permissions may still allow the fallback. */ }

  let textarea: HTMLTextAreaElement | undefined;
  try {
    textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    return document.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    textarea?.remove();
  }
}
