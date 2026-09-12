import { buildApiUrl } from '../constants';
import type { ProviderId } from '../types';

interface RewriteParagraphInput {
  text: string;
  instruction: string;
  provider?: ProviderId;
  model?: string;
  signal?: AbortSignal;
}

interface RewriteParagraphResponse {
  text: string;
}

function readErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;

  const error = 'error' in payload ? payload.error : undefined;
  if (typeof error === 'string' && error.trim()) return error;

  const detail = 'detail' in payload ? payload.detail : undefined;
  if (typeof detail === 'string' && detail.trim()) return detail;

  return null;
}

export async function rewriteParagraph({
  text,
  instruction,
  provider,
  model,
  signal,
}: RewriteParagraphInput): Promise<string> {
  let response: Response;

  try {
    response = await fetch(buildApiUrl('/api/rewrite-paragraph'), {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        instruction,
        ...(provider ? { provider } : {}),
        ...(model ? { model } : {}),
      }),
    });
  } catch {
    throw new Error('无法连接段落改写服务，请确认后端已启动。');
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('未找到 /api/rewrite-paragraph。请确认正在运行 FastAPI 后端。');
    }
    throw new Error(readErrorMessage(payload) ?? `段落改写失败（HTTP ${response.status}）`);
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    !('text' in payload) ||
    typeof payload.text !== 'string' ||
    !payload.text.trim()
  ) {
    throw new Error('段落改写服务返回了无效内容，请重试。');
  }

  return (payload as RewriteParagraphResponse).text;
}
