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
    expect(html).toContain('学习成本低');
    expect(html).toContain('需要控制 Agent 自主边界');
    expect(html).toContain('视觉实现与维护成本高');
  });

  it.each([
    ['a', 'login', 'Continue to your workspace', 'Signal Desk 设计规范'],
    ['a', 'dashboard', 'Good morning, Yun.', 'Signal Desk 设计规范'],
    ['a', 'workspace', 'Source &amp; direction', 'Signal Desk 设计规范'],
    ['a', 'settings', 'Manage how Opera works for you.', 'Signal Desk 设计规范'],
    ['b', 'login', 'What would you like', 'Agent Canvas 设计规范'],
    ['b', 'dashboard', 'What will we create today?', 'Agent Canvas 设计规范'],
    ['b', 'workspace', 'Confirm these ideas', 'Agent Canvas 设计规范'],
    ['b', 'settings', 'Shape how Opera works with you.', 'Agent Canvas 设计规范'],
    ['c', 'login', 'Ideas deserve', 'Opera Atelier 设计规范'],
    ['c', 'dashboard', 'Make something', 'Opera Atelier 设计规范'],
    ['c', 'workspace', 'THE NEW SCARCITY', 'Opera Atelier 设计规范'],
    ['c', 'settings', 'Creative defaults', 'Opera Atelier 设计规范'],
  ])('can deep-link to concept %s %s', (concept, screen, marker, spec) => {
    stubWindow(`?concept=${concept}&screen=${screen}`);
    const html = renderToStaticMarkup(<UiExploration />);
    expect(html).toContain(marker);
    expect(html).toContain(spec);
  });
});
