import { afterEach, describe, expect, it, vi } from 'vitest';

import { streamSSE } from './sse';

const encoder = new TextEncoder();

function splitBytes(text: string, boundaries: number[]): Uint8Array[] {
  const bytes = encoder.encode(text);
  const chunks: Uint8Array[] = [];
  let start = 0;

  for (const boundary of boundaries) {
    chunks.push(bytes.slice(start, boundary));
    start = boundary;
  }
  chunks.push(bytes.slice(start));
  return chunks;
}

function responseFromChunks(chunks: Uint8Array[]): Response {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index];
      if (chunk) {
        index += 1;
        controller.enqueue(chunk);
      } else {
        controller.close();
      }
    },
  });
  return new Response(body, { status: 200 });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('streamSSE', () => {
  it('keeps an event intact when its fields and separator cross chunk boundaries', async () => {
    const payload = [
      'event: chunk',
      'data: {"text":"first"}',
      '',
      'event: done',
      'data: {"finishReason":"stop"}',
      '',
      '',
    ].join('\n');
    const firstSeparator = payload.indexOf('\n\n');
    const chunks = splitBytes(payload, [4, 16, firstSeparator + 1, firstSeparator + 5]);
    const fetchMock = vi.fn().mockResolvedValue(responseFromChunks(chunks));
    vi.stubGlobal('fetch', fetchMock);
    const events: Array<[string, unknown]> = [];

    await streamSSE('/api/generate', { topic: 'test' }, {
      onEvent: (event, data) => events.push([event, data]),
    });

    expect(events).toEqual([
      ['chunk', { text: 'first' }],
      ['done', { finishReason: 'stop' }],
    ]);
    expect(fetchMock).toHaveBeenCalledWith('/api/generate', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ topic: 'test' }),
    }));
  });

  it('dispatches multiple events and flushes a final event without a closing blank line', async () => {
    const payload = [
      'event: chunk',
      'data: {"text":"one"}',
      '',
      'event: chunk',
      'data: {"text":"two"}',
      '',
      'event: done',
      'data: {"ok":true}',
    ].join('\n');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseFromChunks([encoder.encode(payload)])));
    const events: Array<[string, unknown]> = [];

    await streamSSE('/api/generate', {}, {
      onEvent: (event, data) => events.push([event, data]),
    });

    expect(events).toEqual([
      ['chunk', { text: 'one' }],
      ['chunk', { text: 'two' }],
      ['done', { ok: true }],
    ]);
  });

  it('optionally requires a business terminal event while preserving the default permissive mode', async () => {
    const payload = [
      'event: step',
      'data: {"step":"done"}',
      '',
    ].join('\n');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseFromChunks([encoder.encode(payload)])));

    const events: Array<[string, unknown]> = [];
    await streamSSE('/api/generate', {}, {
      requireTerminal: true,
      isTerminalEvent: (event, data: { step?: string }) => event === 'step' && data.step === 'done',
      onEvent: (event, data) => events.push([event, data]),
    });

    expect(events).toEqual([['step', { step: 'done' }]]);
  });

  it('rejects when a required terminal event is missing at EOF', async () => {
    const payload = [
      'event: chunk',
      'data: {"text":"partial"}',
      '',
    ].join('\n');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseFromChunks([encoder.encode(payload)])));

    await expect(streamSSE('/api/generate', {}, {
      requireTerminal: true,
      isTerminalEvent: (event, data: { step?: string }) => event === 'step' && data.step === 'done',
      onEvent: vi.fn(),
    })).rejects.toThrow('生成连接在完成前意外中断');
  });

  it('does not treat malformed terminal JSON as completion', async () => {
    const payload = [
      'event: step',
      'data: {"step":"done"',
      '',
    ].join('\n');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseFromChunks([encoder.encode(payload)])));

    await expect(streamSSE('/api/generate', {}, {
      requireTerminal: true,
      isTerminalEvent: (event, data: { step?: string }) => event === 'step' && data.step === 'done',
      onEvent: vi.fn(),
    })).rejects.toThrow('生成连接在完成前意外中断');
  });

  it('rejects and cancels the reader when an error event makes the callback throw', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('event: error\ndata: {"error":"provider failed"}\n\n'));
      },
      cancel,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));

    const request = streamSSE('/api/generate', {}, {
      onEvent: (event, data: { error?: string }) => {
        if (event === 'error') throw new Error(data.error);
      },
    });

    await expect(request).rejects.toThrow('provider failed');
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('uses the HTTP error mapper for a non-success response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'upstream detail' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    )));

    await expect(streamSSE('/api/generate', {}, {
      onEvent: vi.fn(),
      mapHttpError: (status) => `mapped ${status}`,
    })).rejects.toThrow('mapped 429');
  });
});
