import { useRef, useState, type RefObject } from 'react';
import { clearAllDrafts } from '../../hooks/useRecentDrafts';
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap';
import {
  readPreferences,
  writePreferences,
  type Preferences,
} from '../../lib/preferences';
import { toast } from '../../lib/toast';

const FLOW_LABEL: Record<Preferences['defaultFlow'], string> = {
  home: '首页',
  wechat: '写公众号',
  adapter: '改写小红书',
  composer: '写小红书',
};

const FONT_LABEL: Record<Preferences['fontSize'], string> = {
  sm: '小',
  md: '中',
  lg: '大',
};

const THEME_LABEL: Record<Preferences['theme'], string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
};

/**
 * 偏好设置模态：默认流程、字号、清空所有草稿。
 * 偏好由 lib/preferences 统一校验、持久化并广播变更。
 */
export default function PreferencesModal({
  onClose,
  returnFocusRef,
}: {
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const [prefs, setPrefs] = useState<Preferences>(() => readPreferences());
  const [confirmingClear, setConfirmingClear] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocusTrap(dialogRef, onClose, { returnFocusRef });

  const updatePrefs = (patch: Partial<Preferences>) => {
    const next = writePreferences({ ...prefs, ...patch });
    setPrefs(next);
  };

  return (
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="偏好设置" className="fixed inset-0 z-[85] flex items-center justify-center p-4 animate-fade-in">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-float">
        <header className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <h2 className="text-base font-semibold text-neutral-900">偏好设置</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            data-autofocus
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="space-y-5 px-6 py-5">
          {/* 默认流程 */}
          <section>
            <h3 className="mb-2 text-xs font-semibold text-neutral-600">默认流程</h3>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(FLOW_LABEL) as Preferences['defaultFlow'][]).map((option) => {
                const isSelected = prefs.defaultFlow === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updatePrefs({ defaultFlow: option })}
                    aria-pressed={isSelected}
                    className={`
                      rounded-xl border px-3 py-2 text-sm font-medium transition-all cursor-pointer
                      ${isSelected ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'}
                    `}
                  >
                    {FLOW_LABEL[option]}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-neutral-400">下次打开 Opera 时默认进入的页面</p>
          </section>

          {/* 字号 */}
          <section>
            <h3 className="mb-2 text-xs font-semibold text-neutral-600">字号</h3>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(FONT_LABEL) as Preferences['fontSize'][]).map((option) => {
                const isSelected = prefs.fontSize === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updatePrefs({ fontSize: option })}
                    aria-pressed={isSelected}
                    className={`
                      rounded-xl border px-3 py-2 text-sm font-medium transition-all cursor-pointer
                      ${isSelected ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'}
                    `}
                  >
                    {FONT_LABEL[option]}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold text-neutral-600">外观</h3>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(THEME_LABEL) as Preferences['theme'][]).map((option) => {
                const isSelected = prefs.theme === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => updatePrefs({ theme: option })}
                    aria-pressed={isSelected}
                    className={`rounded-xl border px-2 py-2 text-sm font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'border-primary-400 bg-primary-50 text-primary-700'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                    }`}
                  >
                    {THEME_LABEL[option]}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3">
            <div>
              <h3 id="watermark-setting-label" className="text-xs font-semibold text-neutral-700">导出图片水印</h3>
              <p className="mt-0.5 text-[11px] text-neutral-400">在卡片图片中显示 Opera 品牌信息</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-labelledby="watermark-setting-label"
              aria-checked={prefs.showWatermark}
              onClick={() => updatePrefs({ showWatermark: !prefs.showWatermark })}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ${
                prefs.showWatermark ? 'bg-primary-500' : 'bg-neutral-300'
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-card transition-transform ${
                  prefs.showWatermark ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </section>

          {/* 清空草稿 */}
          <section className="border-t border-neutral-100 pt-4">
            {!confirmingClear ? (
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                className="w-full rounded-xl border border-error-500/20 bg-error-50 px-3 py-2 text-sm font-medium text-error-500 transition-colors hover:bg-error-50/80 cursor-pointer"
              >
                清空所有本地草稿
              </button>
            ) : (
              <div className="space-y-2 rounded-xl border border-error-500/30 bg-error-50 p-3">
                <p className="text-xs font-medium text-error-500">确定要清空所有本地草稿？此操作不可撤销</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingClear(false)}
                    className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50 cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cleared = clearAllDrafts();
                      setConfirmingClear(false);
                      toast(cleared ? '已清空已保存草稿；当前未保存的编辑仍在内存中' : '清理未全部成功，请检查浏览器存储后重试');
                    }}
                    className="flex-1 rounded-lg bg-error-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-error-500/90 cursor-pointer"
                  >
                    确认清空
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
