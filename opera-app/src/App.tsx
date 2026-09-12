import { useCallback, useEffect, useState } from 'react';
import type {
  AppView,
  FlowKind,
  ProviderId,
  ProvidersResponse,
} from './types';
import BackBar from './components/BackBar';
import Header from './components/Header';
import OperaToast from './components/OperaToast';
import { buildApiUrl } from './constants';
import {
  applyFontSizePreference,
  applyThemePreference,
  readConfiguredDefaultFlow,
  readPreferences,
  subscribeToPreferences,
} from './lib/preferences';
import { confirmDraftNavigation } from './lib/draftPersistence';
import type { DraftSelection } from './lib/draftWorkspace';
import AdapterPage from './pages/AdapterPage';
import ComposerPage from './pages/ComposerPage';
import Home from './pages/Home';
import WeChatPage from './pages/WeChatPage';

const VIEW_STORAGE_KEY = 'opera-view';
const VALID_VIEWS: AppView[] = ['home', 'wechat', 'adapter', 'composer'];

function readPersistedView(): AppView | null {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    if (raw && (VALID_VIEWS as string[]).includes(raw)) {
      return raw as AppView;
    }
  } catch {
    // Ignore storage errors (e.g. SSR or privacy mode)
  }
  return null;
}

function readInitialView(): AppView {
  // An explicit default flow wins over the legacy "resume last view" key.
  return readConfiguredDefaultFlow() ?? readPersistedView() ?? 'home';
}

export default function App() {
  const [view, setView] = useState<AppView>(() => readInitialView());
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [providerOptions, setProviderOptions] = useState<ProvidersResponse['available']>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [draftSelection, setDraftSelection] = useState<{ kind: FlowKind; selection: DraftSelection } | null>(null);
  const [restoreRevision, setRestoreRevision] = useState(0);

  useEffect(() => {
    const initial = readPreferences();
    applyFontSizePreference(initial.fontSize);
    let stopThemeListener = applyThemePreference(initial.theme);
    const unsubscribe = subscribeToPreferences((next) => {
      applyFontSizePreference(next.fontSize);
      stopThemeListener();
      stopThemeListener = applyThemePreference(next.theme);
    });
    return () => {
      unsubscribe();
      stopThemeListener();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // Ignore storage errors
    }
  }, [view]);

  useEffect(() => {
    let cancelled = false;

    const loadProviders = async () => {
      try {
        setIsLoadingProviders(true);
        setProviderError(null);
        const response = await fetch(buildApiUrl('/api/providers'));
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as ProvidersResponse;
        if (cancelled) return;

        setProviderOptions(data.available);
        const defaultProvider =
          data.available.find((provider) => provider.id === data.default) ?? null;
        setSelectedProvider(defaultProvider?.id ?? null);
        setSelectedModel(defaultProvider?.models[0] ?? '');
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : '加载模型配置失败';
        setProviderError(message);
        setProviderOptions([]);
        setSelectedProvider(null);
        setSelectedModel('');
      } finally {
        if (!cancelled) {
          setIsLoadingProviders(false);
        }
      }
    };

    void loadProviders();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleProviderChange = useCallback(
    (providerId: ProviderId | null) => {
      setSelectedProvider(providerId);
      const nextProvider = providerOptions.find((provider) => provider.id === providerId);
      setSelectedModel(nextProvider?.models[0] ?? '');
    },
    [providerOptions],
  );

  const navigateTo = useCallback((nextView: AppView) => {
    if (!confirmDraftNavigation((message) => window.confirm(message))) return;
    setDraftSelection(null); setView(nextView);
  }, []);
  const selectDraft = useCallback((kind: FlowKind, selection: DraftSelection) => {
    if (!confirmDraftNavigation((message) => window.confirm(message))) return;
    setDraftSelection({ kind, selection }); setRestoreRevision((revision) => revision + 1); setView(kind);
  }, []);
  const handleConvertToAdapter = useCallback((text: string) => {
    selectDraft('adapter', { newDraft: true, payload: { inputText: text } });
  }, [selectDraft]);
  const handlePickFlow = useCallback((kind: FlowKind) => navigateTo(kind), [navigateTo]);
  const handleRestoreDraft = useCallback((kind: FlowKind, payload: unknown, id?: string) => {
    selectDraft(kind, { id, payload });
  }, [selectDraft]);
  const handleBack = useCallback((target?: FlowKind) => {
    navigateTo(target ?? 'home');
  }, [navigateTo]);

  const sharedProviderProps = {
    providers: providerOptions, selectedProvider, selectedModel, onProviderChange: handleProviderChange,
    onModelChange: setSelectedModel, loading: isLoadingProviders, error: providerError,
    draftSelection: draftSelection?.kind === view ? draftSelection.selection : undefined,
    onNewDraft: () => { if (view !== 'home') selectDraft(view, { newDraft: true }); },
    onRestoreDraft: (selection: DraftSelection) => { if (view !== 'home') selectDraft(view, selection); },
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <Header
        selectedProvider={selectedProvider}
        selectedModel={selectedModel}
        providerLoading={isLoadingProviders}
        providerError={providerError}
        currentView={view}
        onRestoreFlow={handleRestoreDraft}
        onNavigateHome={() => navigateTo('home')}
      />
      {view !== 'home' && <BackBar kind={view} onBack={handleBack} />}

      {view === 'home' && <Home onPick={handlePickFlow} onRestore={handleRestoreDraft} />}
      {view === 'wechat' && (
        <WeChatPage
          key={`wechat-${restoreRevision}`}
          {...sharedProviderProps}
          onConvertToAdapter={handleConvertToAdapter}
        />
      )}
      {view === 'adapter' && (
        <AdapterPage
          key={`adapter-${restoreRevision}`}
          {...sharedProviderProps}
        />
      )}
      {view === 'composer' && (
        <ComposerPage key={`composer-${restoreRevision}`} {...sharedProviderProps} />
      )}

      <OperaToast />

      <footer className="border-t border-neutral-100 bg-white/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <span className="text-xs text-neutral-300">
            Opera - 内容创作工具
          </span>
          <span className="text-xs text-neutral-300">
            无需登录 / 本地草稿
          </span>
        </div>
      </footer>
    </div>
  );
}
