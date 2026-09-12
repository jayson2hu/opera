import { useEffect, useRef, useState } from 'react';
import type { AppView, FlowKind, ProviderId } from '../types';
import ConfirmLeaveModal from './menus/ConfirmLeaveModal';
import DraftDrawer from './menus/DraftDrawer';
import ModelPopover from './menus/ModelPopover';
import PreferencesModal from './menus/PreferencesModal';
import ProfileModal from './menus/ProfileModal';
import UserMenu from './menus/UserMenu';

interface HeaderProps {
  selectedProvider?: ProviderId | null;
  selectedModel?: string;
  providerLoading?: boolean;
  providerError?: string | null;
  /** 当前视图，用于点 logo 时判断是否需要弹"离开"确认 */
  currentView?: AppView;
  /** 草稿箱"恢复"草稿时通知 App 切换 view */
  onRestoreFlow?: (kind: FlowKind, payload: unknown, id?: string) => void;
  /** 点 logo 返回首页 */
  onNavigateHome?: () => void;
}

function hasFlowDraft(kind: FlowKind): boolean {
  try {
    const active = window.localStorage.getItem('opera-active-draft-' + kind);
    return Boolean(active && window.localStorage.getItem(active)) || window.localStorage.getItem('opera-draft-' + kind + '-current') !== null;
  } catch {
    return false;
  }
}

const SHOW_MODEL_KEY = 'opera-show-model';

function readShowModel(): boolean {
  try {
    return window.localStorage.getItem(SHOW_MODEL_KEY) !== '0';
  } catch {
    return true;
  }
}

/**
 * 工作台顶栏：高度 56px。
 * 左侧 logo；右侧模型胶囊（弹层）+ 头像菜单（草稿箱 + 偏好）。
 */
export default function Header({
  selectedProvider,
  selectedModel,
  providerLoading = false,
  providerError = null,
  currentView = 'home',
  onRestoreFlow,
  onNavigateHome,
}: HeaderProps) {
  const modelLabel = selectedModel || '未选择模型';
  const providerLabel = selectedProvider ?? '默认';
  const connectionState = providerLoading
    ? 'loading'
    : providerError
      ? 'error'
      : selectedProvider
        ? 'connected'
        : 'unavailable';
  const connectionLabel = {
    loading: '加载中',
    error: '加载失败',
    connected: '已连接',
    unavailable: '未连接',
  }[connectionState];
  const connectionDotClass = {
    loading: 'bg-amber-400 animate-pulse',
    error: 'bg-red-500',
    connected: 'bg-emerald-500',
    unavailable: 'bg-neutral-300',
  }[connectionState];

  const [modelOpen, setModelOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const userMenuTriggerRef = useRef<HTMLButtonElement>(null);

  const isInFlow = currentView !== 'home';

  const handleLogoClick = () => {
    if (!isInFlow) return; // 在 home 时点 logo 无操作
    setLeaveConfirmOpen(true);
  };
  const [showModel, setShowModel] = useState<boolean>(() =>
    typeof window === 'undefined' ? true : readShowModel(),
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(SHOW_MODEL_KEY, showModel ? '1' : '0');
    } catch {
      // ignore
    }
  }, [showModel]);

  useEffect(() => {
    const openDrafts = () => {
      setUserMenuOpen(false);
      setDraftsOpen(true);
    };
    window.addEventListener('opera:open-drafts', openDrafts);
    return () => window.removeEventListener('opera:open-drafts', openDrafts);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-neutral-200">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <button
            type="button"
            onClick={handleLogoClick}
            aria-label={isInFlow ? '返回首页' : 'Opera 内容创作工作台'}
            disabled={!isInFlow}
            className={`
              flex items-center gap-2.5 rounded-xl px-1 -mx-1 py-0.5 transition-colors
              focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500
              ${isInFlow ? 'cursor-pointer hover:bg-neutral-100/60' : 'cursor-default'}
            `}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 shadow-card">
              <svg
                className="h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                />
              </svg>
            </span>
            <span className="flex items-baseline gap-2">
              <span className="text-base font-bold text-neutral-900 tracking-tight">Opera</span>
              <span className="hidden sm:inline text-xs text-neutral-400">
                · 内容创作工作台
              </span>
            </span>
          </button>

          <div className="relative flex items-center gap-2">
            {/* 模型胶囊（桌面 + 未隐藏） */}
            {showModel && (
              <button
                type="button"
                aria-label={`模型设置（${connectionLabel}）`}
                aria-expanded={modelOpen}
                onClick={() => setModelOpen((prev) => !prev)}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 cursor-pointer"
              >
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${connectionDotClass}`} />
                <span className="text-neutral-400">{providerLabel}</span>
                <span aria-hidden="true" className="text-neutral-300">/</span>
                <span>{modelLabel}</span>
              </button>
            )}
            {/* 模型 CPU 图标（移动 / 隐藏胶囊后用作 fallback） */}
            <button
              type="button"
              aria-label={`模型设置（${connectionLabel}）`}
              aria-expanded={modelOpen}
              onClick={() => setModelOpen((prev) => !prev)}
              className={`flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 cursor-pointer ${showModel ? 'sm:hidden' : ''}`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>

            {modelOpen && (
              <ModelPopover
                onClose={() => setModelOpen(false)}
                provider={selectedProvider ?? null}
                model={selectedModel ?? ''}
                loading={providerLoading}
                error={providerError}
                onHideFromHeader={() => {
                  setShowModel(false);
                  setModelOpen(false);
                }}
              />
            )}

            {/* 头像 */}
            <button
              ref={userMenuTriggerRef}
              type="button"
              aria-label="账号菜单"
              aria-expanded={userMenuOpen}
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent-300 to-accent-500 text-xs font-bold text-white shadow-card transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 cursor-pointer"
            >
              创
            </button>

            {userMenuOpen && (
              <UserMenu
                onClose={() => setUserMenuOpen(false)}
                onOpenDrafts={() => setDraftsOpen(true)}
                onOpenPreferences={() => setPrefsOpen(true)}
                onOpenProfile={() => setProfileOpen(true)}
              />
            )}
          </div>
        </div>
      </header>

      {draftsOpen && (
        <DraftDrawer
          onClose={() => setDraftsOpen(false)}
          onRestore={(kind, payload, id) => onRestoreFlow?.(kind, payload, id)}
          returnFocusRef={userMenuTriggerRef}
        />
      )}
      {prefsOpen && <PreferencesModal onClose={() => setPrefsOpen(false)} returnFocusRef={userMenuTriggerRef} />}
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} returnFocusRef={userMenuTriggerRef} />}
      {leaveConfirmOpen && currentView !== 'home' && (
        <ConfirmLeaveModal
          fromKind={currentView}
          hasSavedDraft={hasFlowDraft(currentView)}
          onCancel={() => setLeaveConfirmOpen(false)}
          onConfirm={() => {
            setLeaveConfirmOpen(false);
            onNavigateHome?.();
          }}
        />
      )}
    </>
  );
}
