import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import UiExploration from './UiExploration';

function stubWindow(search = '') {
  vi.stubGlobal('window', {
    location: { pathname: '/explore', search },
    history: { replaceState: vi.fn() },
    scrollTo: vi.fn(),
  });
}

describe('UI exploration', () => {
  beforeEach(() => stubWindow());

  it('shows the current-state diagnosis and all three directions', () => {
    const html = renderToStaticMarkup(<UiExploration />);
    expect(html).toContain('先看清现在的 Opera');
    expect(html).toContain('Signal Desk');
    expect(html).toContain('Agent Canvas');
    expect(html).toContain('Opera Atelier');
    expect(html).toContain('选择 B：Agent Canvas');
  });

  it('can deep-link to the AI-native dashboard prototype', () => {
    stubWindow('?concept=b&screen=dashboard');
    const html = renderToStaticMarkup(<UiExploration />);
    expect(html).toContain('What will we create today?');
    expect(html).toContain('Start a creation');
    expect(html).toContain('Agent Canvas 设计规范');
  });
});
