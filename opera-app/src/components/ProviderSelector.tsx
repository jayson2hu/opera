import type { ProviderId, ProviderInfo } from '../types';

interface ProviderSelectorProps {
  providers: ProviderInfo[];
  selectedProvider: ProviderId | null;
  selectedModel: string;
  disabled?: boolean;
  loading?: boolean;
  onProviderChange: (providerId: ProviderId | null) => void;
  onModelChange: (model: string) => void;
}

export default function ProviderSelector({
  providers,
  selectedProvider,
  selectedModel,
  disabled = false,
  loading = false,
  onProviderChange,
  onModelChange,
}: ProviderSelectorProps) {
  const currentProvider =
    providers.find((provider) => provider.id === selectedProvider) ?? null;

  const hasProviders = providers.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="block text-sm font-medium text-neutral-700">
          模型服务
        </label>
        <span className="text-xs text-neutral-400">
          默认使用后端配置，也可以为本次生成指定 provider/model
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label
            htmlFor="provider-select"
            className="block text-xs font-medium text-neutral-500"
          >
            Provider
          </label>
          <select
            id="provider-select"
            value={selectedProvider ?? ''}
            onChange={(event) =>
              onProviderChange(
                event.target.value ? (event.target.value as ProviderId) : null,
              )
            }
            disabled={disabled || loading || !hasProviders}
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm transition-colors outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            <option value="">使用后端默认</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="model-select"
            className="block text-xs font-medium text-neutral-500"
          >
            Model
          </label>
          <select
            id="model-select"
            value={selectedModel}
            onChange={(event) => onModelChange(event.target.value)}
            disabled={disabled || loading || !currentProvider}
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm transition-colors outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
          >
            <option value="">
              {currentProvider ? '使用 provider 默认模型' : '先选择 provider'}
            </option>
            {currentProvider?.models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <p className="text-xs text-neutral-400">正在加载可用模型服务...</p>
      )}

      {!loading && !hasProviders && (
        <p className="text-xs text-warning-500">
          当前没有可用模型服务。请检查后端 .env 中的 API key 配置。
        </p>
      )}
    </div>
  );
}
