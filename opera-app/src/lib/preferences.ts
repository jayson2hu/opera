import type { AppView } from '../types';

export type FontSizePreference = 'sm' | 'md' | 'lg';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface Preferences {
  defaultFlow: AppView;
  fontSize: FontSizePreference;
  theme: ThemePreference;
  showWatermark: boolean;
}

export const PREFERENCES_STORAGE_KEY = 'opera-prefs';
export const PREFERENCES_CHANGE_EVENT = 'opera-preferences-changed';

export const DEFAULT_PREFERENCES: Preferences = {
  defaultFlow: 'home',
  fontSize: 'md',
  theme: 'system',
  showWatermark: true,
};

const VALID_VIEWS = new Set<AppView>(['home', 'wechat', 'adapter', 'composer']);
const VALID_FONT_SIZES = new Set<FontSizePreference>(['sm', 'md', 'lg']);
const VALID_THEMES = new Set<ThemePreference>(['light', 'dark', 'system']);
const FONT_SIZE_PIXELS: Record<FontSizePreference, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

type PreferenceOverrides = Partial<Preferences>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readStoredOverrides(): PreferenceOverrides {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};

    const overrides: PreferenceOverrides = {};
    if (typeof parsed.defaultFlow === 'string' && VALID_VIEWS.has(parsed.defaultFlow as AppView)) {
      overrides.defaultFlow = parsed.defaultFlow as AppView;
    }
    if (typeof parsed.fontSize === 'string' && VALID_FONT_SIZES.has(parsed.fontSize as FontSizePreference)) {
      overrides.fontSize = parsed.fontSize as FontSizePreference;
    }
    if (typeof parsed.theme === 'string' && VALID_THEMES.has(parsed.theme as ThemePreference)) {
      overrides.theme = parsed.theme as ThemePreference;
    }
    if (typeof parsed.showWatermark === 'boolean') {
      overrides.showWatermark = parsed.showWatermark;
    }
    return overrides;
  } catch {
    return {};
  }
}

function normalizePreferences(value: PreferenceOverrides): Preferences {
  return {
    defaultFlow: value.defaultFlow && VALID_VIEWS.has(value.defaultFlow)
      ? value.defaultFlow
      : DEFAULT_PREFERENCES.defaultFlow,
    fontSize: value.fontSize && VALID_FONT_SIZES.has(value.fontSize)
      ? value.fontSize
      : DEFAULT_PREFERENCES.fontSize,
    theme: value.theme && VALID_THEMES.has(value.theme)
      ? value.theme
      : DEFAULT_PREFERENCES.theme,
    showWatermark: typeof value.showWatermark === 'boolean'
      ? value.showWatermark
      : DEFAULT_PREFERENCES.showWatermark,
  };
}

export function readPreferences(): Preferences {
  return normalizePreferences({ ...DEFAULT_PREFERENCES, ...readStoredOverrides() });
}

/**
 * Returns only an explicitly stored launch flow. This lets App preserve the
 * legacy resume behavior when a user has never configured a default flow.
 */
export function readConfiguredDefaultFlow(): AppView | null {
  return readStoredOverrides().defaultFlow ?? null;
}

export function applyFontSizePreference(fontSize: FontSizePreference): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.style.fontSize = `${FONT_SIZE_PIXELS[fontSize]}px`;
  root.dataset.operaFontSize = fontSize;
}

let themeMediaCleanup: (() => void) | null = null;

export function applyThemePreference(theme: ThemePreference): () => void {
  themeMediaCleanup?.();
  themeMediaCleanup = null;

  if (typeof document === 'undefined') return () => undefined;

  const root = document.documentElement;
  const applyResolvedTheme = (dark: boolean) => {
    root.dataset.theme = dark ? 'dark' : 'light';
    root.dataset.operaThemePreference = theme;
    root.style.colorScheme = dark ? 'dark' : 'light';
  };

  if (theme !== 'system' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    applyResolvedTheme(theme === 'dark');
    return () => undefined;
  }

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = (event: MediaQueryListEvent) => applyResolvedTheme(event.matches);
  applyResolvedTheme(media.matches);
  const supportsModernListener = typeof media.addEventListener === 'function';
  if (supportsModernListener) media.addEventListener('change', handleChange);
  else media.addListener(handleChange);

  let active = true;
  const cleanup = () => {
    if (!active) return;
    active = false;
    if (supportsModernListener) media.removeEventListener('change', handleChange);
    else media.removeListener(handleChange);
    if (themeMediaCleanup === cleanup) themeMediaCleanup = null;
  };
  themeMediaCleanup = cleanup;
  return cleanup;
}

export function writePreferences(next: Preferences): Preferences {
  const normalized = normalizePreferences(next);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
    } catch {
      // Keep the in-memory preference working when storage is unavailable.
    }

    // storage events do not fire in the window that made the change.
    applyFontSizePreference(normalized.fontSize);
    applyThemePreference(normalized.theme);
    window.dispatchEvent(
      new CustomEvent<Preferences>(PREFERENCES_CHANGE_EVENT, { detail: normalized }),
    );
  }

  return normalized;
}

export function subscribeToPreferences(listener: (preferences: Preferences) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handleCustomChange = (event: Event) => {
    const detail = (event as CustomEvent<Preferences>).detail;
    listener(detail ? normalizePreferences(detail) : readPreferences());
  };
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === PREFERENCES_STORAGE_KEY) listener(readPreferences());
  };

  window.addEventListener(PREFERENCES_CHANGE_EVENT, handleCustomChange);
  window.addEventListener('storage', handleStorageChange);

  return () => {
    window.removeEventListener(PREFERENCES_CHANGE_EVENT, handleCustomChange);
    window.removeEventListener('storage', handleStorageChange);
  };
}
