// Shared Server-Sent Events (SSE) client for the streaming generation endpoints.
//
// Replaces the per-page fetch/decode/parse loop that was duplicated across
// AdapterPage, ComposerPage and WeChatPage. That duplicated parser declared its
// event type *inside* the read loop, so when a network chunk boundary fell between
// an `event:` line and its `data:` line the event was silently dropped. This parser
// buffers on the SSE event boundary (a blank line) and persists state across reads,
// so boundary-split events are never lost.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SSEData = any;

export interface StreamSSEOptions {
  /** Abort signal wired to the page's AbortController. */
  signal?: AbortSignal;
  /** Called once per parsed SSE event. Throw to abort the stream (e.g. on an `error` event). */
  onEvent: (event: string, data: SSEData) => void;
  /** Maps a non-2xx response to a user-facing message. Defaults to `body.error || HTTP <status>`. */
  mapHttpError?: (status: number, body: { error?: string }) => string;
}

function dispatchBlock(block: string, onEvent: (event: string, data: SSEData) => void): void {
  let event = '';
  let data = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data += line.slice(5).trim();
    }
  }
  if (!event || !data) return;

  let parsed: SSEData;
  try {
    parsed = JSON.parse(data);
  } catch {
    // Skip malformed frames instead of tearing down the whole stream.
    return;
  }
  onEvent(event, parsed);
}

export async function streamSSE(
  url: string,
  body: unknown,
  options: StreamSSEOptions,
): Promise<void> {
  const { signal, onEvent, mapHttpError } = options;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: 'Request failed' }))) as {
      error?: string;
    };
    const message = mapHttpError
      ? mapHttpError(response.status, payload)
      : payload.error || `HTTP ${response.status}`;
    throw new Error(message);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let separatorIndex = buffer.indexOf('\n\n');
      while (separatorIndex !== -1) {
        const block = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        dispatchBlock(block, onEvent);
        separatorIndex = buffer.indexOf('\n\n');
      }
    }

    // Flush a trailing event that arrived without its closing blank line.
    buffer += decoder.decode();
    if (buffer.trim()) {
      dispatchBlock(buffer, onEvent);
    }
  } finally {
    // Release the connection promptly, including when onEvent throws on an `error` event.
    reader.cancel().catch(() => {});
  }
}
