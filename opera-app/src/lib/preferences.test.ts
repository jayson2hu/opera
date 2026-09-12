import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  applyFontSizePreference,
  applyThemePreference,
  readConfiguredDefaultFlow,
  readPreferences,
} from './preferences';

function installWindowWithStoredValue(raw: string | null) {
  const localStorage = {
    getItem: vi.fn((key: string) => key === PREFERENCES_STORAGE_KEY ? raw : null),
    setItem: vi.fn(),
  };
  const fakeWindow = {
    localStorage,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  };
  vi.stubGlobal('window', fakeWindow);
  return { localStorage, fakeWindow };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('preferences storage', () => {
  it('falls back to defaults when storage contains invalid JSON', () => {
    installWindowWithStoredValue('{invalid');

    expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
    expect(readConfiguredDefaultFlow()).toBeNull();
  });

  it('merges valid stored fields while falling back invalid fields independently', () => {
    installWindowWithStoredValue(JSON.stringify({
      defaultFlow: 'missing-view',
      fontSize: 'lg',
      ignored: true,
    }));

    expect(readPreferences()).toEqual({
      defaultFlow: 'home',
      fontSize: 'lg',
      theme: 'system',
      showWatermark: true,
    });
    expect(readConfiguredDefaultFlow()).toBeNull();
  });

  it('returns a valid explicitly configured launch flow', () => {
    installWindowWithStoredValue(JSON.stringify({ defaultFlow: 'composer' }));

    expect(readPreferences()).toEqual({
      defaultFlow: 'composer',
      fontSize: 'md',
      theme: 'system',
      showWatermark: true,
    });
    expect(readConfiguredDefaultFlow()).toBe('composer');
  });

  it('accepts valid appearance and watermark preferences without breaking older fields', () => {
    installWindowWithStoredValue(JSON.stringify({
      fontSize: 'sm',
      theme: 'dark',
      showWatermark: false,
    }));

    expect(readPreferences()).toEqual({
      defaultFlow: 'home',
      fontSize: 'sm',
      theme: 'dark',
      showWatermark: false,
    });
  });
});

describe('applyFontSizePreference', () => {
  it('applies the selected pixel size and preference marker to the root element', () => {
    const root = { style: { fontSize: '' }, dataset: {} as Record<string, string> };
    vi.stubGlobal('document', { documentElement: root });

    applyFontSizePreference('lg');

    expect(root.style.fontSize).toBe('18px');
    expect(root.dataset.operaFontSize).toBe('lg');
  });

  it('is safe when rendered outside a browser', () => {
    vi.stubGlobal('document', undefined);

    expect(() => applyFontSizePreference('sm')).not.toThrow();
  });
});

describe('applyThemePreference', () => {
  it('applies an explicit dark theme to the root element', () => {
    const root = {
      style: { colorScheme: '' },
      dataset: {} as Record<string, string>,
    };
    vi.stubGlobal('document', { documentElement: root });

    applyThemePreference('dark');

    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.operaThemePreference).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
  });

  it('tracks system theme changes and removes the listener during cleanup', () => {
    const root = {
      style: { colorScheme: '' },
      dataset: {} as Record<string, string>,
    };
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const media = {
      matches: true,
      addEventListener,
      removeEventListener,
    };
    vi.stubGlobal('document', { documentElement: root });
    vi.stubGlobal('window', { matchMedia: vi.fn(() => media) });

    const cleanup = applyThemePreference('system');

    expect(root.dataset.theme).toBe('dark');
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    cleanup();
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('supports the legacy media-query listener used by Safari 13', () => {
    const root = {
      style: { colorScheme: '' },
      dataset: {} as Record<string, string>,
    };
    const addListener = vi.fn();
    const removeListener = vi.fn();
    vi.stubGlobal('document', { documentElement: root });
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: false, addListener, removeListener })),
    });

    const cleanup = applyThemePreference('system');

    expect(root.dataset.theme).toBe('light');
    expect(addListener).toHaveBeenCalledWith(expect.any(Function));
    cleanup();
    expect(removeListener).toHaveBeenCalledWith(expect.any(Function));
  });

  it('keeps only one system listener across repeated theme changes', () => {
    const root = {
      style: { colorScheme: '' },
      dataset: {} as Record<string, string>,
    };
    const first = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const second = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const matchMedia = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second);
    vi.stubGlobal('document', { documentElement: root });
    vi.stubGlobal('window', { matchMedia });

    const staleCleanup = applyThemePreference('system');
    applyThemePreference('dark');
    const activeCleanup = applyThemePreference('system');
    staleCleanup();

    expect(first.removeEventListener).toHaveBeenCalledTimes(1);
    expect(second.addEventListener).toHaveBeenCalledTimes(1);
    expect(root.dataset.theme).toBe('dark');

    activeCleanup();
    expect(second.removeEventListener).toHaveBeenCalledTimes(1);
  });
});
