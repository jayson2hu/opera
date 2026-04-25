import { useCallback, useEffect, useState } from 'react';
import type {
  AppTab,
  ProviderId,
  ProvidersResponse,
} from './types';
import Header from './components/Header';
import TabNav from './components/TabNav';
import { buildApiUrl } from './constants';
import AdapterPage from './pages/AdapterPage';
import ComposerPage from './pages/ComposerPage';
import WeChatPage from './pages/WeChatPage';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('adapter');
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [providerOptions, setProviderOptions] = useState<ProvidersResponse['available']>([]);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [providerError, setProviderError] = useState<string | null>(null);

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

  const sharedProviderProps = {
    providers: providerOptions,
    selectedProvider,
    selectedModel,
    onProviderChange: handleProviderChange,
    onModelChange: setSelectedModel,
    loading: isLoadingProviders,
    error: providerError,
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <Header />
      <TabNav activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'adapter' ? (
        <AdapterPage {...sharedProviderProps} />
      ) : activeTab === 'composer' ? (
        <ComposerPage {...sharedProviderProps} />
      ) : (
        <WeChatPage {...sharedProviderProps} />
      )}

      <footer className="border-t border-neutral-100 bg-white/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <span className="text-xs text-neutral-300">
            Opera - 内容创作工具
          </span>
          <span className="text-xs text-neutral-300">
            无需登录 / 免费使用
          </span>
        </div>
      </footer>
    </div>
  );
}
