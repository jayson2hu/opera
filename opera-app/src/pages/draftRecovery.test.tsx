import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdapterPage from './AdapterPage';
import ComposerPage from './ComposerPage';
import WeChatPage from './WeChatPage';
import { activeDraftKey } from '../lib/draftWorkspace';
import type { ProviderSelectionProps } from '../types';

afterEach(() => vi.unstubAllGlobals());
const providerProps: ProviderSelectionProps = {
  providers: [], selectedProvider: null, selectedModel: '', loading: false, error: '服务暂不可用',
  onProviderChange: () => {}, onModelChange: () => {},
};
const cases = [
  { kind: 'composer', Page: ComposerPage, result: { title: '', body: '人工编辑正文保留', tags: [], imageKeywords: [] } },
  { kind: 'wechat', Page: WeChatPage, result: { title: '', digest: '', body: '人工编辑正文保留' } },
  { kind: 'adapter', Page: AdapterPage, result: { coverTitles: [], cards: [], caption: '人工编辑正文保留', tagGroups: [] } },
] as const;

// Actual React page initialization / rendered controls. Not a browser lifecycle test.
describe('real page draft recovery (SSR)', () => {
  for (const { kind, Page, result } of cases) {
    it.each(['legacy', 'v2'])(kind + ' renders incomplete manual text without an available model (%s)', (format) => {
      const id = 'opera-draft-' + kind + (format === 'legacy' ? '-current' : '-saved-id');
      const value = { topic: '以前已经写下的原始主题', inputText: '以前保存的公众号原文', tone: 'bff',
        targetLength: 'short', contentType: 'story', articleType: 'story', provider: 'custom', model: 'removed-model', result, resultStatus: 'incomplete' };
      const raw = JSON.stringify({ value, savedAt: '2026-09-10', ...(format === 'v2' ? { schemaVersion: 2, revision: 4, versions: [] } : {}) });
      const values = new Map([[id, raw]]);
      if (format === 'v2') values.set(activeDraftKey(kind), id);
      const localStorage = { getItem: (key: string) => values.get(key) ?? null, setItem: vi.fn(), removeItem: vi.fn(), length: values.size, key: () => null };
      vi.stubGlobal('localStorage', localStorage);
      vi.stubGlobal('window', { localStorage, innerWidth: 1280, matchMedia: () => ({ matches: false }) });
      const render = () => renderToString(<StrictMode><Page {...providerProps} /></StrictMode>);
      for (const html of [render(), render()]) {
        expect(html).toContain('人工编辑正文保留');
        expect(html).toContain('全文编辑');
        expect(html).toContain('版本记录');
        expect(html).toContain('服务暂不可用');
        expect(html).not.toContain('完读率预估');
      }
      expect(localStorage.setItem).not.toHaveBeenCalled();
      expect(localStorage.removeItem).not.toHaveBeenCalled();
      expect(values.get(id)).toBe(raw);
    });
    it(kind + ' opens a blank writing entry without needing a provider', () => {
      vi.stubGlobal('window', { localStorage: { getItem: () => null }, innerWidth: 1280 });
      const html = renderToString(<Page {...providerProps} draftSelection={{ newDraft: true }} />);
      expect(html).toContain('不调用模型，直接写作');
    });
  }
});
